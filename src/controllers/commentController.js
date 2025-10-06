const Comment = require('../models/Comment');
const Post = require('../models/Post');
const Notification = require('../models/Notification');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');
const cache = require('../utils/cacheAdapter');
const {
  getPaginationOptions,
  createPaginatedResponse,
  getCommentPopulateOptions,
  USER_BASIC_FIELDS,
} = require('../utils/queryOptimizer');

// Crear un comentario
exports.createComment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: errors.array(),
      });
    }

    const { content, parentComment } = req.body;
    const postId = req.params.postId;

    // Verificar que el post existe
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Publicación no encontrada',
      });
    }

    const commentData = {
      user: req.user.id,
      post: postId,
      content: content.trim(),
    };

    // Si es una respuesta a otro comentario
    if (parentComment) {
      const parent = await Comment.findById(parentComment);
      if (!parent) {
        return res.status(404).json({
          success: false,
          message: 'Comentario padre no encontrado',
        });
      }
      commentData.parentComment = parentComment;
    }

    const comment = new Comment(commentData);
    await comment.save();

    // Invalidar caché de comentarios
    await cache.deletePattern(`comments:${postId}:*`);

    // Populate user data
    await comment.populate('user', 'username avatar fullName');

    // Notificar al dueño del post si no es el mismo usuario
    if (post.user.toString() !== req.user.id) {
      await Notification.create({
        user: post.user,
        type: 'comment',
        from: req.user.id,
        post: postId,
        comment: comment._id,
        message: 'Comentó en tu publicación',
      });
    }

    res.status(201).json({
      success: true,
      message: 'Comentario creado exitosamente',
      comment,
    });
  } catch (error) {
    logger.error('Error en createComment:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};

// Obtener comentarios de un post
exports.getComments = async (req, res) => {
  try {
    const postId = req.params.postId;
    const { page, limit, skip } = getPaginationOptions(
      req.query.page,
      req.query.limit
    );

    // Intentar obtener del caché
    const cacheKey = `comments:${postId}:${page}:${limit}`;
    const cachedComments = await cache.get(cacheKey);

    if (cachedComments) {
      return res.json(cachedComments);
    }

    // Verificar que el post existe
    const post = await Post.findById(postId).select('_id').lean();
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Publicación no encontrada',
      });
    }

    // Query optimizada
    const query = {
      post: postId,
      isDeleted: false,
      parentComment: null,
    };

    // Ejecutar queries en paralelo
    const [comments, total] = await Promise.all([
      Comment.find(query)
        .populate('user', USER_BASIC_FIELDS)
        .select('-__v')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Comment.countDocuments(query),
    ]);

    const response = createPaginatedResponse(comments, total, page, limit);

    // Guardar en caché por 1 minuto
    await cache.set(cacheKey, response, 60);

    res.json(response);
  } catch (error) {
    logger.error('Error en getComments:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};

// Obtener respuestas de un comentario
exports.getReplies = async (req, res) => {
  try {
    const commentId = req.params.commentId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const skip = (page - 1) * limit;

    // Verificar que el comentario existe
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comentario no encontrado',
      });
    }

    const replies = await Comment.findReplies(commentId)
      .skip(skip)
      .limit(limit);

    const total = await Comment.countDocuments({
      parentComment: commentId,
      isDeleted: false,
    });

    res.json({
      success: true,
      replies,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Error en getReplies:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};

// Dar/quitar like a un comentario
exports.toggleLike = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comentario no encontrado',
      });
    }

    const userId = req.user.id;
    const isLiked = comment.isLikedBy(userId);

    if (isLiked) {
      await comment.removeLike(userId);
    } else {
      await comment.addLike(userId);

      // Notificar al dueño del comentario si no es el mismo usuario
      if (comment.user.toString() !== userId) {
        await Notification.create({
          user: comment.user,
          type: 'comment_like',
          from: userId,
          post: comment.post,
          comment: comment._id,
          message: 'Le ha gustado tu comentario',
        });
      }
    }

    res.json({
      success: true,
      liked: !isLiked,
      likesCount: comment.likes.length,
    });
  } catch (error) {
    logger.error('Error en toggleLike:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};

// Actualizar un comentario
exports.updateComment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: errors.array(),
      });
    }

    const { content } = req.body;
    const comment = await Comment.findById(req.params.commentId);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comentario no encontrado',
      });
    }

    // Verificar que el usuario sea el dueño del comentario
    if (comment.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para editar este comentario',
      });
    }

    comment.content = content.trim();
    comment.isEdited = true;
    await comment.save();

    await comment.populate('user', 'username avatar fullName');

    res.json({
      success: true,
      message: 'Comentario actualizado exitosamente',
      comment,
    });
  } catch (error) {
    logger.error('Error en updateComment:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};

// Eliminar un comentario
exports.deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comentario no encontrado',
      });
    }

    // Verificar que el usuario sea el dueño del comentario o del post
    const post = await Post.findById(comment.post);
    const isOwner = comment.user.toString() === req.user.id;
    const isPostOwner = post && post.user.toString() === req.user.id;

    if (!isOwner && !isPostOwner) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para eliminar este comentario',
      });
    }

    await comment.softDelete();

    res.json({
      success: true,
      message: 'Comentario eliminado exitosamente',
    });
  } catch (error) {
    logger.error('Error en deleteComment:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};

// Obtener comentarios de un usuario
exports.getUserComments = async (req, res) => {
  try {
    const { username } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const User = require('../models/User');
    const user = await User.findOne({ username });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }

    const comments = await Comment.find({
      user: user._id,
      isDeleted: false,
      parentComment: null,
    })
      .populate('user', 'username avatar fullName')
      .populate('post', 'caption content')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Comment.countDocuments({
      user: user._id,
      isDeleted: false,
      parentComment: null,
    });

    res.json({
      success: true,
      comments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Error en getUserComments:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};

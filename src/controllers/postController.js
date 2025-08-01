const Post = require('../models/Post');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { validationResult } = require('express-validator');

// Crear una nueva publicación
exports.createPost = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: errors.array()
      });
    }

    const { type, caption, location, tags } = req.body;
    
    let postData = {
      user: req.userId,
      type: type || 'image',
      caption: caption || '',
      tags: tags ? tags.split(',').map(tag => tag.trim()) : []
    };

    // Agregar ubicación si se proporciona
    if (location) {
      postData.location = { name: location };
    }

    // Manejar diferentes tipos de contenido
    switch (type) {
      case 'image':
        if (!req.files || !req.files.images) {
          return res.status(400).json({
            success: false,
            message: 'La imagen es obligatoria para publicaciones de imagen'
          });
        }
        
        const images = Array.isArray(req.files.images) ? req.files.images : [req.files.images];
        postData.content = {
          images: images.map(file => ({
            url: `/uploads/${file.filename}`,
            alt: caption || '',
            width: 0, // Se calcularía con sharp
            height: 0
          }))
        };
        break;

      case 'video':
        if (!req.files || !req.files.video) {
          return res.status(400).json({
            success: false,
            message: 'El video es obligatorio para publicaciones de video'
          });
        }
        
        postData.content = {
          video: {
            url: `/uploads/${req.files.video[0].filename}`,
            duration: 0, // Se calcularía con ffmpeg
            thumbnail: `/uploads/${req.files.video[0].filename.replace(/\.[^/.]+$/, '_thumb.jpg')}`,
            width: 0,
            height: 0
          }
        };
        break;

      case 'text':
        if (!req.body.text) {
          return res.status(400).json({
            success: false,
            message: 'El texto es obligatorio para publicaciones de texto'
          });
        }
        
        postData.content = {
          text: req.body.text
        };
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Tipo de publicación no válido'
        });
    }

    const post = new Post(postData);
    await post.save();
    
    // Populate user data for response
    await post.populate('user', 'username avatar fullName');
    
    res.status(201).json({
      success: true,
      message: 'Publicación creada exitosamente',
      post
    });
  } catch (error) {
    console.error('Error en createPost:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Obtener el feed de publicaciones
exports.getFeed = async (req, res) => {
  try {
    const userId = req.userId;
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Usuarios a mostrar: seguidos + propio usuario
    const usersToShow = [userId, ...(user.following || [])];

    // Paginación
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const posts = await Post.find({ 
      user: { $in: usersToShow },
      isPublic: true,
      isArchived: false,
      isDeleted: false
    })
    .populate('user', 'username avatar fullName')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

    const total = await Post.countDocuments({ 
      user: { $in: usersToShow },
      isPublic: true,
      isArchived: false,
      isDeleted: false
    });

    res.json({
      success: true,
      posts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error en getFeed:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener un post específico
exports.getPost = async (req, res) => {
  try {
    const post = await Post.findOne({
      _id: req.params.id,
      isDeleted: false
    })
    .populate('user', 'username avatar fullName bio')
    .populate('likes', 'username avatar');
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Publicación no encontrada'
      });
    }

    // Incrementar vistas
    await post.incrementViews();

    res.json({
      success: true,
      post
    });
  } catch (error) {
    console.error('Error en getPost:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Dar/quitar like a un post
exports.toggleLike = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Publicación no encontrada'
      });
    }

    const userId = req.userId;
    const isLiked = post.isLikedBy(userId);
    
    if (isLiked) {
      await post.removeLike(userId);
    } else {
      await post.addLike(userId);
      
      // Notificar al dueño del post si no es el mismo usuario
      if (post.user.toString() !== userId) {
        await Notification.create({
          user: post.user,
          type: 'like',
          from: userId,
          post: post._id,
          message: 'Le ha gustado tu publicación'
        });
      }
    }

    res.json({
      success: true,
      liked: !isLiked,
      likesCount: post.likes.length
    });
  } catch (error) {
    console.error('Error en toggleLike:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Listar usuarios que han dado like a un post
exports.getLikes = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('likes', 'username avatar fullName');
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Publicación no encontrada'
      });
    }

    res.json({
      success: true,
      likes: post.likes
    });
  } catch (error) {
    console.error('Error en getLikes:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener posts de un usuario específico
exports.getUserPosts = async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const posts = await Post.findByUser(user._id, { includeArchived: false })
      .populate('user', 'username avatar fullName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Post.countDocuments({ 
      user: user._id,
      isDeleted: false,
      isArchived: false
    });

    res.json({
      success: true,
      posts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error en getUserPosts:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener posts trending
exports.getTrendingPosts = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const posts = await Post.findTrending(limit)
      .populate('user', 'username avatar fullName');

    res.json({
      success: true,
      posts
    });
  } catch (error) {
    console.error('Error en getTrendingPosts:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Eliminar un post
exports.deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Publicación no encontrada'
      });
    }

    // Verificar que el usuario sea el dueño del post
    if (post.user.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para eliminar esta publicación'
      });
    }

    await post.softDelete();

    res.json({
      success: true,
      message: 'Publicación eliminada exitosamente'
    });
  } catch (error) {
    console.error('Error en deletePost:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Actualizar un post
exports.updatePost = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: errors.array()
      });
    }

    const { caption, location, tags } = req.body;
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Publicación no encontrada'
      });
    }

    // Verificar que el usuario sea el dueño del post
    if (post.user.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para editar esta publicación'
      });
    }

    // Actualizar campos permitidos
    if (caption !== undefined) post.caption = caption;
    if (location !== undefined) post.location = { name: location };
    if (tags !== undefined) post.tags = tags.split(',').map(tag => tag.trim());

    await post.save();

    res.json({
      success: true,
      message: 'Publicación actualizada exitosamente',
      post
    });
  } catch (error) {
    console.error('Error en updatePost:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener posts recientes (públicos)
exports.getRecentPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const posts = await Post.find({ 
      isPublic: true, 
      isDeleted: false 
    })
    .populate('user', 'username avatar fullName')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

    const total = await Post.countDocuments({ 
      isPublic: true, 
      isDeleted: false 
    });

    res.json({
      success: true,
      posts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error en getRecentPosts:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

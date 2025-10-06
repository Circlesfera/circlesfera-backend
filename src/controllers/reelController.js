const Reel = require('../models/Reel');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');
const cacheService = require('../utils/cacheService');
const {
  getPaginationOptions,
  createPaginatedResponse,
  USER_BASIC_FIELDS,
} = require('../utils/queryOptimizer');

// Crear un nuevo reel
exports.createReel = async (req, res) => {
  try {
    logger.info('🎬 createReel llamado con:', {
      userId: req.userId,
      body: req.body,
      headers: req.headers,
    });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: errors.array(),
      });
    }

    const {
      caption,
      hashtags,
      location,
      audioTitle,
      audioArtist,
      allowComments,
      allowDuets,
      allowStitches,
    } = req.body;

    // Verificar que se subió un video
    if (!req.files || !req.files.video) {
      return res.status(400).json({
        success: false,
        message: 'El video es obligatorio para crear un reel',
      });
    }

    // Construir URL completa del servidor
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const videoUrl = `${baseUrl}/uploads/${req.files.video[0].filename}`;

    // Crear objeto del reel
    const reelData = {
      user: req.userId,
      video: {
        url: videoUrl,
        thumbnail: videoUrl.replace(/\.[^/.]+$/, '_thumb.jpg'), // Thumbnail automático
        duration: 0, // Se calculará después
        width: 1080, // Proporción 9:16 fija
        height: 1920,
      },
      caption: caption || '',
      hashtags: hashtags
        ? hashtags.split(',').map(tag => tag.trim().replace('#', ''))
        : [],
      allowComments: allowComments !== false, // Por defecto true
      allowDuets: allowDuets !== false, // Por defecto true
      allowStitches: allowStitches !== false, // Por defecto true
    };

    // Agregar audio si se proporciona
    if (audioTitle || audioArtist) {
      reelData.audio = {
        title: audioTitle || '',
        artist: audioArtist || '',
      };
    }

    // Agregar ubicación si se proporciona
    if (location) {
      reelData.location = { name: location };
    }

    logger.info('🎬 Reel data a crear:', reelData);

    // Crear el reel
    const reel = new Reel(reelData);
    await reel.save();

    // Populate user info para la respuesta
    await reel.populate('user', 'username avatar fullName');

    // Crear notificación para seguidores (opcional)
    try {
      const user = await User.findById(req.userId);
      if (user && user.followers && user.followers.length > 0) {
        // Notificar a los primeros 10 seguidores para evitar spam
        const followersToNotify = user.followers.slice(0, 10);

        for (const followerId of followersToNotify) {
          await Notification.create({
            user: followerId,
            type: 'new_reel',
            fromUser: req.userId,
            content: `${user.username} subió un nuevo reel`,
            relatedContent: {
              type: 'reel',
              id: reel._id,
            },
          });
        }
      }
    } catch (notifError) {
      logger.info('⚠️ Error creando notificaciones:', notifError);
      // No fallar si las notificaciones fallan
    }

    res.status(201).json({
      success: true,
      message: 'Reel creado exitosamente',
      reel,
    });
  } catch (error) {
    logger.error('Error en createReel:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Obtener reels para el feed
exports.getReelsForFeed = async (req, res) => {
  try {
    const userId = req.userId;
    const { page, limit, skip } = getPaginationOptions(
      req.query.page || 1,
      req.query.limit || 20
    );

    // Intentar obtener del caché
    const cacheKey = `reels:feed:${userId}:${page}:${limit}`;
    const cachedReels = cacheService.get(cacheKey);

    if (cachedReels) {
      logger.info(`Reels feed servido desde caché para usuario ${userId}`);
      return res.json(cachedReels);
    }

    // Query optimizada
    const query = {
      isDeleted: false,
      isPublic: true,
    };

    // Ejecutar queries en paralelo
    const [reels, total] = await Promise.all([
      Reel.find(query)
        .populate('user', USER_BASIC_FIELDS)
        .select('-__v')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Reel.countDocuments(query),
    ]);

    const response = {
      success: true,
      reels,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasMore: page * limit < total,
        hasPrev: page > 1,
      },
    };

    // Guardar en caché por 2 minutos
    cacheService.set(cacheKey, response, 120);

    res.json(response);
  } catch (error) {
    logger.error('Error en getReelsForFeed:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};

// Obtener reels de un usuario específico
exports.getUserReels = async (req, res) => {
  try {
    const { username } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }

    const reels = await Reel.find({
      user: user._id,
      isDeleted: false,
    })
      .populate('user', 'username avatar fullName')
      .populate('audio')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Contar total de reels del usuario
    const total = await Reel.countDocuments({
      user: user._id,
      isDeleted: false,
    });

    res.json({
      success: true,
      reels,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalReels: total,
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    logger.error('Error en getUserReels:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};

// Obtener un reel específico
exports.getReel = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const reel = await Reel.findOne({
      _id: id,
      isDeleted: false,
      isPublic: true,
    })
      .populate('user', 'username avatar fullName')
      .populate('audio')
      .populate('comments.user', 'username avatar')
      .populate('likes.user', 'username avatar');

    if (!reel) {
      return res.status(404).json({
        success: false,
        message: 'Reel no encontrado',
      });
    }

    // Agregar vista si el usuario no es el dueño
    if (reel.user._id.toString() !== userId) {
      await reel.addView(userId);
    }

    res.json({
      success: true,
      reel,
    });
  } catch (error) {
    logger.error('Error en getReel:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};

// Dar like a un reel
exports.likeReel = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const reel = await Reel.findById(id);
    if (!reel) {
      return res.status(404).json({
        success: false,
        message: 'Reel no encontrado',
      });
    }

    if (reel.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Reel no encontrado',
      });
    }

    // Verificar si ya dio like
    const existingLike = reel.likes.find(like => like.user.equals(userId));
    if (existingLike) {
      return res.status(400).json({
        success: false,
        message: 'Ya has dado like a este reel',
      });
    }

    await reel.addLike(userId);

    // Invalidar caché relacionado
    cacheService.deletePattern(`reel:${id}:*`);
    cacheService.deletePattern(`reels:feed:*`);

    // Crear notificación para el dueño del reel
    if (reel.user.toString() !== userId) {
      try {
        const user = await User.findById(userId);
        await Notification.create({
          user: reel.user,
          type: 'reel_like',
          fromUser: userId,
          content: `A ${user.username} le gustó tu reel`,
          relatedContent: {
            type: 'reel',
            id: reel._id,
          },
        });
      } catch (notifError) {
        logger.info('⚠️ Error creando notificación de like:', notifError);
      }
    }

    res.json({
      success: true,
      message: 'Like agregado exitosamente',
      likesCount: reel.likes.length + 1,
      isLiked: true,
    });
  } catch (error) {
    logger.error('Error en likeReel:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};

// Quitar like de un reel
exports.unlikeReel = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const reel = await Reel.findById(id);
    if (!reel) {
      return res.status(404).json({
        success: false,
        message: 'Reel no encontrado',
      });
    }

    await reel.removeLike(userId);

    // Invalidar caché relacionado
    cacheService.deletePattern(`reel:${id}:*`);
    cacheService.deletePattern(`reels:feed:*`);

    res.json({
      success: true,
      message: 'Like removido exitosamente',
      likesCount: reel.likes.length,
      isLiked: false,
    });
  } catch (error) {
    logger.error('Error en unlikeReel:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};

// Comentar un reel
exports.commentReel = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.userId;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'El comentario no puede estar vacío',
      });
    }

    const reel = await Reel.findById(id);
    if (!reel) {
      return res.status(404).json({
        success: false,
        message: 'Reel no encontrado',
      });
    }

    if (reel.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Reel no encontrado',
      });
    }

    if (!reel.allowComments) {
      return res.status(403).json({
        success: false,
        message: 'Los comentarios están deshabilitados para este reel',
      });
    }

    await reel.addComment(userId, content.trim());

    // Crear notificación para el dueño del reel
    if (reel.user.toString() !== userId) {
      try {
        const user = await User.findById(userId);
        await Notification.create({
          user: reel.user,
          type: 'reel_comment',
          fromUser: userId,
          content: `${user.username} comentó en tu reel`,
          relatedContent: {
            type: 'reel',
            id: reel._id,
          },
        });
      } catch (notifError) {
        logger.info('⚠️ Error creando notificación de comentario:', notifError);
      }
    }

    // Obtener el reel actualizado con el comentario
    const updatedReel = await Reel.findById(id)
      .populate('user', 'username avatar fullName')
      .populate('comments.user', 'username avatar');

    res.json({
      success: true,
      message: 'Comentario agregado exitosamente',
      reel: updatedReel,
      commentsCount: updatedReel.comments.length,
    });
  } catch (error) {
    logger.error('Error en commentReel:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};

// Eliminar un reel
exports.deleteReel = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const reel = await Reel.findById(id);
    if (!reel) {
      return res.status(404).json({
        success: false,
        message: 'Reel no encontrado',
      });
    }

    // Verificar que el usuario sea el dueño del reel
    if (reel.user.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para eliminar este reel',
      });
    }

    await reel.softDelete();

    res.json({
      success: true,
      message: 'Reel eliminado exitosamente',
    });
  } catch (error) {
    logger.error('Error en deleteReel:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};

// Buscar reels por hashtag
exports.searchReelsByHashtag = async (req, res) => {
  try {
    const { hashtag } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const reels = await Reel.find({
      hashtags: { $regex: hashtag, $options: 'i' },
      isDeleted: false,
      isPublic: true,
    })
      .populate('user', 'username avatar fullName')
      .populate('audio')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Contar total de reels con ese hashtag
    const total = await Reel.countDocuments({
      hashtags: { $regex: hashtag, $options: 'i' },
      isDeleted: false,
      isPublic: true,
    });

    res.json({
      success: true,
      reels,
      hashtag,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalReels: total,
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    logger.error('Error en searchReelsByHashtag:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};

// Obtener reels trending (más populares)
exports.getTrendingReels = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const timeFrame = req.query.timeFrame || 'week'; // week, month, all

    let dateFilter = {};
    if (timeFrame === 'week') {
      dateFilter = {
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      };
    } else if (timeFrame === 'month') {
      dateFilter = {
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      };
    }

    const reels = await Reel.aggregate([
      { $match: { isDeleted: false, isPublic: true, ...dateFilter } },
      {
        $addFields: {
          score: {
            $add: [
              { $multiply: ['$viewsCount', 1] },
              { $multiply: ['$likesCount', 2] },
              { $multiply: ['$commentsCount', 3] },
              { $multiply: ['$sharesCount', 4] },
            ],
          },
        },
      },
      { $sort: { score: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          'user.password': 0,
          'user.email': 0,
        },
      },
    ]);

    res.json({
      success: true,
      reels,
      timeFrame,
    });
  } catch (error) {
    logger.error('Error en getTrendingReels:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};

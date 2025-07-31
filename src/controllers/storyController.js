const Story = require('../models/Story');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { validationResult } = require('express-validator');

// Crear una nueva historia
exports.createStory = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: errors.array()
      });
    }

    const { type, caption, location, textContent, textStyle } = req.body;
    
    let storyData = {
      user: req.user.id,
      type: type || 'image',
      caption: caption || ''
    };

    // Agregar ubicación si se proporciona
    if (location) {
      storyData.location = { name: location };
    }

    // Manejar diferentes tipos de contenido
    switch (type) {
      case 'image':
        if (!req.files || !req.files.image) {
          return res.status(400).json({
            success: false,
            message: 'La imagen es obligatoria para historias de imagen'
          });
        }
        
        storyData.content = {
          image: {
            url: `/uploads/${req.files.image[0].filename}`,
            alt: caption || '',
            width: 0, // Se calcularía con sharp
            height: 0
          }
        };
        break;

      case 'video':
        if (!req.files || !req.files.video) {
          return res.status(400).json({
            success: false,
            message: 'El video es obligatorio para historias de video'
          });
        }
        
        storyData.content = {
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
        if (!textContent) {
          return res.status(400).json({
            success: false,
            message: 'El contenido de texto es obligatorio para historias de texto'
          });
        }
        
        storyData.content = {
          text: {
            content: textContent,
            backgroundColor: textStyle?.backgroundColor || '#000000',
            textColor: textStyle?.textColor || '#ffffff',
            fontSize: textStyle?.fontSize || 24,
            fontFamily: textStyle?.fontFamily || 'Arial'
          }
        };
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Tipo de historia no válido'
        });
    }

    const story = new Story(storyData);
    await story.save();
    
    // Populate user data for response
    await story.populate('user', 'username avatar fullName');
    
    res.status(201).json({
      success: true,
      message: 'Historia creada exitosamente',
      story
    });
  } catch (error) {
    console.error('Error en createStory:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener historias para el feed
exports.getStoriesForFeed = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Usuarios a mostrar: seguidos + propio usuario
    const usersToShow = [userId, ...(user.following || [])];

    const stories = await Story.findStoriesForFeed(usersToShow);

    res.json({
      success: true,
      stories
    });
  } catch (error) {
    console.error('Error en getStoriesForFeed:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener historias de un usuario específico
exports.getUserStories = async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const stories = await Story.findByUser(user._id, { includeExpired: false })
      .populate('user', 'username avatar fullName')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      stories
    });
  } catch (error) {
    console.error('Error en getUserStories:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener una historia específica
exports.getStory = async (req, res) => {
  try {
    const story = await Story.findOne({
      _id: req.params.id,
      isDeleted: false
    })
    .populate('user', 'username avatar fullName')
    .populate('views.user', 'username avatar')
    .populate('reactions.user', 'username avatar')
    .populate('replies.user', 'username avatar');
    
    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Historia no encontrada'
      });
    }

    // Verificar si la historia ha expirado
    if (story.isExpired) {
      return res.status(404).json({
        success: false,
        message: 'Esta historia ha expirado'
      });
    }

    // Agregar vista si el usuario no es el dueño
    if (story.user._id.toString() !== req.user.id) {
      await story.addView(req.user.id);
    }

    res.json({
      success: true,
      story
    });
  } catch (error) {
    console.error('Error en getStory:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Agregar reacción a una historia
exports.addReaction = async (req, res) => {
  try {
    const { reactionType } = req.body;
    const story = await Story.findById(req.params.id);
    
    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Historia no encontrada'
      });
    }

    if (story.isExpired) {
      return res.status(400).json({
        success: false,
        message: 'No puedes reaccionar a una historia expirada'
      });
    }

    await story.addReaction(req.user.id, reactionType);

    res.json({
      success: true,
      message: 'Reacción agregada exitosamente',
      reactionsCount: story.reactions.length
    });
  } catch (error) {
    console.error('Error en addReaction:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Remover reacción de una historia
exports.removeReaction = async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    
    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Historia no encontrada'
      });
    }

    await story.removeReaction(req.user.id);

    res.json({
      success: true,
      message: 'Reacción removida exitosamente',
      reactionsCount: story.reactions.length
    });
  } catch (error) {
    console.error('Error en removeReaction:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Agregar respuesta a una historia
exports.addReply = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Error de validación',
        errors: errors.array()
      });
    }

    const { content } = req.body;
    const story = await Story.findById(req.params.id);
    
    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Historia no encontrada'
      });
    }

    if (story.isExpired) {
      return res.status(400).json({
        success: false,
        message: 'No puedes responder a una historia expirada'
      });
    }

    await story.addReply(req.user.id, content);

    // Notificar al dueño de la historia si no es el mismo usuario
    if (story.user.toString() !== req.user.id) {
      await Notification.create({
        user: story.user,
        type: 'story_reply',
        from: req.user.id,
        story: story._id,
        message: 'Respondió a tu historia'
      });
    }

    res.json({
      success: true,
      message: 'Respuesta agregada exitosamente',
      repliesCount: story.replies.length
    });
  } catch (error) {
    console.error('Error en addReply:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Eliminar una historia
exports.deleteStory = async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    
    if (!story) {
      return res.status(404).json({
        success: false,
        message: 'Historia no encontrada'
      });
    }

    // Verificar que el usuario sea el dueño de la historia
    if (story.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para eliminar esta historia'
      });
    }

    await story.softDelete();

    res.json({
      success: true,
      message: 'Historia eliminada exitosamente'
    });
  } catch (error) {
    console.error('Error en deleteStory:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Limpiar historias expiradas (tarea programada)
exports.cleanupExpiredStories = async (req, res) => {
  try {
    const result = await Story.cleanupExpiredStories();
    
    res.json({
      success: true,
      message: 'Limpieza de historias expiradas completada',
      result
    });
  } catch (error) {
    console.error('Error en cleanupExpiredStories:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

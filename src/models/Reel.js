import mongoose from 'mongoose'
import { MEDIA_CONFIG, validateAspectRatio } from '../config/media.js'

const ReelSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El usuario es requerido']
  },

  // Contenido del video
  video: {
    url: {
      type: String,
      required: [true, 'El video es requerido']
    },
    thumbnail: {
      type: String,
      required: false
    },
    duration: {
      type: Number,
      default: 0,
      min: [0, 'La duración no puede ser negativa'],
      max: [MEDIA_CONFIG.REEL.maxDuration, `La duración máxima para reels es ${MEDIA_CONFIG.REEL.maxDuration} segundos`]
    },
    width: {
      type: Number,
      default: MEDIA_CONFIG.REEL.width,
      min: [MEDIA_CONFIG.REEL.width, `El ancho mínimo para reels es ${MEDIA_CONFIG.REEL.width}px`],
      max: [MEDIA_CONFIG.REEL.width, `El ancho máximo para reels es ${MEDIA_CONFIG.REEL.width}px`]
    },
    height: {
      type: Number,
      default: MEDIA_CONFIG.REEL.height,
      min: [MEDIA_CONFIG.REEL.height, `El alto mínimo para reels es ${MEDIA_CONFIG.REEL.height}px`],
      max: [MEDIA_CONFIG.REEL.height, `El alto máximo para reels es ${MEDIA_CONFIG.REEL.height}px`]
    }
  },

  // Audio del reel
  audio: {
    title: {
      type: String,
      maxlength: [100, 'El título del audio no puede exceder 100 caracteres']
    },
    artist: {
      type: String,
      maxlength: [100, 'El artista del audio no puede exceder 100 caracteres']
    },
    duration: {
      type: Number,
      default: 0
    }
  },

  // Descripción y hashtags
  caption: {
    type: String,
    maxlength: [2200, 'La descripción no puede exceder 2200 caracteres'],
    default: ''
  },

  hashtags: [{
    type: String,
    maxlength: [30, 'Cada hashtag no puede exceder 30 caracteres']
  }],

  // Configuración del reel
  isPublic: {
    type: Boolean,
    default: true
  },

  allowComments: {
    type: Boolean,
    default: true
  },

  allowDuets: {
    type: Boolean,
    default: true
  },

  allowStitches: {
    type: Boolean,
    default: true
  },

  // Estadísticas
  views: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    viewedAt: {
      type: Date,
      default: Date.now
    }
  }],

  likes: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],

  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    content: {
      type: String,
      maxlength: [500, 'El comentario no puede exceder 500 caracteres'],
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    likes: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }]
  }],

  shares: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    sharedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Duets y Stitches
  duets: [{
    originalReel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Reel',
      required: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],

  stitches: [{
    originalReel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Reel',
      required: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Estado del reel
  isDeleted: {
    type: Boolean,
    default: false
  },

  isArchived: {
    type: Boolean,
    default: false
  },

  // Ubicación
  location: {
    name: {
      type: String,
      maxlength: [100, 'El nombre de la ubicación no puede exceder 100 caracteres']
    },
    coordinates: {
      type: {
        type: String,
        enum: ['Point']
      },
      coordinates: {
        type: [Number],
        validate: {
          validator(v) {
            return v.length === 2 && v[0] >= -180 && v[0] <= 180 && v[1] >= -90 && v[1] <= 90
          },
          message: 'Coordenadas inválidas'
        }
      }
    }
  },

  // Campos para Duets y Stitches
  isDuet: {
    type: Boolean,
    default: false
  },

  isStitch: {
    type: Boolean,
    default: false
  },

  originalReel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Reel',
    required: function () {
      return this.isDuet || this.isStitch
    }
  },

  stitchMetadata: {
    startTime: {
      type: Number,
      default: 0,
      min: [0, 'El tiempo de inicio no puede ser negativo']
    },
    duration: {
      type: Number,
      default: 5,
      min: [1, 'La duración del clip debe ser al menos 1 segundo'],
      max: [15, 'La duración del clip no puede exceder 15 segundos']
    }
  },

  // Metadatos del archivo
  metadata: {
    fileSize: {
      type: Number,
      default: 0
    },
    mimeType: {
      type: String,
      default: ''
    },
    originalName: {
      type: String,
      default: ''
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
})

// Índices para mejorar el rendimiento
ReelSchema.index({ user: 1, createdAt: -1 })
ReelSchema.index({ isPublic: 1, isDeleted: 1, isArchived: 1 })
ReelSchema.index({ hashtags: 1 })
ReelSchema.index({ createdAt: -1 })
ReelSchema.index({ 'location.coordinates': '2dsphere' })
// Índices compuestos para queries optimizadas (Fase 1 + Fase 2)
ReelSchema.index({ isPublic: 1, isDeleted: 1, isArchived: 1, createdAt: -1 })
ReelSchema.index({ user: 1, isPublic: 1, isDeleted: 1 })
ReelSchema.index({ isPublic: 1, isDeleted: 1, hashtags: 1 })
// Índices adicionales Fase 2 para trending
ReelSchema.index({ createdAt: -1, views: 1 }) // Para reels trending por vistas

// Virtuals para estadísticas
ReelSchema.virtual('viewsCount').get(function () {
  return this.views.length
})

ReelSchema.virtual('likesCount').get(function () {
  return this.likes.length
})

ReelSchema.virtual('commentsCount').get(function () {
  return this.comments.length
})

ReelSchema.virtual('sharesCount').get(function () {
  return this.shares.length
})

ReelSchema.virtual('duetsCount').get(function () {
  return this.duets.length
})

ReelSchema.virtual('stitchesCount').get(function () {
  return this.stitches.length
})

// Métodos de instancia
ReelSchema.methods.addView = function (userId) {
  const existingView = this.views.find(view => view.user.equals(userId))
  if (!existingView) {
    this.views.push({ user: userId })
    return this.save()
  }
  return this
}

ReelSchema.methods.addLike = function (userId) {
  const existingLike = this.likes.find(like => like.user.equals(userId))
  if (!existingLike) {
    this.likes.push({ user: userId })
    return this.save()
  }
  return this
}

ReelSchema.methods.removeLike = function (userId) {
  this.likes = this.likes.filter(like => !like.user.equals(userId))
  return this.save()
}

ReelSchema.methods.addComment = function (userId, content) {
  this.comments.push({ user: userId, content })
  return this.save()
}

ReelSchema.methods.softDelete = function () {
  this.isDeleted = true
  return this.save()
}

// Middleware pre-save para validaciones
ReelSchema.pre('save', function (next) {
  // Validar que hay video
  if (!this.video.url) {
    return next(new Error('El video es obligatorio para reels'))
  }

  // Validar proporción 9:16 para reels
  if (this.video.width && this.video.height) {
    if (!validateAspectRatio(this.video.width, this.video.height, 'REEL')) {
      return next(new Error(`Los reels deben tener proporción 9:16 (${MEDIA_CONFIG.REEL.width}x${MEDIA_CONFIG.REEL.height}px)`))
    }
  }

  next()
})

export default mongoose.model('Reel', ReelSchema)

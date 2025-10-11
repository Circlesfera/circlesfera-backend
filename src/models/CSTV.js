import mongoose from 'mongoose'

const CSTVSchema = new mongoose.Schema(
  {
    // Información básica
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'El usuario es requerido'],
      index: true
    },
    title: {
      type: String,
      required: [true, 'El título es requerido'],
      maxlength: [100, 'El título no puede exceder 100 caracteres'],
      trim: true
    },
    description: {
      type: String,
      maxlength: [2200, 'La descripción no puede exceder 2200 caracteres'],
      trim: true,
      default: ''
    },

    // Origen del video (si viene de un live stream)
    originalLiveStream: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LiveStream'
    },
    isFromLiveStream: {
      type: Boolean,
      default: false
    },

    // Contenido del video
    video: {
      url: {
        type: String,
        required: [true, 'La URL del video es requerida']
      },
      thumbnail: {
        type: String,
        required: [true, 'La miniatura es requerida']
      },
      duration: {
        type: Number, // en segundos
        required: [true, 'La duración es requerida']
      },
      size: {
        type: Number, // en bytes
        required: [true, 'El tamaño del archivo es requerido']
      },
      resolution: {
        width: {
          type: Number,
          default: 1920
        },
        height: {
          type: Number,
          default: 1080
        }
      },
      format: {
        type: String,
        enum: ['mp4', 'webm', 'mov'],
        default: 'mp4'
      }
    },

    // Configuración de visibilidad
    visibility: {
      type: String,
      enum: ['public', 'followers', 'close_friends', 'private'],
      default: 'public'
    },
    isPublished: {
      type: Boolean,
      default: true
    },
    publishedAt: {
      type: Date,
      default: Date.now
    },

    // Configuración de interacción
    allowComments: {
      type: Boolean,
      default: true
    },
    allowLikes: {
      type: Boolean,
      default: true
    },
    allowShares: {
      type: Boolean,
      default: true
    },

    // Configuración de edad
    ageRestriction: {
      type: String,
      enum: ['all', '13+', '16+', '18+'],
      default: 'all'
    },

    // Categoría y tags
    category: {
      type: String,
      enum: [
        'entertainment',
        'education',
        'gaming',
        'music',
        'sports',
        'lifestyle',
        'comedy',
        'news',
        'technology',
        'cooking',
        'travel',
        'fitness',
        'beauty',
        'art',
        'other'
      ],
      default: 'other'
    },
    tags: [
      {
        type: String,
        trim: true,
        maxlength: [50, 'Cada tag no puede exceder 50 caracteres']
      }
    ],

    // Métricas de engagement
    views: {
      total: {
        type: Number,
        default: 0
      },
      unique: {
        type: Number,
        default: 0
      }
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    comments: {
      type: Number,
      default: 0
    },
    shares: {
      type: Number,
      default: 0
    },
    saves: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],

    // Configuración de monetización
    monetization: {
      enabled: {
        type: Boolean,
        default: false
      },
      type: {
        type: String,
        enum: ['ads', 'subscription', 'donations'],
        default: 'ads'
      },
      revenue: {
        type: Number,
        default: 0
      }
    },

    // Configuración de calidad
    quality: {
      type: String,
      enum: ['360p', '480p', '720p', '1080p', '4k'],
      default: '1080p'
    },

    // Configuración de transcoding
    transcoding: {
      status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed'],
        default: 'pending'
      },
      progress: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
      },
      variants: [
        {
          quality: String,
          url: String,
          size: Number,
          bitrate: Number
        }
      ]
    },

    // Configuración de SEO
    seo: {
      title: String,
      description: String,
      keywords: [String]
    },

    // Configuración de moderación
    moderation: {
      status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'flagged'],
        default: 'approved'
      },
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      reviewedAt: Date,
      reviewNotes: String
    },

    // Configuración de programación
    scheduling: {
      isScheduled: {
        type: Boolean,
        default: false
      },
      scheduledAt: Date,
      timezone: {
        type: String,
        default: 'UTC'
      }
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
)

// Índices para optimización
CSTVSchema.index({ user: 1, publishedAt: -1 })
CSTVSchema.index({ category: 1, publishedAt: -1 })
CSTVSchema.index({ isPublished: 1, publishedAt: -1 })
CSTVSchema.index({ 'views.total': -1 })
CSTVSchema.index({ tags: 1 })
CSTVSchema.index({ title: 'text', description: 'text' })

// Virtual para contar likes
CSTVSchema.virtual('likesCount').get(function () {
  return this.likes.length
})

// Virtual para contar saves
CSTVSchema.virtual('savesCount').get(function () {
  return this.saves.length
})

// Virtual para verificar si un usuario le dio like
CSTVSchema.virtual('isLikedByUser').get(() => 
  // Este virtual se poblará dinámicamente
  false
)

// Virtual para verificar si un usuario guardó el video
CSTVSchema.virtual('isSavedByUser').get(() => 
  // Este virtual se poblará dinámicamente
  false
)

// Virtual para obtener duración formateada
CSTVSchema.virtual('formattedDuration').get(function () {
  const hours = Math.floor(this.video.duration / 3600)
  const minutes = Math.floor((this.video.duration % 3600) / 60)
  const seconds = this.video.duration % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  } 
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
  
})

// Método para agregar view
CSTVSchema.methods.addView = function (userId = null) {
  this.views.total += 1

  // Solo incrementar views únicos si se proporciona userId
  if (userId) {
    // En una implementación real, aquí verificarías si el usuario ya vio el video
    // Por simplicidad, incrementamos siempre
    this.views.unique += 1
  }

  return this.save()
}

// Método para toggle like
CSTVSchema.methods.toggleLike = function (userId) {
  const likeIndex = this.likes.findIndex(
    like => like.toString() === userId.toString()
  )

  if (likeIndex > -1) {
    this.likes.splice(likeIndex, 1)
  } else {
    this.likes.push(userId)
  }

  return this.save()
}

// Método para toggle save
CSTVSchema.methods.toggleSave = function (userId) {
  const saveIndex = this.saves.findIndex(
    save => save.toString() === userId.toString()
  )

  if (saveIndex > -1) {
    this.saves.splice(saveIndex, 1)
  } else {
    this.saves.push(userId)
  }

  return this.save()
}

// Método para programar publicación
CSTVSchema.methods.schedule = function (scheduledAt, timezone = 'UTC') {
  this.scheduling.isScheduled = true
  this.scheduling.scheduledAt = scheduledAt
  this.scheduling.timezone = timezone
  this.isPublished = false
  return this.save()
}

// Método para cancelar programación
CSTVSchema.methods.unschedule = function () {
  this.scheduling.isScheduled = false
  this.scheduling.scheduledAt = null
  this.isPublished = true
  this.publishedAt = new Date()
  return this.save()
}

// Método estático para obtener videos públicos
CSTVSchema.statics.getPublicVideos = function (options = {}) {
  const query = {
    isPublished: true,
    visibility: 'public',
    'moderation.status': 'approved'
  }

  if (options.category) {
    query.category = options.category
  }

  if (options.userId) {
    query.user = options.userId
  }

  return this.find(query)
    .populate('user', 'username avatar fullName isVerified')
    .sort({ publishedAt: -1 })
    .limit(options.limit || 20)
    .skip(options.skip || 0)
}

// Método estático para obtener videos trending
CSTVSchema.statics.getTrendingVideos = function (options = {}) {
  const query = {
    isPublished: true,
    visibility: 'public',
    'moderation.status': 'approved',
    publishedAt: {
      $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Últimos 7 días
    }
  }

  return this.find(query)
    .populate('user', 'username avatar fullName isVerified')
    .sort({ 'views.total': -1, likesCount: -1 })
    .limit(options.limit || 20)
}

// Método estático para buscar videos
CSTVSchema.statics.searchVideos = function (searchTerm, options = {}) {
  const query = {
    isPublished: true,
    visibility: 'public',
    'moderation.status': 'approved',
    $text: { $search: searchTerm }
  }

  return this.find(query)
    .populate('user', 'username avatar fullName isVerified')
    .sort({ score: { $meta: 'textScore' } })
    .limit(options.limit || 20)
}

// Middleware pre-save para generar SEO automático
CSTVSchema.pre('save', function (next) {
  if (this.isNew && !this.seo.title) {
    this.seo.title = this.title
  }

  if (this.isNew && !this.seo.description && this.description) {
    this.seo.description = this.description.substring(0, 160)
  }

  if (this.isNew && this.tags.length > 0 && !this.seo.keywords) {
    this.seo.keywords = this.tags.slice(0, 10) // Máximo 10 keywords
  }

  next()
})

// Middleware post-save para notificar followers
CSTVSchema.post('save', async function () {
  if (this.isNew && this.isPublished) {
    // Aquí podrías agregar lógica para notificar a los seguidores
    // sobre el nuevo video de CSTV usando notificationService
  }
})

export default mongoose.model('CSTV', CSTVSchema)

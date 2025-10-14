import mongoose from 'mongoose'

const AnalyticsEventSchema = new mongoose.Schema({
  // Identificación del evento
  eventType: {
    type: String,
    required: true,
    enum: [
      'user_register',
      'user_login',
      'user_logout',
      'post_create',
      'post_like',
      'post_unlike',
      'post_comment',
      'reel_create',
      'reel_like',
      'reel_unlike',
      'reel_comment',
      'story_create',
      'story_view',
      'follow_user',
      'unfollow_user',
      'user_report',
      'content_report',
      'message_send',
      'profile_view',
      'search_performed',
      'admin_action',
      'system_event'
    ],
    index: true
  },

  // Usuario que realizó la acción (si aplica)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },

  // Usuario objetivo (para acciones como follow, report, etc.)
  targetUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },

  // Contenido relacionado (post, reel, story, comment)
  contentId: {
    type: mongoose.Schema.Types.ObjectId,
    index: true
  },

  contentType: {
    type: String,
    enum: ['post', 'reel', 'story', 'comment', 'message'],
    index: true
  },

  // Datos adicionales del evento
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Información de la sesión
  sessionId: {
    type: String,
    index: true
  },

  // Información del dispositivo y navegador
  userAgent: String,
  ipAddress: {
    type: String,
    index: true
  },

  // Ubicación geográfica (si está disponible)
  location: {
    country: String,
    region: String,
    city: String,
    coordinates: {
      type: [Number], // [longitude, latitude]
      index: '2dsphere'
    }
  },

  // Información de la aplicación
  appVersion: String,
  platform: {
    type: String,
    enum: ['web', 'ios', 'android', 'desktop'],
    default: 'web'
  },

  // Métricas de rendimiento
  performance: {
    responseTime: Number, // tiempo de respuesta en ms
    loadTime: Number, // tiempo de carga en ms
    errorOccurred: {
      type: Boolean,
      default: false
    },
    errorMessage: String
  },

  // Clasificación del evento
  category: {
    type: String,
    enum: ['user_activity', 'content_interaction', 'social_action', 'system', 'admin'],
    required: true,
    index: true
  },

  // Severidad del evento (para alertas)
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low',
    index: true
  },

  // Tags para filtrado y búsqueda
  tags: [{
    type: String,
    index: true
  }],

  // Estado del evento
  status: {
    type: String,
    enum: ['active', 'archived', 'flagged'],
    default: 'active',
    index: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
})

// Índices compuestos para consultas optimizadas
AnalyticsEventSchema.index({ eventType: 1, createdAt: -1 })
AnalyticsEventSchema.index({ userId: 1, eventType: 1, createdAt: -1 })
AnalyticsEventSchema.index({ contentType: 1, createdAt: -1 })
AnalyticsEventSchema.index({ category: 1, createdAt: -1 })
AnalyticsEventSchema.index({ severity: 1, createdAt: -1 })
AnalyticsEventSchema.index({ platform: 1, createdAt: -1 })
AnalyticsEventSchema.index({ 'location.country': 1, createdAt: -1 })

// Índice TTL para limpiar eventos antiguos (opcional, 90 días)
AnalyticsEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 })

// Virtual para obtener el nombre del usuario
AnalyticsEventSchema.virtual('userName', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true,
  options: { select: 'username fullName' }
})

// Virtual para obtener el nombre del usuario objetivo
AnalyticsEventSchema.virtual('targetUserName', {
  ref: 'User',
  localField: 'targetUserId',
  foreignField: '_id',
  justOne: true,
  options: { select: 'username fullName' }
})

// Métodos estáticos para consultas comunes
AnalyticsEventSchema.statics.getEventsByTimeRange = function (startDate, endDate, filters = {}) {
  const query = {
    createdAt: {
      $gte: startDate,
      $lte: endDate
    },
    ...filters
  }

  return this.find(query).sort({ createdAt: -1 })
}

AnalyticsEventSchema.statics.getEventCounts = function (startDate, endDate, groupBy = 'eventType') {
  return this.aggregate([
    {
      $match: {
        createdAt: {
          $gte: startDate,
          $lte: endDate
        }
      }
    },
    {
      $group: {
        _id: `$${groupBy}`,
        count: { $sum: 1 },
        uniqueUsers: { $addToSet: '$userId' }
      }
    },
    {
      $addFields: {
        uniqueUserCount: { $size: '$uniqueUsers' }
      }
    },
    {
      $project: {
        uniqueUsers: 0
      }
    },
    {
      $sort: { count: -1 }
    }
  ])
}

AnalyticsEventSchema.statics.getUserActivity = function (userId, startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        userId: mongoose.Types.ObjectId(userId),
        createdAt: {
          $gte: startDate,
          $lte: endDate
        }
      }
    },
    {
      $group: {
        _id: '$eventType',
        count: { $sum: 1 },
        lastOccurrence: { $max: '$createdAt' }
      }
    },
    {
      $sort: { count: -1 }
    }
  ])
}

AnalyticsEventSchema.statics.getPopularContent = function (startDate, endDate, contentType, limit = 10) {
  return this.aggregate([
    {
      $match: {
        eventType: { $in: [`${contentType}_like`, `${contentType}_comment`, `${contentType}_view`] },
        createdAt: {
          $gte: startDate,
          $lte: endDate
        },
        contentId: { $exists: true }
      }
    },
    {
      $group: {
        _id: '$contentId',
        likes: {
          $sum: {
            $cond: [{ $eq: ['$eventType', `${contentType}_like`] }, 1, 0]
          }
        },
        comments: {
          $sum: {
            $cond: [{ $eq: ['$eventType', `${contentType}_comment`] }, 1, 0]
          }
        },
        views: {
          $sum: {
            $cond: [{ $eq: ['$eventType', `${contentType}_view`] }, 1, 0]
          }
        },
        totalEngagement: {
          $sum: 1
        }
      }
    },
    {
      $sort: { totalEngagement: -1 }
    },
    {
      $limit: limit
    }
  ])
}

AnalyticsEventSchema.statics.getGeographicDistribution = function (startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        createdAt: {
          $gte: startDate,
          $lte: endDate
        },
        'location.country': { $exists: true }
      }
    },
    {
      $group: {
        _id: {
          country: '$location.country',
          region: '$location.region'
        },
        count: { $sum: 1 },
        uniqueUsers: { $addToSet: '$userId' }
      }
    },
    {
      $addFields: {
        uniqueUserCount: { $size: '$uniqueUsers' }
      }
    },
    {
      $project: {
        uniqueUsers: 0
      }
    },
    {
      $sort: { count: -1 }
    }
  ])
}

// Middleware para agregar información automática
AnalyticsEventSchema.pre('save', function (next) {
  // Auto-categorizar eventos si no se especifica
  if (!this.category) {
    const eventTypeCategories = {
      'user_register': 'user_activity',
      'user_login': 'user_activity',
      'user_logout': 'user_activity',
      'post_create': 'content_interaction',
      'post_like': 'content_interaction',
      'post_comment': 'content_interaction',
      'reel_create': 'content_interaction',
      'reel_like': 'content_interaction',
      'reel_comment': 'content_interaction',
      'story_create': 'content_interaction',
      'story_view': 'content_interaction',
      'follow_user': 'social_action',
      'unfollow_user': 'social_action',
      'user_report': 'system',
      'content_report': 'system',
      'admin_action': 'admin'
    }

    this.category = eventTypeCategories[this.eventType] || 'user_activity'
  }

  // Auto-etiquetar eventos críticos
  if (this.eventType.includes('report') || this.eventType === 'admin_action') {
    this.severity = 'high'
    if (!this.tags) this.tags = []
    this.tags.push('moderation')
  }

  next()
})

export default mongoose.model('AnalyticsEvent', AnalyticsEventSchema)

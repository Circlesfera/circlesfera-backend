const mongoose = require('mongoose')

const LiveCommentSchema = new mongoose.Schema(
  {
    // Referencias
    liveStream: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LiveStream',
      required: [true, 'La transmisión en vivo es requerida'],
      index: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'El usuario es requerido']
    },

    // Contenido del comentario
    content: {
      type: String,
      required: [true, 'El contenido es requerido'],
      maxlength: [500, 'El comentario no puede exceder 500 caracteres'],
      trim: true
    },

    // Tipo de comentario
    type: {
      type: String,
      enum: ['comment', 'question', 'reaction', 'system'],
      default: 'comment'
    },

    // Respuesta a otro comentario
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LiveComment'
    },

    // Reacciones al comentario
    reactions: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        type: {
          type: String,
          enum: ['like', 'love', 'laugh', 'wow', 'angry'],
          default: 'like'
        },
        createdAt: {
          type: Date,
          default: Date.now
        }
      }
    ],

    // Configuración de moderación
    isModerated: {
      type: Boolean,
      default: false
    },
    moderatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    moderatedAt: Date,
    moderationReason: {
      type: String,
      enum: ['spam', 'inappropriate', 'harassment', 'hate_speech', 'other']
    },

    // Configuración de visibilidad
    isVisible: {
      type: Boolean,
      default: true
    },
    isPinned: {
      type: Boolean,
      default: false
    },

    // Metadatos
    timestamp: {
      type: Number, // Timestamp en segundos desde el inicio del live
      required: true
    },
    clientId: {
      type: String, // ID único del cliente para evitar duplicados
      sparse: true
    },

    // Configuración de notificaciones
    notifyStreamer: {
      type: Boolean,
      default: true
    },
    notifyCoHosts: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
)

// Índices para optimización
LiveCommentSchema.index({ liveStream: 1, createdAt: -1 })
LiveCommentSchema.index({ liveStream: 1, timestamp: 1 })
LiveCommentSchema.index({ user: 1, createdAt: -1 })
LiveCommentSchema.index({ isVisible: 1, createdAt: -1 })

// Virtual para contar reacciones
LiveCommentSchema.virtual('reactionCount').get(function () {
  return this.reactions.length
})

// Virtual para verificar si un usuario reaccionó
LiveCommentSchema.virtual('userReaction').get(function () {
  // Este virtual se poblará dinámicamente
  return null
})

// Método para agregar reacción
LiveCommentSchema.methods.addReaction = function (
  userId,
  reactionType = 'like'
) {
  // Remover reacción existente del usuario si la hay
  this.reactions = this.reactions.filter(
    reaction => reaction.user.toString() !== userId.toString()
  )

  // Agregar nueva reacción
  this.reactions.push({
    user: userId,
    type: reactionType,
    createdAt: new Date()
  })

  return this.save()
}

// Método para remover reacción
LiveCommentSchema.methods.removeReaction = function (userId) {
  this.reactions = this.reactions.filter(
    reaction => reaction.user.toString() !== userId.toString()
  )
  return this.save()
}

// Método para moderar comentario
LiveCommentSchema.methods.moderate = function (
  moderatorId,
  reason,
  action = 'hide'
) {
  this.isModerated = true
  this.moderatedBy = moderatorId
  this.moderatedAt = new Date()
  this.moderationReason = reason

  if (action === 'hide') {
    this.isVisible = false
  }

  return this.save()
}

// Método para fijar comentario
LiveCommentSchema.methods.pin = function () {
  this.isPinned = true
  return this.save()
}

// Método para desfijar comentario
LiveCommentSchema.methods.unpin = function () {
  this.isPinned = false
  return this.save()
}

// Método estático para obtener comentarios de una transmisión
LiveCommentSchema.statics.getStreamComments = function (
  liveStreamId,
  options = {}
) {
  const query = {
    liveStream: liveStreamId,
    isVisible: true
  }

  // Filtrar por tipo si se especifica
  if (options.type) {
    query.type = options.type
  }

  // Filtrar comentarios fijados primero
  const sortOrder = options.sortByPinned
    ? { isPinned: -1, timestamp: 1 }
    : { timestamp: 1 }

  return this.find(query)
    .populate('user', 'username avatar fullName isVerified')
    .populate('replyTo.user', 'username avatar fullName')
    .populate('reactions.user', 'username avatar')
    .sort(sortOrder)
    .limit(options.limit || 100)
}

// Método estático para obtener comentarios recientes
LiveCommentSchema.statics.getRecentComments = function (
  liveStreamId,
  since = null,
  limit = 50
) {
  const query = {
    liveStream: liveStreamId,
    isVisible: true
  }

  if (since) {
    query.createdAt = { $gt: since }
  }

  return this.find(query)
    .populate('user', 'username avatar fullName isVerified')
    .populate('reactions.user', 'username avatar')
    .sort({ timestamp: 1 })
    .limit(limit)
}

// Método estático para obtener estadísticas de comentarios
LiveCommentSchema.statics.getCommentStats = function (liveStreamId) {
  return this.aggregate([
    { $match: { liveStream: mongoose.Types.ObjectId(liveStreamId) } },
    {
      $group: {
        _id: null,
        totalComments: { $sum: 1 },
        visibleComments: {
          $sum: { $cond: ['$isVisible', 1, 0] }
        },
        moderatedComments: {
          $sum: { $cond: ['$isModerated', 1, 0] }
        },
        pinnedComments: {
          $sum: { $cond: ['$isPinned', 1, 0] }
        },
        totalReactions: {
          $sum: { $size: '$reactions' }
        },
        avgReactionsPerComment: {
          $avg: { $size: '$reactions' }
        }
      }
    }
  ])
}

// Middleware pre-save para validar timestamp
LiveCommentSchema.pre('save', function (next) {
  if (this.isNew && !this.timestamp) {
    // Si no se proporciona timestamp, usar el tiempo actual
    this.timestamp = Math.floor(Date.now() / 1000)
  }
  next()
})

// Middleware post-save para limpiar comentarios antiguos
LiveCommentSchema.post('save', function () {
  // Limpiar comentarios muy antiguos (más de 24 horas)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  this.constructor
    .deleteMany({
      liveStream: this.liveStream,
      createdAt: { $lt: oneDayAgo },
      isPinned: false
    })
    .catch(err => {
      console.error('Error limpiando comentarios antiguos:', err)
    })
})

module.exports = mongoose.model('LiveComment', LiveCommentSchema)

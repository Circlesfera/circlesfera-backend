import mongoose from 'mongoose'

const LiveStreamSchema = new mongoose.Schema(
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
      maxlength: [100, 'El título no puede exceder 100 caracteres'],
      default: 'Transmisión en vivo'
    },
    description: {
      type: String,
      maxlength: [500, 'La descripción no puede exceder 500 caracteres'],
      default: ''
    },

    // Estado de la transmisión
    status: {
      type: String,
      enum: ['scheduled', 'live', 'ended', 'cancelled'],
      default: 'scheduled',
      index: true
    },

    // Configuración de la transmisión
    isPublic: {
      type: Boolean,
      default: true
    },
    allowComments: {
      type: Boolean,
      default: true
    },
    allowShares: {
      type: Boolean,
      default: true
    },

    // Co-hosts (usuarios invitados a transmitir juntos)
    coHosts: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        status: {
          type: String,
          enum: ['invited', 'accepted', 'declined', 'joined', 'left'],
          default: 'invited'
        },
        invitedAt: {
          type: Date,
          default: Date.now
        },
        joinedAt: Date,
        leftAt: Date
      }
    ],

    // Configuración de notificaciones
    notifyFollowers: {
      type: Boolean,
      default: true
    },
    notifyCloseFriends: {
      type: Boolean,
      default: false
    },

    // Métricas de la transmisión
    viewers: {
      current: {
        type: Number,
        default: 0
      },
      peak: {
        type: Number,
        default: 0
      },
      total: {
        type: Number,
        default: 0
      }
    },
    likes: {
      type: Number,
      default: 0
    },
    comments: {
      type: Number,
      default: 0
    },
    shares: {
      type: Number,
      default: 0
    },

    // Configuración de streaming
    streamKey: {
      type: String,
      unique: true,
      sparse: true
    },
    rtmpUrl: {
      type: String
    },
    playbackUrl: {
      type: String
    },
    thumbnailUrl: {
      type: String
    },

    // Timestamps
    scheduledAt: {
      type: Date,
      index: true
    },
    startedAt: Date,
    endedAt: Date,

    // Configuración de guardado
    saveToIGTV: {
      type: Boolean,
      default: false
    },
    igtvTitle: {
      type: String,
      maxlength: [100, 'El título de IGTV no puede exceder 100 caracteres']
    },
    igtvDescription: {
      type: String,
      maxlength: [
        2200,
        'La descripción de IGTV no puede exceder 2200 caracteres'
      ]
    },
    igtvVideoUrl: {
      type: String
    },

    // Configuración de moderación
    moderationSettings: {
      blockComments: {
        type: Boolean,
        default: false
      },
      blockUsers: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        }
      ],
      autoModeration: {
        type: Boolean,
        default: true
      }
    },

    // Configuración de monetización (para futuro)
    monetization: {
      enabled: {
        type: Boolean,
        default: false
      },
      type: {
        type: String,
        enum: ['donations', 'subscriptions', 'ads'],
        default: 'donations'
      }
    },

    // Soft delete
    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
)

// Índices para optimización
LiveStreamSchema.index({ user: 1, status: 1 })
LiveStreamSchema.index({ status: 1, scheduledAt: 1 })
LiveStreamSchema.index({ createdAt: -1 })

// Virtual para duración de la transmisión
LiveStreamSchema.virtual('duration').get(function () {
  if (!this.startedAt) return 0
  const endTime = this.endedAt || new Date()
  return Math.floor((endTime - this.startedAt) / 1000) // en segundos
})

// Virtual para verificar si está en vivo
LiveStreamSchema.virtual('isLive').get(function () {
  return this.status === 'live'
})

// Virtual para verificar si está programado
LiveStreamSchema.virtual('isScheduled').get(function () {
  return this.status === 'scheduled'
})

// Método para iniciar transmisión
LiveStreamSchema.methods.startStream = function (
  streamKey,
  rtmpUrl,
  playbackUrl
) {
  this.status = 'live'
  this.startedAt = new Date()
  this.streamKey = streamKey
  this.rtmpUrl = rtmpUrl
  this.playbackUrl = playbackUrl
  return this.save()
}

// Método para terminar transmisión
LiveStreamSchema.methods.endStream = function () {
  this.status = 'ended'
  this.endedAt = new Date()
  return this.save()
}

// Método para agregar viewer
LiveStreamSchema.methods.addViewer = function () {
  this.viewers.current += 1
  this.viewers.total += 1
  if (this.viewers.current > this.viewers.peak) {
    this.viewers.peak = this.viewers.current
  }
  return this.save()
}

// Método para remover viewer
LiveStreamSchema.methods.removeViewer = function () {
  if (this.viewers.current > 0) {
    this.viewers.current -= 1
  }
  return this.save()
}

// Método para agregar co-host
LiveStreamSchema.methods.addCoHost = function (userId) {
  const existingCoHost = this.coHosts.find(
    coHost => coHost.user.toString() === userId.toString()
  )

  if (existingCoHost) {
    existingCoHost.status = 'accepted'
    existingCoHost.joinedAt = new Date()
  } else {
    this.coHosts.push({
      user: userId,
      status: 'accepted',
      joinedAt: new Date()
    })
  }

  return this.save()
}

// Método para remover co-host
LiveStreamSchema.methods.removeCoHost = function (userId) {
  const coHost = this.coHosts.find(
    coHost => coHost.user.toString() === userId.toString()
  )

  if (coHost) {
    coHost.status = 'left'
    coHost.leftAt = new Date()
  }

  return this.save()
}

// Middleware pre-save para generar stream key único
LiveStreamSchema.pre('save', function (next) {
  if (this.isNew && !this.streamKey) {
    this.streamKey = `live_${this.user}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
  next()
})

// Método estático para obtener transmisiones en vivo
LiveStreamSchema.statics.getLiveStreams = function (options = {}) {
  const query = { status: 'live' }

  if (options.userId) {
    query.user = options.userId
  }

  if (options.isPublic !== undefined) {
    query.isPublic = options.isPublic
  }

  return this.find(query)
    .populate('user', 'username avatar fullName isVerified')
    .populate('coHosts.user', 'username avatar fullName')
    .sort({ startedAt: -1 })
}

// Método estático para obtener transmisiones programadas
LiveStreamSchema.statics.getScheduledStreams = function (options = {}) {
  const query = {
    status: 'scheduled',
    scheduledAt: { $gte: new Date() }
  }

  if (options.userId) {
    query.user = options.userId
  }

  return this.find(query)
    .populate('user', 'username avatar fullName isVerified')
    .sort({ scheduledAt: 1 })
}

export default mongoose.model('LiveStream', LiveStreamSchema)

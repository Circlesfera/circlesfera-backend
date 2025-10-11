import mongoose from 'mongoose'

const PostSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El usuario es requerido']
  },
  type: {
    type: String,
    enum: ['image', 'video'],
    required: [true, 'El tipo de contenido es requerido'],
    default: 'image'
  },
  content: {
    images: [{
      url: {
        type: String,
        required: false
      },
      alt: {
        type: String,
        default: ''
      },
      width: {
        type: Number,
        default: 0
      },
      height: {
        type: Number,
        default: 0
      }
    }],
    video: {
      url: {
        type: String,
        required: false
      },
      duration: {
        type: Number,
        default: 0
      },
      thumbnail: {
        type: String,
        required: false
      },
      width: {
        type: Number,
        default: 0
      },
      height: {
        type: Number,
        default: 0
      }
    },
    aspectRatio: {
      type: String,
      enum: ['1:1', '4:5'], // Instagram aspect ratios (cuadrado y vertical)
      default: '1:1'
    },
    originalAspectRatio: {
      type: Number, // Aspect ratio real de la imagen (ej: 1.333, 0.75, etc)
      default: 1
    }
  },
  caption: {
    type: String,
    maxlength: [2200, 'La descripción no puede exceder 2200 caracteres'],
    default: ''
  },
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
  tags: [{
    type: String,
    maxlength: [50, 'Cada tag no puede exceder 50 caracteres']
  }],
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  comments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment'
  }],
  views: {
    type: Number,
    default: 0,
    min: [0, 'Las vistas no pueden ser negativas']
  },
  shares: {
    type: Number,
    default: 0,
    min: [0, 'Los shares no pueden ser negativos']
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
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
PostSchema.index({ user: 1, createdAt: -1 })
PostSchema.index({ type: 1, createdAt: -1 })
PostSchema.index({ likes: 1 })
PostSchema.index({ tags: 1 })
PostSchema.index({ 'location.coordinates': '2dsphere' })
PostSchema.index({ isPublic: 1, isArchived: 1, isDeleted: 1 })
PostSchema.index({ createdAt: -1 })
// Índices compuestos para queries complejas optimizadas (Fase 1 + Fase 2)
PostSchema.index({ user: 1, isPublic: 1, isDeleted: 1, isArchived: 1, createdAt: -1 })
PostSchema.index({ isPublic: 1, isDeleted: 1, createdAt: -1 })
PostSchema.index({ user: 1, type: 1, isDeleted: 1, createdAt: -1 })
// Índices adicionales Fase 2 para trending y búsquedas
PostSchema.index({ createdAt: -1, views: -1 }) // Para posts recientes y populares
PostSchema.index({ tags: 1, isPublic: 1, isDeleted: 1 }) // Para búsqueda por tags

// Virtuals
PostSchema.virtual('likesCount').get(function () {
  return this.likes.length
})

PostSchema.virtual('commentsCount').get(function () {
  return this.comments.length
})

PostSchema.virtual('engagement').get(function () {
  return this.likesCount + this.commentsCount + this.shares
})

// Métodos de instancia
PostSchema.methods.addLike = function (userId) {
  if (!this.likes) {
    this.likes = []
  }

  const userIdStr = userId.toString()
  if (!this.likes.some(id => id.toString() === userIdStr)) {
    this.likes.push(userId)
    return this.save()
  }
  return Promise.resolve(this)
}

PostSchema.methods.removeLike = function (userId) {
  if (!this.likes) {
    this.likes = []
  }

  const userIdStr = userId.toString()
  this.likes = this.likes.filter(id => id.toString() !== userIdStr)
  return this.save()
}

PostSchema.methods.isLikedBy = function (userId) {
  if (!this.likes || this.likes.length === 0) {
    return false
  }

  const userIdStr = userId.toString()
  return this.likes.some(id => id.toString() === userIdStr)
}

PostSchema.methods.incrementViews = function () {
  this.views += 1
  return this.save()
}

PostSchema.methods.archive = function () {
  this.isArchived = true
  return this.save()
}

PostSchema.methods.unarchive = function () {
  this.isArchived = false
  return this.save()
}

PostSchema.methods.softDelete = function () {
  this.isDeleted = true
  return this.save()
}

// Métodos estáticos
PostSchema.statics.findPublicPosts = function () {
  return this.find({
    isPublic: true,
    isArchived: false,
    isDeleted: false
  })
}

PostSchema.statics.findByUser = function (userId, options = {}) {
  const query = { user: userId, isDeleted: false }

  if (options.includeArchived === false) {
    query.isArchived = false
  }

  return this.find(query).sort({ createdAt: -1 })
}

PostSchema.statics.findTrending = function (limit = 10) {
  return this.find({
    isPublic: true,
    isArchived: false,
    isDeleted: false
  })
    .sort({ engagement: -1, createdAt: -1 })
    .limit(limit)
}

// Middleware pre-save
PostSchema.pre('save', function (next) {
  // Limpiar tags duplicados y vacíos
  if (this.tags) {
    this.tags = [...new Set(this.tags.filter(tag => tag.trim()))]
  }

  // Validar que hay contenido
  if (this.type === 'image' && (!this.content.images || this.content.images.length === 0)) {
    return next(new Error('Las publicaciones de imagen deben tener al menos una imagen'))
  }

  if (this.type === 'video' && !this.content.video.url) {
    return next(new Error('Las publicaciones de video deben tener un video'))
  }


  next()
})

export default mongoose.model('Post', PostSchema)

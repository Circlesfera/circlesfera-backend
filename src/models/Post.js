const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El usuario es requerido'],
    index: true
  },
  type: {
    type: String,
    enum: ['image', 'video', 'text'],
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
    text: {
      type: String,
      maxlength: [5000, 'El texto no puede exceder 5000 caracteres'],
      required: false
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
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number],
        validate: {
          validator: function(v) {
            return v.length === 2 && v[0] >= -180 && v[0] <= 180 && v[1] >= -90 && v[1] <= 90;
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
    ref: 'User',
    index: true
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
});

// Índices para mejorar el rendimiento
PostSchema.index({ user: 1, createdAt: -1 });
PostSchema.index({ type: 1, createdAt: -1 });
PostSchema.index({ likes: 1 });
PostSchema.index({ tags: 1 });
PostSchema.index({ 'location.coordinates': '2dsphere' });
PostSchema.index({ isPublic: 1, isArchived: 1, isDeleted: 1 });
PostSchema.index({ createdAt: -1 });

// Virtuals
PostSchema.virtual('likesCount').get(function() {
  return this.likes.length;
});

PostSchema.virtual('commentsCount').get(function() {
  return this.comments.length;
});

PostSchema.virtual('engagement').get(function() {
  return this.likesCount + this.commentsCount + this.shares;
});

// Métodos de instancia
PostSchema.methods.addLike = function(userId) {
  if (!this.likes.includes(userId)) {
    this.likes.push(userId);
    return this.save();
  }
  return Promise.resolve(this);
};

PostSchema.methods.removeLike = function(userId) {
  this.likes = this.likes.filter(id => !id.equals(userId));
  return this.save();
};

PostSchema.methods.isLikedBy = function(userId) {
  return this.likes.some(id => id.equals(userId));
};

PostSchema.methods.incrementViews = function() {
  this.views += 1;
  return this.save();
};

PostSchema.methods.archive = function() {
  this.isArchived = true;
  return this.save();
};

PostSchema.methods.unarchive = function() {
  this.isArchived = false;
  return this.save();
};

PostSchema.methods.softDelete = function() {
  this.isDeleted = true;
  return this.save();
};

// Métodos estáticos
PostSchema.statics.findPublicPosts = function() {
  return this.find({
    isPublic: true,
    isArchived: false,
    isDeleted: false
  });
};

PostSchema.statics.findByUser = function(userId, options = {}) {
  const query = { user: userId, isDeleted: false };
  
  if (options.includeArchived === false) {
    query.isArchived = false;
  }
  
  return this.find(query).sort({ createdAt: -1 });
};

PostSchema.statics.findTrending = function(limit = 10) {
  return this.find({
    isPublic: true,
    isArchived: false,
    isDeleted: false
  })
  .sort({ engagement: -1, createdAt: -1 })
  .limit(limit);
};

// Middleware pre-save
PostSchema.pre('save', function(next) {
  // Limpiar tags duplicados y vacíos
  if (this.tags) {
    this.tags = [...new Set(this.tags.filter(tag => tag.trim()))];
  }
  
  // Validar que hay contenido
  if (this.type === 'image' && (!this.content.images || this.content.images.length === 0)) {
    return next(new Error('Las publicaciones de imagen deben tener al menos una imagen'));
  }
  
  if (this.type === 'video' && !this.content.video.url) {
    return next(new Error('Las publicaciones de video deben tener un video'));
  }
  
  if (this.type === 'text' && !this.content.text) {
    return next(new Error('Las publicaciones de texto deben tener contenido'));
  }
  
  next();
});

module.exports = mongoose.model('Post', PostSchema);
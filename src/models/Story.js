const mongoose = require('mongoose');

const StorySchema = new mongoose.Schema({
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
    image: {
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
    },
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
      content: {
        type: String,
        maxlength: [500, 'El texto no puede exceder 500 caracteres'],
        required: false
      },
      backgroundColor: {
        type: String,
        default: '#000000'
      },
      textColor: {
        type: String,
        default: '#ffffff'
      },
      fontSize: {
        type: Number,
        default: 24
      },
      fontFamily: {
        type: String,
        default: 'Arial'
      }
    }
  },
  caption: {
    type: String,
    maxlength: [200, 'La descripción no puede exceder 200 caracteres'],
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
  reactions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    type: {
      type: String,
      enum: ['like', 'love', 'laugh', 'wow', 'sad', 'angry'],
      default: 'like'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  replies: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    content: {
      type: String,
      maxlength: [200, 'La respuesta no puede exceder 200 caracteres'],
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
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
  expiresAt: {
    type: Date,
    default: function() {
      // Las historias expiran en 24 horas
      return new Date(Date.now() + 24 * 60 * 60 * 1000);
    }
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
StorySchema.index({ user: 1, createdAt: -1 });
StorySchema.index({ type: 1, createdAt: -1 });
StorySchema.index({ expiresAt: 1 });
StorySchema.index({ isPublic: 1, isArchived: 1, isDeleted: 1 });
StorySchema.index({ createdAt: -1 });
StorySchema.index({ 'location.coordinates': '2dsphere' });

// Virtuals
StorySchema.virtual('viewsCount').get(function() {
  return this.views.length;
});

StorySchema.virtual('reactionsCount').get(function() {
  return this.reactions.length;
});

StorySchema.virtual('repliesCount').get(function() {
  return this.replies.length;
});

StorySchema.virtual('isExpired').get(function() {
  return new Date() > this.expiresAt;
});

StorySchema.virtual('timeLeft').get(function() {
  const now = new Date();
  const expiresAt = new Date(this.expiresAt);
  const diff = expiresAt.getTime() - now.getTime();
  
  if (diff <= 0) return 0;
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  return { hours, minutes };
});

// Métodos de instancia
StorySchema.methods.addView = function(userId) {
  const existingView = this.views.find(view => view.user.toString() === userId);
  if (!existingView) {
    this.views.push({ user: userId });
    return this.save();
  }
  return Promise.resolve(this);
};

StorySchema.methods.addReaction = function(userId, reactionType) {
  const existingReaction = this.reactions.find(reaction => reaction.user.toString() === userId);
  
  if (existingReaction) {
    existingReaction.type = reactionType;
    existingReaction.createdAt = new Date();
  } else {
    this.reactions.push({ user: userId, type: reactionType });
  }
  
  return this.save();
};

StorySchema.methods.removeReaction = function(userId) {
  this.reactions = this.reactions.filter(reaction => !reaction.user.equals(userId));
  return this.save();
};

StorySchema.methods.addReply = function(userId, content) {
  this.replies.push({ user: userId, content });
  return this.save();
};

StorySchema.methods.archive = function() {
  this.isArchived = true;
  return this.save();
};

StorySchema.methods.softDelete = function() {
  this.isDeleted = true;
  return this.save();
};

// Métodos estáticos
StorySchema.statics.findActiveStories = function() {
  const now = new Date();
  return this.find({
    expiresAt: { $gt: now },
    isDeleted: false,
    isArchived: false
  });
};

StorySchema.statics.findByUser = function(userId, options = {}) {
  const query = { user: userId, isDeleted: false };
  
  if (options.includeArchived === false) {
    query.isArchived = false;
  }
  
  if (options.includeExpired === false) {
    query.expiresAt = { $gt: new Date() };
  }
  
  return this.find(query).sort({ createdAt: -1 });
};

StorySchema.statics.findStoriesForFeed = function(userIds) {
  const now = new Date();
  return this.find({
    user: { $in: userIds },
    expiresAt: { $gt: now },
    isDeleted: false,
    isArchived: false,
    isPublic: true
  })
  .populate('user', 'username avatar fullName')
  .sort({ createdAt: -1 });
};

StorySchema.statics.cleanupExpiredStories = function() {
  const now = new Date();
  return this.updateMany(
    { expiresAt: { $lte: now } },
    { $set: { isArchived: true } }
  );
};

// Middleware pre-save
StorySchema.pre('save', function(next) {
  // Validar que hay contenido
  if (this.type === 'image' && !this.content.image.url) {
    return next(new Error('Las historias de imagen deben tener una imagen'));
  }
  
  if (this.type === 'video' && !this.content.video.url) {
    return next(new Error('Las historias de video deben tener un video'));
  }
  
  if (this.type === 'text' && !this.content.text.content) {
    return next(new Error('Las historias de texto deben tener contenido'));
  }
  
  next();
});

// Middleware post-save para notificaciones
StorySchema.post('save', async function() {
  // Aquí podrías agregar lógica para notificar a los seguidores
  // cuando se crea una nueva historia
});

module.exports = mongoose.model('Story', StorySchema);
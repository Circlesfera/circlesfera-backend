const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['image', 'video'],
    required: true,
    default: 'image'
  },
  content: {
    image: {
      type: String,
      required: function() { return this.type === 'image'; }
    },
    video: {
      url: {
        type: String,
        required: function() { return this.type === 'video'; }
      },
      duration: {
        type: Number, // duración en segundos
        required: function() { return this.type === 'video'; }
      },
      thumbnail: {
        type: String,
        required: function() { return this.type === 'video'; }
      }
    }
  },
  caption: {
    type: String,
    maxlength: 7200 // Aumentado para incluir texto + caption
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  views: {
    type: Number,
    default: 0
  },
  isPublic: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

// Índices para mejorar el rendimiento
PostSchema.index({ user: 1, createdAt: -1 });
PostSchema.index({ type: 1, createdAt: -1 });
PostSchema.index({ likes: 1 });

module.exports = mongoose.model('Post', PostSchema);
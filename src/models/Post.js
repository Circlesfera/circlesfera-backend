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
      required: false
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
      }
    }
  },
  caption: {
    type: String,
    maxlength: 7200,
    default: ''
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
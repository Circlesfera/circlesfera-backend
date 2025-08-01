const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El usuario es requerido'],
    index: true
  },
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: [true, 'El post es requerido'],
    index: true
  },
  content: {
    type: String,
    required: [true, 'El contenido del comentario es requerido'],
    maxlength: [1000, 'El comentario no puede exceder 1000 caracteres'],
    trim: true
  },
  parentComment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    default: null
  },
  replies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment'
  }],
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  }],
  isEdited: {
    type: Boolean,
    default: false
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  mentions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices para mejorar el rendimiento
CommentSchema.index({ post: 1, createdAt: -1 });
CommentSchema.index({ user: 1, createdAt: -1 });
CommentSchema.index({ parentComment: 1 });
CommentSchema.index({ likes: 1 });

// Virtuals
CommentSchema.virtual('likesCount').get(function() {
  return this.likes.length;
});

CommentSchema.virtual('repliesCount').get(function() {
  return this.replies.length;
});

// Métodos de instancia
CommentSchema.methods.addLike = function(userId) {
  if (!this.likes.includes(userId)) {
    this.likes.push(userId);
    return this.save();
  }
  return Promise.resolve(this);
};

CommentSchema.methods.removeLike = function(userId) {
  this.likes = this.likes.filter(id => !id.equals(userId));
  return this.save();
};

CommentSchema.methods.isLikedBy = function(userId) {
  return this.likes.some(id => id.equals(userId));
};

CommentSchema.methods.addReply = function(replyId) {
  if (!this.replies.includes(replyId)) {
    this.replies.push(replyId);
    return this.save();
  }
  return Promise.resolve(this);
};

CommentSchema.methods.softDelete = function() {
  this.isDeleted = true;
  this.content = '[Comentario eliminado]';
  return this.save();
};

// Métodos estáticos
CommentSchema.statics.findByPost = function(postId, options = {}) {
  const query = { 
    post: postId, 
    isDeleted: false,
    parentComment: null // Solo comentarios principales
  };
  
  return this.find(query)
    .populate('user', 'username avatar fullName')
    .populate('replies', 'user content createdAt likes')
    .populate('replies.user', 'username avatar fullName')
    .sort({ createdAt: -1 });
};

CommentSchema.statics.findReplies = function(commentId) {
  return this.find({ 
    parentComment: commentId,
    isDeleted: false
  })
  .populate('user', 'username avatar fullName')
  .sort({ createdAt: 1 });
};

// Middleware pre-save
CommentSchema.pre('save', function(next) {
  // Detectar menciones en el contenido
  const mentionRegex = /@(\w+)/g;
  const mentions = [];
  let match;
  
  while ((match = mentionRegex.exec(this.content)) !== null) {
    // Aquí podrías buscar usuarios por username y agregar sus IDs
    // Por ahora solo guardamos el patrón
  }
  
  this.mentions = mentions;
  next();
});

// Middleware post-save para actualizar el post
CommentSchema.post('save', async function() {
  const Post = require('./Post');
  await Post.findByIdAndUpdate(this.post, {
    $addToSet: { comments: this._id }
  });
});

// Middleware post-remove para limpiar referencias
CommentSchema.post('remove', async function() {
  const Post = require('./Post');
  await Post.findByIdAndUpdate(this.post, {
    $pull: { comments: this._id }
  });
});

module.exports = mongoose.model('Comment', CommentSchema);
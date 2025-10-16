import mongoose from 'mongoose'
import Post from './Post.js'

const CommentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El usuario es requerido']
  },
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: [true, 'El post es requerido']
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
    ref: 'User'
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
  }],
  reports: [{
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    reason: {
      type: String,
      required: true,
      enum: ['spam', 'harassment', 'inappropriate', 'hate_speech', 'false_info', 'other']
    },
    description: {
      type: String,
      maxlength: [500, 'La descripción no puede exceder 500 caracteres'],
      trim: true
    },
    reportedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
})

// Índices para mejorar el rendimiento
CommentSchema.index({ post: 1, createdAt: -1 })
CommentSchema.index({ user: 1, createdAt: -1 })
CommentSchema.index({ parentComment: 1 })
CommentSchema.index({ likes: 1 })
// Índices compuestos para queries optimizadas
CommentSchema.index({ post: 1, parentComment: 1, createdAt: -1 })
CommentSchema.index({ user: 1, post: 1, createdAt: -1 })
CommentSchema.index({ 'reports.reportedBy': 1 })
CommentSchema.index({ 'reports.reason': 1 })

// Virtuals
CommentSchema.virtual('likesCount').get(function () {
  return this.likes.length
})

CommentSchema.virtual('repliesCount').get(function () {
  return this.replies.length
})

CommentSchema.virtual('reportsCount').get(function () {
  return this.reports.length
})

// Métodos de instancia
CommentSchema.methods.addLike = function (userId) {
  if (!this.likes.includes(userId)) {
    this.likes.push(userId)
    return this.save()
  }
  return Promise.resolve(this)
}

CommentSchema.methods.removeLike = function (userId) {
  this.likes = this.likes.filter(id => !id.equals(userId))
  return this.save()
}

CommentSchema.methods.isLikedBy = function (userId) {
  return this.likes.some(id => id.equals(userId))
}

CommentSchema.methods.addReply = function (replyId) {
  if (!this.replies.includes(replyId)) {
    this.replies.push(replyId)
    return this.save()
  }
  return Promise.resolve(this)
}

CommentSchema.methods.softDelete = function () {
  this.isDeleted = true
  this.content = '[Comentario eliminado]'
  return this.save()
}

// Métodos estáticos
CommentSchema.statics.findByPost = function (postId, options = {}) {
  const query = {
    post: postId,
    isDeleted: false,
    parentComment: null // Solo comentarios principales
  }

  let queryBuilder = this.find(query)
    .populate('user', 'username avatar fullName')
    .populate('replies', 'user content createdAt likes')
    .populate('replies.user', 'username avatar fullName')
    .sort({ createdAt: -1 })

  // Aplicar opciones si están presentes
  if (options.limit) {
    queryBuilder = queryBuilder.limit(options.limit)
  }
  if (options.skip) {
    queryBuilder = queryBuilder.skip(options.skip)
  }

  return queryBuilder
}

CommentSchema.statics.findReplies = function (commentId) {
  return this.find({
    parentComment: commentId,
    isDeleted: false
  })
    .populate('user', 'username avatar fullName')
    .sort({ createdAt: 1 })
}

// Middleware pre-save
CommentSchema.pre('save', function (next) {
  // Detectar menciones en el contenido
  // const mentionRegex = /@(\w+)/g;
  const mentions = []

  // TODO: Implementar extracción de menciones
  // const matches = this.content.matchAll(mentionRegex);
  // for (const match of matches) {
  //   mentions.push(match[1]);
  // }

  this.mentions = mentions
  next()
})

// Middleware post-save para actualizar el post
CommentSchema.post('save', async function () {
  await Post.findByIdAndUpdate(this.post, {
    $addToSet: { comments: this._id }
  })
})

// Middleware post-remove para limpiar referencias
CommentSchema.post('remove', async function () {
  await Post.findByIdAndUpdate(this.post, {
    $pull: { comments: this._id }
  })
})

export default mongoose.model('Comment', CommentSchema)

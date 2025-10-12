import mongoose from 'mongoose'

const ReportSchema = new mongoose.Schema({
  // Usuario que reporta
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El usuario que reporta es requerido']
  },

  // Contenido reportado
  contentType: {
    type: String,
    enum: ['post', 'reel', 'story', 'comment', 'user', 'live_stream', 'message'],
    required: [true, 'El tipo de contenido es requerido']
  },

  contentId: {
    type: mongoose.Schema.Types.ObjectId,
    required: [true, 'El ID del contenido es requerido'],
    refPath: 'contentModel'
  },

  // Modelo dinámico según contentType
  contentModel: {
    type: String,
    required: true,
    enum: ['Post', 'Reel', 'Story', 'Comment', 'User', 'LiveStream', 'Message']
  },

  // Razón del reporte
  reason: {
    type: String,
    enum: [
      'spam',
      'harassment',
      'hate_speech',
      'violence',
      'nudity',
      'false_information',
      'copyright',
      'suicide_or_self_harm',
      'scam',
      'terrorism',
      'other'
    ],
    required: [true, 'La razón del reporte es requerida']
  },

  // Descripción adicional
  description: {
    type: String,
    maxlength: [500, 'La descripción no puede exceder 500 caracteres'],
    trim: true
  },

  // Estado del reporte
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
    default: 'pending'
  },

  // Acción tomada por moderadores
  action: {
    type: String,
    enum: ['none', 'warning', 'content_removed', 'user_banned', 'user_suspended'],
    default: 'none'
  },

  // Moderador que revisó
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  reviewedAt: {
    type: Date
  },

  // Notas del moderador
  moderatorNotes: {
    type: String,
    maxlength: [1000, 'Las notas no pueden exceder 1000 caracteres']
  },

  // Metadata
  ipAddress: {
    type: String
  },

  userAgent: {
    type: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
})

// Índices
ReportSchema.index({ reportedBy: 1, createdAt: -1 })
ReportSchema.index({ contentType: 1, contentId: 1 })
ReportSchema.index({ status: 1, createdAt: -1 })
ReportSchema.index({ reason: 1, status: 1 })
// Índice compuesto para queries de moderación
ReportSchema.index({ status: 1, reason: 1, createdAt: -1 })

// Virtual para poblar el contenido reportado
ReportSchema.virtual('reportedContent', {
  refPath: 'contentModel',
  localField: 'contentId',
  foreignField: '_id',
  justOne: true
})

// Métodos estáticos
ReportSchema.statics.findPendingReports = function (limit = 20) {
  return this.find({ status: 'pending' })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('reportedBy', 'username avatar')
    .populate('reportedContent')
}

ReportSchema.statics.findByContent = function (contentType, contentId) {
  return this.find({
    contentType,
    contentId
  })
    .sort({ createdAt: -1 })
    .populate('reportedBy', 'username avatar')
}

ReportSchema.statics.getReportStats = async function () {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ])

  return stats.reduce((acc, stat) => {
    acc[stat._id] = stat.count
    return acc
  }, {})
}

// Métodos de instancia
ReportSchema.methods.markAsReviewed = function (moderatorId, action, notes) {
  this.status = 'reviewed'
  this.reviewedBy = moderatorId
  this.reviewedAt = new Date()
  this.action = action
  this.moderatorNotes = notes
  return this.save()
}

ReportSchema.methods.resolve = function (moderatorId, action, notes) {
  this.status = 'resolved'
  this.reviewedBy = moderatorId
  this.reviewedAt = new Date()
  this.action = action
  this.moderatorNotes = notes
  return this.save()
}

ReportSchema.methods.dismiss = function (moderatorId, reason) {
  this.status = 'dismissed'
  this.reviewedBy = moderatorId
  this.reviewedAt = new Date()
  this.moderatorNotes = reason
  return this.save()
}

// Mapeo de contentType a modelo
ReportSchema.pre('validate', function (next) {
  const contentTypeToModel = {
    post: 'Post',
    reel: 'Reel',
    story: 'Story',
    comment: 'Comment',
    user: 'User',
    live_stream: 'LiveStream',
    message: 'Message'
  }

  if (this.contentType && !this.contentModel) {
    this.contentModel = contentTypeToModel[this.contentType]
  }

  next()
})

export default mongoose.model('Report', ReportSchema)


const mongoose = require('mongoose')

const MessageSchema = new mongoose.Schema({
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: [true, 'La conversación es requerida'],
    index: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El remitente es requerido'],
    index: true
  },
  type: {
    type: String,
    enum: ['text', 'image', 'video', 'audio', 'file', 'location', 'contact'],
    default: 'text'
  },
  content: {
    text: {
      type: String,
      maxlength: [5000, 'El texto no puede exceder 5000 caracteres'],
      required: false
    },
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
    audio: {
      url: {
        type: String,
        required: false
      },
      duration: {
        type: Number,
        default: 0
      }
    },
    file: {
      url: {
        type: String,
        required: false
      },
      name: {
        type: String,
        default: ''
      },
      size: {
        type: Number,
        default: 0
      },
      mimeType: {
        type: String,
        default: ''
      }
    },
    location: {
      latitude: {
        type: Number,
        required: false
      },
      longitude: {
        type: Number,
        required: false
      },
      name: {
        type: String,
        default: ''
      },
      address: {
        type: String,
        default: ''
      }
    },
    contact: {
      name: {
        type: String,
        required: false
      },
      phone: {
        type: String,
        required: false
      },
      email: {
        type: String,
        required: false
      }
    }
  },
  // Estado del mensaje
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent'
  },
  // Para mensajes editados
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date,
    default: null
  },
  // Para mensajes eliminados
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  },
  // Para mensajes reenviados
  isForwarded: {
    type: Boolean,
    default: false
  },
  originalMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },
  // Para mensajes con respuesta
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },
  // Metadatos
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
MessageSchema.index({ conversation: 1, createdAt: -1 })
MessageSchema.index({ sender: 1, createdAt: -1 })
MessageSchema.index({ status: 1 })
MessageSchema.index({ isDeleted: 1 })
MessageSchema.index({ createdAt: -1 })

// Virtuals
MessageSchema.virtual('isText').get(function() {
  return this.type === 'text'
})

MessageSchema.virtual('isMedia').get(function() {
  return ['image', 'video', 'audio', 'file'].includes(this.type)
})

MessageSchema.virtual('isLocation').get(function() {
  return this.type === 'location'
})

MessageSchema.virtual('isContact').get(function() {
  return this.type === 'contact'
})

// Métodos de instancia
MessageSchema.methods.markAsDelivered = function() {
  this.status = 'delivered'
  return this.save()
}

MessageSchema.methods.markAsRead = function() {
  this.status = 'read'
  return this.save()
}

MessageSchema.methods.edit = function(newContent) {
  this.content = newContent
  this.isEdited = true
  this.editedAt = new Date()
  return this.save()
}

MessageSchema.methods.softDelete = function() {
  this.isDeleted = true
  this.deletedAt = new Date()
  return this.save()
}

MessageSchema.methods.forward = function(targetConversationId) {
  const Message = require('./Message')
  const forwardedMessage = new Message({
    conversation: targetConversationId,
    sender: this.sender,
    type: this.type,
    content: this.content,
    isForwarded: true,
    originalMessage: this._id
  })
  return forwardedMessage.save()
}

// Métodos estáticos
MessageSchema.statics.findByConversation = function(conversationId, options = {}) {
  const query = {
    conversation: conversationId,
    isDeleted: false
  }

  if (options.beforeId) {
    query._id = { $lt: options.beforeId }
  }

  if (options.afterId) {
    query._id = { $gt: options.afterId }
  }

  return this.find(query)
    .populate('sender', 'username avatar fullName')
    .populate('replyTo', 'content sender')
    .populate('originalMessage', 'content sender')
    .sort({ createdAt: -1 })
    .limit(options.limit || 50)
}

MessageSchema.statics.findUnreadMessages = function(conversationId, userId) {
  return this.find({
    conversation: conversationId,
    sender: { $ne: userId },
    status: { $ne: 'read' },
    isDeleted: false
  })
}

MessageSchema.statics.markConversationAsRead = function(conversationId, userId) {
  return this.updateMany(
    {
      conversation: conversationId,
      sender: { $ne: userId },
      status: { $ne: 'read' },
      isDeleted: false
    },
    { $set: { status: 'read' } }
  )
}

MessageSchema.statics.searchMessages = function(conversationId, query, options = {}) {
  const searchQuery = {
    conversation: conversationId,
    isDeleted: false,
    'content.text': { $regex: query, $options: 'i' }
  }

  return this.find(searchQuery)
    .populate('sender', 'username avatar fullName')
    .sort({ createdAt: -1 })
    .limit(options.limit || 20)
}

MessageSchema.statics.getMessageStats = function(conversationId) {
  return this.aggregate([
    { $match: { conversation: mongoose.Types.ObjectId(conversationId), isDeleted: false } },
    { $group: {
      _id: '$type',
      count: { $sum: 1 }
    } },
    { $sort: { count: -1 } }
  ])
}

// Middleware pre-save
MessageSchema.pre('save', function(next) {
  // Validar que hay contenido según el tipo
  if (this.type === 'text' && !this.content.text) {
    return next(new Error('Los mensajes de texto deben tener contenido'))
  }

  if (this.type === 'image' && !this.content.image.url) {
    return next(new Error('Los mensajes de imagen deben tener una URL'))
  }

  if (this.type === 'video' && !this.content.video.url) {
    return next(new Error('Los mensajes de video deben tener una URL'))
  }

  if (this.type === 'audio' && !this.content.audio.url) {
    return next(new Error('Los mensajes de audio deben tener una URL'))
  }

  if (this.type === 'file' && !this.content.file.url) {
    return next(new Error('Los mensajes de archivo deben tener una URL'))
  }

  if (this.type === 'location' && (!this.content.location.latitude || !this.content.location.longitude)) {
    return next(new Error('Los mensajes de ubicación deben tener coordenadas'))
  }

  if (this.type === 'contact' && (!this.content.contact.name || !this.content.contact.phone)) {
    return next(new Error('Los mensajes de contacto deben tener nombre y teléfono'))
  }

  next()
})

// Middleware post-save para actualizar la conversación
MessageSchema.post('save', async function() {
  const Conversation = require('./Conversation')

  // Actualizar último mensaje de la conversación
  await Conversation.findByIdAndUpdate(this.conversation, {
    $set: {
      'lastMessage.content': this.content.text || this.content.image?.url || this.content.video?.url || 'Mensaje',
      'lastMessage.sender': this.sender,
      'lastMessage.type': this.type,
      'lastMessage.timestamp': this.createdAt
    },
    $inc: { 'metadata.messageCount': 1 }
  })

  // Incrementar contador de no leídos para otros participantes
  const conversation = await Conversation.findById(this.conversation)
  if (conversation) {
    for (const participantId of conversation.participants) {
      if (participantId.toString() !== this.sender.toString()) {
        await conversation.incrementUnreadCount(participantId)
      }
    }
  }
})

module.exports = mongoose.model('Message', MessageSchema)

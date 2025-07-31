const mongoose = require('mongoose');

const ConversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  type: {
    type: String,
    enum: ['direct', 'group'],
    default: 'direct'
  },
  name: {
    type: String,
    maxlength: [100, 'El nombre no puede exceder 100 caracteres'],
    default: ''
  },
  description: {
    type: String,
    maxlength: [500, 'La descripción no puede exceder 500 caracteres'],
    default: ''
  },
  avatar: {
    type: String,
    default: ''
  },
  // Para conversaciones grupales
  admins: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // Último mensaje para mostrar en la lista
  lastMessage: {
    content: {
      type: String,
      maxlength: [1000, 'El contenido no puede exceder 1000 caracteres']
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    type: {
      type: String,
      enum: ['text', 'image', 'video', 'audio', 'file'],
      default: 'text'
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  // Configuración de la conversación
  settings: {
    isActive: {
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
    // Configuraciones específicas por usuario
    userSettings: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      isMuted: {
        type: Boolean,
        default: false
      },
      isPinned: {
        type: Boolean,
        default: false
      },
      lastRead: {
        type: Date,
        default: Date.now
      },
      unreadCount: {
        type: Number,
        default: 0
      }
    }]
  },
  // Metadatos
  metadata: {
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    },
    messageCount: {
      type: Number,
      default: 0
    },
    participantCount: {
      type: Number,
      default: 0
    }
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices para mejorar el rendimiento
ConversationSchema.index({ participants: 1 });
ConversationSchema.index({ type: 1 });
ConversationSchema.index({ 'lastMessage.timestamp': -1 });
ConversationSchema.index({ 'settings.isActive': 1, 'settings.isArchived': 1, 'settings.isDeleted': 1 });
ConversationSchema.index({ createdAt: -1 });

// Virtuals
ConversationSchema.virtual('isGroup').get(function() {
  return this.type === 'group';
});

ConversationSchema.virtual('isDirect').get(function() {
  return this.type === 'direct';
});

// Métodos de instancia
ConversationSchema.methods.addParticipant = function(userId) {
  if (!this.participants.includes(userId)) {
    this.participants.push(userId);
    this.metadata.participantCount = this.participants.length;
    return this.save();
  }
  return Promise.resolve(this);
};

ConversationSchema.methods.removeParticipant = function(userId) {
  this.participants = this.participants.filter(id => !id.equals(userId));
  this.metadata.participantCount = this.participants.length;
  return this.save();
};

ConversationSchema.methods.addAdmin = function(userId) {
  if (!this.admins.includes(userId)) {
    this.admins.push(userId);
    return this.save();
  }
  return Promise.resolve(this);
};

ConversationSchema.methods.removeAdmin = function(userId) {
  this.admins = this.admins.filter(id => !id.equals(userId));
  return this.save();
};

ConversationSchema.methods.updateLastMessage = function(message) {
  this.lastMessage = {
    content: message.content,
    sender: message.sender,
    type: message.type,
    timestamp: new Date()
  };
  this.metadata.messageCount += 1;
  this.metadata.updatedAt = new Date();
  return this.save();
};

ConversationSchema.methods.markAsRead = function(userId) {
  const userSetting = this.settings.userSettings.find(setting => 
    setting.user.toString() === userId
  );
  
  if (userSetting) {
    userSetting.lastRead = new Date();
    userSetting.unreadCount = 0;
  } else {
    this.settings.userSettings.push({
      user: userId,
      lastRead: new Date(),
      unreadCount: 0
    });
  }
  
  return this.save();
};

ConversationSchema.methods.incrementUnreadCount = function(userId) {
  const userSetting = this.settings.userSettings.find(setting => 
    setting.user.toString() === userId
  );
  
  if (userSetting) {
    userSetting.unreadCount += 1;
  } else {
    this.settings.userSettings.push({
      user: userId,
      unreadCount: 1
    });
  }
  
  return this.save();
};

ConversationSchema.methods.toggleMute = function(userId) {
  const userSetting = this.settings.userSettings.find(setting => 
    setting.user.toString() === userId
  );
  
  if (userSetting) {
    userSetting.isMuted = !userSetting.isMuted;
  } else {
    this.settings.userSettings.push({
      user: userId,
      isMuted: true
    });
  }
  
  return this.save();
};

ConversationSchema.methods.togglePin = function(userId) {
  const userSetting = this.settings.userSettings.find(setting => 
    setting.user.toString() === userId
  );
  
  if (userSetting) {
    userSetting.isPinned = !userSetting.isPinned;
  } else {
    this.settings.userSettings.push({
      user: userId,
      isPinned: true
    });
  }
  
  return this.save();
};

ConversationSchema.methods.archive = function() {
  this.settings.isArchived = true;
  return this.save();
};

ConversationSchema.methods.unarchive = function() {
  this.settings.isArchived = false;
  return this.save();
};

ConversationSchema.methods.softDelete = function() {
  this.settings.isDeleted = true;
  return this.save();
};

// Métodos estáticos
ConversationSchema.statics.findByUser = function(userId, options = {}) {
  const query = { 
    participants: userId,
    'settings.isDeleted': false
  };
  
  if (options.activeOnly) {
    query['settings.isActive'] = true;
  }
  
  if (options.archivedOnly) {
    query['settings.isArchived'] = true;
  } else if (options.excludeArchived) {
    query['settings.isArchived'] = false;
  }
  
  return this.find(query)
    .populate('participants', 'username avatar fullName')
    .populate('lastMessage.sender', 'username avatar')
    .populate('admins', 'username avatar')
    .sort({ 'lastMessage.timestamp': -1 });
};

ConversationSchema.statics.findDirectConversation = function(userId1, userId2) {
  return this.findOne({
    type: 'direct',
    participants: { $all: [userId1, userId2] },
    'settings.isDeleted': false
  });
};

ConversationSchema.statics.findOrCreateDirectConversation = async function(userId1, userId2) {
  let conversation = await this.findDirectConversation(userId1, userId2);
  
  if (!conversation) {
    conversation = new this({
      participants: [userId1, userId2],
      type: 'direct',
      metadata: {
        participantCount: 2
      }
    });
    await conversation.save();
  }
  
  return conversation;
};

ConversationSchema.statics.getUnreadCount = function(userId) {
  return this.aggregate([
    { $match: { participants: mongoose.Types.ObjectId(userId), 'settings.isDeleted': false } },
    { $unwind: '$settings.userSettings' },
    { $match: { 'settings.userSettings.user': mongoose.Types.ObjectId(userId) } },
    { $group: {
      _id: null,
      totalUnread: { $sum: '$settings.userSettings.unreadCount' }
    }}
  ]);
};

// Middleware pre-save
ConversationSchema.pre('save', function(next) {
  // Actualizar metadatos
  this.metadata.participantCount = this.participants.length;
  this.metadata.updatedAt = new Date();
  
  // Para conversaciones directas, asegurar que solo hay 2 participantes
  if (this.type === 'direct' && this.participants.length !== 2) {
    return next(new Error('Las conversaciones directas deben tener exactamente 2 participantes'));
  }
  
  next();
});

module.exports = mongoose.model('Conversation', ConversationSchema);
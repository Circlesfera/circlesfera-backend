const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El usuario es requerido'],
    index: true
  },
  from: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El usuario que genera la notificación es requerido'],
    index: true
  },
  type: {
    type: String,
    enum: [
      'follow',
      'unfollow', 
      'like',
      'comment',
      'comment_like',
      'story',
      'story_reply',
      'mention',
      'post_share',
      'account_update',
      'security_alert'
    ],
    required: [true, 'El tipo de notificación es requerido']
  },
  title: {
    type: String,
    maxlength: [100, 'El título no puede exceder 100 caracteres'],
    // required: [true, 'El título es requerido']
  },
  message: {
    type: String,
    maxlength: [500, 'El mensaje no puede exceder 500 caracteres'],
    required: [true, 'El mensaje es requerido']
  },
  data: {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post'
    },
    comment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment'
    },
    story: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Story'
    },
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation'
    },
    message: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message'
    },
    // Datos adicionales específicos del tipo
    extra: {
      type: mongoose.Schema.Types.Mixed
    }
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  expiresAt: {
    type: Date,
    default: function() {
      // Las notificaciones expiran en 30 días por defecto
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices para mejorar el rendimiento
NotificationSchema.index({ user: 1, createdAt: -1 });
NotificationSchema.index({ user: 1, isRead: 1 });
NotificationSchema.index({ user: 1, type: 1 });
NotificationSchema.index({ from: 1, createdAt: -1 });
NotificationSchema.index({ expiresAt: 1 });
NotificationSchema.index({ isDeleted: 1 });

// Virtuals
NotificationSchema.virtual('isExpired').get(function() {
  return new Date() > this.expiresAt;
});

NotificationSchema.virtual('timeAgo').get(function() {
  const now = new Date();
  const createdAt = new Date(this.createdAt);
  const diffInSeconds = Math.floor((now.getTime() - createdAt.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'ahora';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d`;
  return createdAt.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });
});

// Métodos de instancia
NotificationSchema.methods.markAsRead = function() {
  this.isRead = true;
  return this.save();
};

NotificationSchema.methods.markAsUnread = function() {
  this.isRead = false;
  return this.save();
};

NotificationSchema.methods.softDelete = function() {
  this.isDeleted = true;
  return this.save();
};

// Métodos estáticos
NotificationSchema.statics.findByUser = function(userId, options = {}) {
  const query = { 
    user: userId, 
    isDeleted: false 
  };
  
  if (options.unreadOnly) {
    query.isRead = false;
  }
  
  if (options.type) {
    query.type = options.type;
  }
  
  return this.find(query)
    .populate('from', 'username avatar fullName')
    .populate('data.post', 'caption content')
    .populate('data.comment', 'content')
    .populate('data.story', 'caption content')
    .sort({ createdAt: -1 });
};

NotificationSchema.statics.getUnreadCount = function(userId) {
  return this.countDocuments({
    user: userId,
    isRead: false,
    isDeleted: false
  });
};

NotificationSchema.statics.markAllAsRead = function(userId) {
  return this.updateMany(
    { user: userId, isRead: false, isDeleted: false },
    { $set: { isRead: true } }
  );
};

NotificationSchema.statics.deleteOldNotifications = function(days = 30) {
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return this.updateMany(
    { createdAt: { $lt: cutoffDate }, isRead: true },
    { $set: { isDeleted: true } }
  );
};

// Middleware pre-save para generar título y mensaje automáticamente
NotificationSchema.pre('save', function(next) {
  if (!this.title || !this.message) {
    const titles = {
      follow: 'Nuevo seguidor',
      unfollow: 'Usuario dejó de seguirte',
      like: 'Nuevo me gusta',
      comment: 'Nuevo comentario',
      comment_like: 'Me gusta en comentario',
      story: 'Nueva historia',
      story_reply: 'Respuesta a historia',
      mention: 'Mencionado en publicación',
      post_share: 'Publicación compartida',
      account_update: 'Actualización de cuenta',
      security_alert: 'Alerta de seguridad'
    };

    const messages = {
      follow: 'comenzó a seguirte',
      unfollow: 'dejó de seguirte',
      like: 'le gustó tu publicación',
      comment: 'comentó en tu publicación',
      comment_like: 'le gustó tu comentario',
      story: 'subió una nueva historia',
      story_reply: 'respondió a tu historia',
      mention: 'te mencionó en una publicación',
      post_share: 'compartió tu publicación',
      account_update: 'tu cuenta fue actualizada',
      security_alert: 'actividad sospechosa detectada'
    };

    if (!this.title) {
      this.title = titles[this.type] || 'Nueva notificación';
    }
    
    if (!this.message) {
      this.message = messages[this.type] || 'Tienes una nueva notificación';
    }
  }
  
  next();
});

// Middleware post-save para limpiar notificaciones antiguas
NotificationSchema.post('save', async function() {
  // Limpiar notificaciones antiguas si hay más de 1000
  const count = await this.constructor.countDocuments({ user: this.user });
  if (count > 1000) {
    await this.constructor.deleteOldNotifications(7); // Mantener solo 7 días
  }
});

module.exports = mongoose.model('Notification', NotificationSchema);
const mongoose = require('mongoose');

/**
 * Esquema para almacenar eventos de analytics
 */
const analyticsEventSchema = new mongoose.Schema(
  {
    // Tipo de evento
    event: {
      type: String,
      required: [true, 'El tipo de evento es requerido'],
      enum: [
        'page_view',
        'post_created',
        'post_liked',
        'post_shared',
        'post_commented',
        'reel_viewed',
        'reel_created',
        'reel_liked',
        'story_viewed',
        'story_created',
        'user_followed',
        'message_sent',
        'search_performed',
        'profile_viewed',
        'settings_changed',
      ],
      index: true,
    },

    // Usuario que generó el evento (opcional si no está autenticado)
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },

    // Categoría del evento
    category: {
      type: String,
      required: true,
      index: true,
    },

    // Acción realizada
    action: {
      type: String,
      required: true,
    },

    // Etiqueta adicional
    label: {
      type: String,
      index: true,
    },

    // Valor numérico (opcional)
    value: {
      type: Number,
    },

    // Metadata adicional
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },

    // Información de la sesión
    sessionId: {
      type: String,
      index: true,
    },

    // Información del navegador/dispositivo
    userAgent: String,
    ipAddress: String,
    language: String,
    screenResolution: String,
    viewport: String,

    // Referrer
    referrer: String,

    // Timestamp
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Índices compuestos para consultas comunes
analyticsEventSchema.index({ user: 1, event: 1, timestamp: -1 });
analyticsEventSchema.index({ event: 1, timestamp: -1 });
analyticsEventSchema.index({ category: 1, timestamp: -1 });

// Método estático para obtener estadísticas
analyticsEventSchema.statics.getStats = async function (filters = {}) {
  const stats = await this.aggregate([
    {
      $match: filters,
    },
    {
      $group: {
        _id: '$event',
        count: { $sum: 1 },
        uniqueUsers: { $addToSet: '$user' },
      },
    },
    {
      $project: {
        event: '$_id',
        count: 1,
        uniqueUsers: { $size: '$uniqueUsers' },
      },
    },
    {
      $sort: { count: -1 },
    },
  ]);

  return stats;
};

// TTL index para auto-eliminar eventos antiguos (después de 90 días)
analyticsEventSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7776000 });

module.exports = mongoose.model('AnalyticsEvent', analyticsEventSchema);

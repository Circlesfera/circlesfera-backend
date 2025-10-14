import mongoose from 'mongoose'

const AnalyticsMetricSchema = new mongoose.Schema({
  // Identificación de la métrica
  metricType: {
    type: String,
    required: true,
    enum: [
      'daily_active_users',
      'monthly_active_users',
      'new_registrations',
      'content_created',
      'content_engagement',
      'user_retention',
      'geographic_distribution',
      'platform_usage',
      'error_rates',
      'performance_metrics',
      'revenue_metrics',
      'moderation_metrics'
    ],
    index: true
  },

  // Período de tiempo
  period: {
    type: String,
    required: true,
    enum: ['hourly', 'daily', 'weekly', 'monthly', 'yearly'],
    index: true
  },

  // Fecha de inicio del período
  periodStart: {
    type: Date,
    required: true
  },

  // Fecha de fin del período
  periodEnd: {
    type: Date,
    required: true,
    index: true
  },

  // Datos de la métrica
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },

  // Metadatos adicionales
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Estado de la métrica
  status: {
    type: String,
    enum: ['active', 'archived', 'error'],
    default: 'active',
    index: true
  },

  // Timestamp de última actualización
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
})

// Índices compuestos para consultas optimizadas
AnalyticsMetricSchema.index({ metricType: 1, period: 1, periodStart: -1 })
AnalyticsMetricSchema.index({ metricType: 1, periodStart: -1, periodEnd: 1 })
AnalyticsMetricSchema.index({ period: 1, periodStart: -1 })
AnalyticsMetricSchema.index({ status: 1, lastUpdated: -1 })

// Índice TTL para limpiar métricas antiguas (mantener 2 años)
AnalyticsMetricSchema.index({ periodStart: 1 }, { expireAfterSeconds: 63072000 })

// Métodos estáticos para consultas comunes
AnalyticsMetricSchema.statics.getMetricsByType = function (metricType, startDate, endDate, period = 'daily') {
  return this.find({
    metricType,
    period,
    periodStart: { $gte: startDate },
    periodEnd: { $lte: endDate },
    status: 'active'
  }).sort({ periodStart: 1 })
}

AnalyticsMetricSchema.statics.getLatestMetric = function (metricType, period = 'daily') {
  return this.findOne({
    metricType,
    period,
    status: 'active'
  }).sort({ periodStart: -1 })
}

AnalyticsMetricSchema.statics.getMetricTrend = function (metricType, startDate, endDate, period = 'daily', dataPath = null) {
  const pipeline = [
    {
      $match: {
        metricType,
        period,
        periodStart: { $gte: startDate },
        periodEnd: { $lte: endDate },
        status: 'active'
      }
    },
    {
      $sort: { periodStart: 1 }
    }
  ]

  // Si se especifica un path de datos específico, extraerlo
  if (dataPath) {
    pipeline.push({
      $project: {
        periodStart: 1,
        periodEnd: 1,
        value: { $getField: { field: dataPath, input: '$data' } }
      }
    })
  }

  return this.aggregate(pipeline)
}

AnalyticsMetricSchema.statics.getMetricComparison = function (metricType, currentPeriod, previousPeriod, period = 'daily') {
  return this.aggregate([
    {
      $match: {
        metricType,
        period,
        status: 'active',
        $or: [
          { periodStart: { $gte: currentPeriod.start, $lt: currentPeriod.end } },
          { periodStart: { $gte: previousPeriod.start, $lt: previousPeriod.end } }
        ]
      }
    },
    {
      $group: {
        _id: {
          $cond: [
            { $gte: ['$periodStart', currentPeriod.start] },
            'current',
            'previous'
          ]
        },
        data: { $push: '$data' },
        count: { $sum: 1 }
      }
    }
  ])
}

// Método para calcular el cambio porcentual
AnalyticsMetricSchema.statics.calculatePercentageChange = function (currentValue, previousValue) {
  if (!previousValue || previousValue === 0) {
    return currentValue > 0 ? 100 : 0
  }

  return ((currentValue - previousValue) / previousValue) * 100
}

// Método para obtener resumen de métricas
AnalyticsMetricSchema.statics.getMetricsSummary = function (startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        periodStart: { $gte: startDate },
        periodEnd: { $lte: endDate },
        status: 'active'
      }
    },
    {
      $group: {
        _id: '$metricType',
        latestValue: { $last: '$data' },
        latestPeriod: { $last: '$periodStart' },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { latestPeriod: -1 }
    }
  ])
}

// Middleware para validación
AnalyticsMetricSchema.pre('save', function (next) {
  // Validar que periodEnd sea mayor que periodStart
  if (this.periodEnd <= this.periodStart) {
    return next(new Error('periodEnd debe ser mayor que periodStart'))
  }

  // Auto-calcular periodEnd basado en el período si no se especifica
  if (!this.periodEnd) {
    const periodStart = new Date(this.periodStart)

    switch (this.period) {
      case 'hourly':
        this.periodEnd = new Date(periodStart.getTime() + 60 * 60 * 1000)
        break
      case 'daily':
        this.periodEnd = new Date(periodStart.getTime() + 24 * 60 * 60 * 1000)
        break
      case 'weekly':
        this.periodEnd = new Date(periodStart.getTime() + 7 * 24 * 60 * 60 * 1000)
        break
      case 'monthly':
        this.periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, periodStart.getDate())
        break
      case 'yearly':
        this.periodEnd = new Date(periodStart.getFullYear() + 1, periodStart.getMonth(), periodStart.getDate())
        break
    }
  }

  // Actualizar timestamp
  this.lastUpdated = new Date()

  next()
})

export default mongoose.model('AnalyticsMetric', AnalyticsMetricSchema)

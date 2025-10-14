import { Server } from 'socket.io'
import AnalyticsService from './analyticsService.js'
import logger from '../utils/logger.js'

/**
 * Servicio de WebSockets para Analytics en tiempo real
 */
class AnalyticsSocketService {
  constructor() {
    this.io = null
    this.adminRooms = new Map() // Mapa de salas de administradores
    this.analyticsRooms = new Set() // Salas de analytics activas
    this.updateInterval = null
    this.isUpdating = false
  }

  /**
   * Inicializar el servicio de WebSockets con servidor separado
   */
  initialize(server) {
    try {
      // Crear servidor Socket.IO separado para analytics
      this.io = new Server(server, {
        cors: {
          origin: process.env.CORS_ORIGIN || "http://localhost:3001",
          methods: ['GET', 'POST'],
          credentials: true
        },
        transports: ['websocket', 'polling'],
        path: '/analytics-socket.io' // Ruta específica para analytics
      })

      this.setupEventHandlers()
      this.startRealTimeUpdates()

      logger.info('Analytics WebSocket service initialized with separate server on /analytics-socket.io')
    } catch (error) {
      logger.error('Error initializing Analytics WebSocket service:', error)
      throw error
    }
  }

  /**
   * Configurar manejadores de eventos
   */
  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      logger.info(`Client connected to analytics: ${socket.id}`)

      // Unirse a la sala de analytics
      socket.on('join-analytics', async (data) => {
        try {
          const { userId, userRole, timeRange = '24h' } = data

          // Verificar permisos de administrador
          if (!userRole || (userRole !== 'admin' && userRole !== 'moderator')) {
            socket.emit('analytics-error', {
              message: 'Sin permisos para acceder a analytics'
            })
            return
          }

          // Crear sala única para el usuario
          const userRoom = `analytics-${userId}`
          socket.join(userRoom)

          // Agregar a la sala de analytics general
          socket.join('analytics-room')

          // Registrar la sala del administrador
          this.adminRooms.set(userId, {
            socketId: socket.id,
            timeRange,
            lastUpdate: new Date(),
            isActive: true
          })

          // Enviar datos iniciales
          await this.sendInitialData(socket, timeRange)

          logger.info(`User ${userId} joined analytics room with timeRange: ${timeRange}`)

        } catch (error) {
          logger.error('Error joining analytics room:', error)
          socket.emit('analytics-error', {
            message: 'Error al unirse a la sala de analytics'
          })
        }
      })

      // Cambiar rango de tiempo
      socket.on('change-time-range', async (data) => {
        try {
          const { userId, timeRange } = data
          const adminRoom = this.adminRooms.get(userId)

          if (adminRoom) {
            adminRoom.timeRange = timeRange
            adminRoom.lastUpdate = new Date()

            // Enviar datos actualizados
            await this.sendAnalyticsData(userId, timeRange)
          }

        } catch (error) {
          logger.error('Error changing time range:', error)
          socket.emit('analytics-error', {
            message: 'Error al cambiar el rango de tiempo'
          })
        }
      })

      // Solicitar datos específicos
      socket.on('request-analytics-data', async (data) => {
        try {
          const { userId, dataType, params = {} } = data

          switch (dataType) {
            case 'user-analytics':
              await this.sendUserAnalytics(socket, params)
              break
            case 'content-analytics':
              await this.sendContentAnalytics(socket, params)
              break
            case 'engagement-analytics':
              await this.sendEngagementAnalytics(socket, params)
              break
            case 'geographic-analytics':
              await this.sendGeographicAnalytics(socket, params)
              break
            case 'platform-analytics':
              await this.sendPlatformAnalytics(socket, params)
              break
            default:
              socket.emit('analytics-error', {
                message: 'Tipo de datos no válido'
              })
          }

        } catch (error) {
          logger.error('Error requesting analytics data:', error)
          socket.emit('analytics-error', {
            message: 'Error al solicitar datos de analytics'
          })
        }
      })

      // Desconexión
      socket.on('disconnect', () => {
        logger.info(`Client disconnected from analytics: ${socket.id}`)

        // Limpiar salas del administrador
        for (const [userId, room] of this.adminRooms.entries()) {
          if (room.socketId === socket.id) {
            this.adminRooms.delete(userId)
            break
          }
        }
      })
    })
  }

  /**
   * Enviar datos iniciales al conectar
   */
  async sendInitialData(socket, timeRange) {
    try {
      const metrics = await AnalyticsService.getDashboardMetrics(timeRange)

      socket.emit('analytics-initial-data', {
        type: 'dashboard-metrics',
        data: metrics,
        timestamp: new Date().toISOString()
      })

    } catch (error) {
      logger.error('Error sending initial data:', error)
      socket.emit('analytics-error', {
        message: 'Error al cargar datos iniciales'
      })
    }
  }

  /**
   * Enviar datos de analytics a un usuario específico
   */
  async sendAnalyticsData(userId, timeRange) {
    try {
      const adminRoom = this.adminRooms.get(userId)
      if (!adminRoom || !adminRoom.isActive) return

      const socket = this.io.sockets.sockets.get(adminRoom.socketId)
      if (!socket) return

      const metrics = await AnalyticsService.getDashboardMetrics(timeRange)

      socket.emit('analytics-update', {
        type: 'dashboard-metrics',
        data: metrics,
        timeRange,
        timestamp: new Date().toISOString()
      })

      adminRoom.lastUpdate = new Date()

    } catch (error) {
      logger.error(`Error sending analytics data to user ${userId}:`, error)
    }
  }

  /**
   * Enviar datos de análisis de usuarios
   */
  async sendUserAnalytics(socket, params) {
    try {
      const data = await AnalyticsService.getUserAnalytics(params)

      socket.emit('analytics-data', {
        type: 'user-analytics',
        data,
        timestamp: new Date().toISOString()
      })

    } catch (error) {
      logger.error('Error sending user analytics:', error)
      socket.emit('analytics-error', {
        message: 'Error al cargar análisis de usuarios'
      })
    }
  }

  /**
   * Enviar datos de análisis de contenido
   */
  async sendContentAnalytics(socket, params) {
    try {
      const data = await AnalyticsService.getContentAnalytics(params)

      socket.emit('analytics-data', {
        type: 'content-analytics',
        data,
        timestamp: new Date().toISOString()
      })

    } catch (error) {
      logger.error('Error sending content analytics:', error)
      socket.emit('analytics-error', {
        message: 'Error al cargar análisis de contenido'
      })
    }
  }

  /**
   * Enviar datos de análisis de engagement
   */
  async sendEngagementAnalytics(socket, params) {
    try {
      const data = await AnalyticsService.getEngagementAnalytics(params)

      socket.emit('analytics-data', {
        type: 'engagement-analytics',
        data,
        timestamp: new Date().toISOString()
      })

    } catch (error) {
      logger.error('Error sending engagement analytics:', error)
      socket.emit('analytics-error', {
        message: 'Error al cargar análisis de engagement'
      })
    }
  }

  /**
   * Enviar datos de análisis geográfico
   */
  async sendGeographicAnalytics(socket, params) {
    try {
      const data = await AnalyticsService.getGeographicAnalytics(params)

      socket.emit('analytics-data', {
        type: 'geographic-analytics',
        data,
        timestamp: new Date().toISOString()
      })

    } catch (error) {
      logger.error('Error sending geographic analytics:', error)
      socket.emit('analytics-error', {
        message: 'Error al cargar análisis geográfico'
      })
    }
  }

  /**
   * Enviar datos de análisis de plataformas
   */
  async sendPlatformAnalytics(socket, params) {
    try {
      const data = await AnalyticsService.getPlatformAnalytics(params)

      socket.emit('analytics-data', {
        type: 'platform-analytics',
        data,
        timestamp: new Date().toISOString()
      })

    } catch (error) {
      logger.error('Error sending platform analytics:', error)
      socket.emit('analytics-error', {
        message: 'Error al cargar análisis de plataformas'
      })
    }
  }

  /**
   * Iniciar actualizaciones en tiempo real
   */
  startRealTimeUpdates() {
    // Actualizar cada 30 segundos
    this.updateInterval = setInterval(async () => {
      if (this.isUpdating) return

      this.isUpdating = true

      try {
        await this.broadcastAnalyticsUpdates()
      } catch (error) {
        logger.error('Error in real-time analytics update:', error)
      } finally {
        this.isUpdating = false
      }
    }, 30000) // 30 segundos

    logger.info('Real-time analytics updates started')
  }

  /**
   * Transmitir actualizaciones de analytics a todos los administradores conectados
   */
  async broadcastAnalyticsUpdates() {
    if (this.adminRooms.size === 0) return

    try {
      // Obtener métricas actuales para diferentes rangos de tiempo
      const timeRanges = ['1h', '24h', '7d', '30d']
      const metricsByTimeRange = {}

      for (const timeRange of timeRanges) {
        try {
          metricsByTimeRange[timeRange] = await AnalyticsService.getDashboardMetrics(timeRange)
        } catch (error) {
          logger.error(`Error getting metrics for ${timeRange}:`, error)
        }
      }

      // Enviar actualizaciones a cada administrador
      for (const [userId, room] of this.adminRooms.entries()) {
        if (!room.isActive) continue

        const socket = this.io.sockets.sockets.get(room.socketId)
        if (!socket) {
          room.isActive = false
          continue
        }

        try {
          const metrics = metricsByTimeRange[room.timeRange]
          if (metrics) {
            socket.emit('analytics-update', {
              type: 'dashboard-metrics',
              data: metrics,
              timeRange: room.timeRange,
              timestamp: new Date().toISOString()
            })
          }

          // Enviar notificaciones de eventos importantes
          await this.checkForImportantEvents(metrics, socket)

        } catch (error) {
          logger.error(`Error broadcasting to user ${userId}:`, error)
        }
      }

    } catch (error) {
      logger.error('Error in broadcast analytics updates:', error)
    }
  }

  /**
   * Verificar eventos importantes y enviar notificaciones
   */
  async checkForImportantEvents(metrics, socket) {
    if (!metrics) return

    const alerts = []

    // Verificar picos de actividad
    if (metrics.overview.activeUsers > 1000) {
      alerts.push({
        type: 'high_activity',
        message: 'Alto nivel de actividad de usuarios detectado',
        severity: 'info',
        data: { activeUsers: metrics.overview.activeUsers }
      })
    }

    // Verificar aumento significativo de reportes
    if (metrics.overview.totalReports > 50) {
      alerts.push({
        type: 'high_reports',
        message: 'Número elevado de reportes en el período',
        severity: 'warning',
        data: { totalReports: metrics.overview.totalReports }
      })
    }

    // Verificar errores del sistema
    if (metrics.errors && metrics.errors.length > 0) {
      alerts.push({
        type: 'system_errors',
        message: 'Errores del sistema detectados',
        severity: 'error',
        data: { errors: metrics.errors }
      })
    }

    // Enviar alertas si las hay
    if (alerts.length > 0) {
      socket.emit('analytics-alert', {
        alerts,
        timestamp: new Date().toISOString()
      })
    }
  }

  /**
   * Emitir evento de analytics a una sala específica
   */
  emitToRoom(room, event, data) {
    if (this.io) {
      this.io.to(room).emit(event, data)
    }
  }

  /**
   * Emitir evento de analytics a un usuario específico
   */
  emitToUser(userId, event, data) {
    const userRoom = `analytics-${userId}`
    this.emitToRoom(userRoom, event, data)
  }

  /**
   * Emitir evento a todos los administradores conectados
   */
  emitToAllAdmins(event, data) {
    this.emitToRoom('analytics-room', event, data)
  }

  /**
   * Obtener estadísticas de conexiones
   */
  getConnectionStats() {
    return {
      connectedAdmins: this.adminRooms.size,
      activeRooms: this.analyticsRooms.size,
      lastUpdate: this.isUpdating ? 'updating' : 'idle'
    }
  }

  /**
   * Detener el servicio
   */
  stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
      this.updateInterval = null
    }

    if (this.io) {
      this.io.close()
      this.io = null
    }

    this.adminRooms.clear()
    this.analyticsRooms.clear()

    logger.info('Analytics WebSocket service stopped')
  }
}

// Instancia singleton
const analyticsSocketService = new AnalyticsSocketService()

export default analyticsSocketService

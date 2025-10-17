/**
 * EventPublisher - Infrastructure Layer
 * Implementación del patrón Publisher para eventos de dominio
 * Prepara la arquitectura para microservicios
 */

import { logger } from '../../utils/logger.js'

export class EventPublisher {
  constructor() {
    this.subscribers = new Map()
    this.eventStore = null
    this.messageBroker = null
  }

  /**
   * Configurar event store
   * @param {Object} eventStore - Event store instance
   */
  setEventStore(eventStore) {
    this.eventStore = eventStore
    logger.info('Event store configurado')
  }

  /**
   * Configurar message broker
   * @param {Object} messageBroker - Message broker instance
   */
  setMessageBroker(messageBroker) {
    this.messageBroker = messageBroker
    logger.info('Message broker configurado')
  }

  /**
   * Publicar evento
   * @param {Object} event - Evento a publicar
   */
  async publish(event) {
    try {
      const eventData = {
        id: this.generateEventId(),
        type: event.type,
        version: event.version || '1.0',
        data: event.data,
        metadata: {
          timestamp: new Date().toISOString(),
          source: event.source || 'circlesfera-api',
          correlationId: event.correlationId || this.generateCorrelationId(),
          causationId: event.causationId || null
        }
      }

      // Guardar en event store
      if (this.eventStore) {
        await this.eventStore.append(eventData)
        logger.debug('Evento guardado en event store', {
          eventId: eventData.id,
          eventType: eventData.type
        })
      }

      // Publicar en message broker para otros servicios
      if (this.messageBroker) {
        await this.messageBroker.publish(eventData.type, eventData)
        logger.debug('Evento publicado en message broker', {
          eventId: eventData.id,
          eventType: eventData.type
        })
      }

      // Notificar subscribers locales
      await this.notifySubscribers(eventData)

      logger.info('Evento publicado exitosamente', {
        eventId: eventData.id,
        eventType: eventData.type,
        source: eventData.metadata.source
      })

      return eventData
    } catch (error) {
      logger.error('Error publicando evento', {
        error: error.message,
        eventType: event.type
      })
      throw error
    }
  }

  /**
   * Suscribirse a eventos
   * @param {string} eventType - Tipo de evento
   * @param {Function} handler - Manejador del evento
   */
  subscribe(eventType, handler) {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, [])
    }

    this.subscribers.get(eventType).push(handler)
    logger.info('Subscriptor agregado', {
      eventType,
      totalSubscribers: this.subscribers.get(eventType).length
    })
  }

  /**
   * Desuscribirse de eventos
   * @param {string} eventType - Tipo de evento
   * @param {Function} handler - Manejador del evento
   */
  unsubscribe(eventType, handler) {
    if (this.subscribers.has(eventType)) {
      const handlers = this.subscribers.get(eventType)
      const index = handlers.indexOf(handler)

      if (index > -1) {
        handlers.splice(index, 1)
        logger.info('Subscriptor removido', {
          eventType,
          remainingSubscribers: handlers.length
        })
      }
    }
  }

  /**
   * Notificar subscribers locales
   * @param {Object} eventData - Datos del evento
   */
  async notifySubscribers(eventData) {
    const handlers = this.subscribers.get(eventData.type) || []

    for (const handler of handlers) {
      try {
        await handler(eventData)
      } catch (error) {
        logger.error('Error en handler de evento', {
          eventType: eventData.type,
          eventId: eventData.id,
          error: error.message
        })
      }
    }
  }

  /**
   * Generar ID único para evento
   * @returns {string} ID del evento
   */
  generateEventId() {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Generar ID de correlación
   * @returns {string} ID de correlación
   */
  generateCorrelationId() {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Obtener estadísticas de eventos
   * @returns {Object} Estadísticas
   */
  getStats() {
    return {
      totalEventTypes: this.subscribers.size,
      totalSubscribers: Array.from(this.subscribers.values()).reduce(
        (total, handlers) => total + handlers.length,
        0
      ),
      eventTypes: Array.from(this.subscribers.keys())
    }
  }
}

/**
 * Event Store para persistir eventos
 */
export class EventStore {
  constructor(database) {
    this.database = database
  }

  /**
   * Agregar evento al store
   * @param {Object} eventData - Datos del evento
   */
  async append(eventData) {
    try {
      // En una implementación real, esto se guardaría en MongoDB
      // Por ahora solo logueamos
      logger.debug('Evento guardado en event store', {
        eventId: eventData.id,
        eventType: eventData.type,
        timestamp: eventData.metadata.timestamp
      })
    } catch (error) {
      logger.error('Error guardando evento en store', {
        error: error.message,
        eventId: eventData.id
      })
      throw error
    }
  }

  /**
   * Obtener eventos por stream
   * @param {string} streamId - ID del stream
   * @param {number} fromVersion - Versión desde la cual obtener
   * @returns {Array} Eventos del stream
   */
  async getEvents(streamId, fromVersion = 0) {
    try {
      // Implementación real consultaría la base de datos
      logger.debug('Obteniendo eventos del stream', {
        streamId,
        fromVersion
      })

      return []
    } catch (error) {
      logger.error('Error obteniendo eventos del stream', {
        error: error.message,
        streamId
      })
      throw error
    }
  }

  /**
   * Obtener eventos por tipo
   * @param {string} eventType - Tipo de evento
   * @param {Object} options - Opciones de consulta
   * @returns {Array} Eventos del tipo
   */
  async getEventsByType(eventType, options = {}) {
    try {
      // Implementación real consultaría la base de datos
      logger.debug('Obteniendo eventos por tipo', {
        eventType,
        options
      })

      return []
    } catch (error) {
      logger.error('Error obteniendo eventos por tipo', {
        error: error.message,
        eventType
      })
      throw error
    }
  }
}

/**
 * Message Broker para comunicación entre servicios
 */
export class MessageBroker {
  constructor() {
    this.channels = new Map()
  }

  /**
   * Publicar mensaje en canal
   * @param {string} channel - Canal
   * @param {Object} message - Mensaje
   */
  async publish(channel, message) {
    try {
      // En una implementación real, esto se publicaría en Redis/RabbitMQ
      logger.debug('Mensaje publicado en canal', {
        channel,
        messageId: message.id,
        messageType: message.type
      })

      // Simular notificación a suscriptores
      const subscribers = this.channels.get(channel) || []
      for (const subscriber of subscribers) {
        try {
          await subscriber(message)
        } catch (error) {
          logger.error('Error notificando subscriber', {
            channel,
            error: error.message
          })
        }
      }
    } catch (error) {
      logger.error('Error publicando mensaje', {
        error: error.message,
        channel
      })
      throw error
    }
  }

  /**
   * Suscribirse a canal
   * @param {string} channel - Canal
   * @param {Function} handler - Manejador
   */
  subscribe(channel, handler) {
    if (!this.channels.has(channel)) {
      this.channels.set(channel, [])
    }

    this.channels.get(channel).push(handler)
    logger.info('Subscriptor agregado a canal', {
      channel,
      totalSubscribers: this.channels.get(channel).length
    })
  }

  /**
   * Desuscribirse de canal
   * @param {string} channel - Canal
   * @param {Function} handler - Manejador
   */
  unsubscribe(channel, handler) {
    if (this.channels.has(channel)) {
      const handlers = this.channels.get(channel)
      const index = handlers.indexOf(handler)

      if (index > -1) {
        handlers.splice(index, 1)
        logger.info('Subscriptor removido de canal', {
          channel,
          remainingSubscribers: handlers.length
        })
      }
    }
  }
}

// Instancia singleton del publisher
export const eventPublisher = new EventPublisher()

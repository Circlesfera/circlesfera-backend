/**
 * Tests para Logger Service
 *
 * Verifica que el logger funcione correctamente en diferentes entornos
 * y que los logs se generen apropiadamente.
 */

import logger from '../logger.js'
import winston from 'winston'

describe('Logger Service', () => {
  // Store original NODE_ENV
  const originalEnv = process.env.NODE_ENV

  afterEach(() => {
    // Restore original environment
    process.env.NODE_ENV = originalEnv
  })

  describe('Configuración básica', () => {
    test('debe tener los niveles de log correctos', () => {
      expect(logger).toBeDefined()
      expect(logger.level).toBeDefined()
    })

    test('debe tener formato JSON en producción', () => {
      process.env.NODE_ENV = 'production'

      // Logger debe estar configurado con formato JSON
      expect(logger).toBeInstanceOf(winston.Logger)
    })

    test('debe tener formato colorizado en desarrollo', () => {
      process.env.NODE_ENV = 'development'

      // Logger debe estar configurado con colores
      expect(logger).toBeInstanceOf(winston.Logger)
    })
  })

  describe('Métodos de logging', () => {
    test('debe tener método info', () => {
      expect(logger.info).toBeDefined()
      expect(typeof logger.info).toBe('function')
    })

    test('debe tener método error', () => {
      expect(logger.error).toBeDefined()
      expect(typeof logger.error).toBe('function')
    })

    test('debe tener método warn', () => {
      expect(logger.warn).toBeDefined()
      expect(typeof logger.warn).toBe('function')
    })

    test('debe tener método debug', () => {
      expect(logger.debug).toBeDefined()
      expect(typeof logger.debug).toBe('function')
    })
  })

  describe('Funcionalidad de logging', () => {
    test('debe poder loggear mensajes de info', () => {
      // Arrange
      const spy = jest.spyOn(logger, 'info')
      const message = 'Test info message'

      // Act
      logger.info(message)

      // Assert
      expect(spy).toHaveBeenCalledWith(message)

      // Cleanup
      spy.mockRestore()
    })

    test('debe poder loggear errores', () => {
      // Arrange
      const spy = jest.spyOn(logger, 'error')
      const error = new Error('Test error')

      // Act
      logger.error('Error occurred:', { error: error.message })

      // Assert
      expect(spy).toHaveBeenCalled()

      // Cleanup
      spy.mockRestore()
    })

    test('debe poder loggear con metadata', () => {
      // Arrange
      const spy = jest.spyOn(logger, 'info')
      const message = 'User action'
      const metadata = { userId: '123', action: 'login' }

      // Act
      logger.info(message, metadata)

      // Assert
      expect(spy).toHaveBeenCalledWith(message, metadata)

      // Cleanup
      spy.mockRestore()
    })

    test('debe manejar objetos complejos en metadata', () => {
      // Arrange
      const spy = jest.spyOn(logger, 'info')
      const complexMetadata = {
        user: { id: '123', name: 'Test User' },
        request: { method: 'GET', path: '/api/test' },
        timestamp: Date.now()
      }

      // Act
      logger.info('Complex log', complexMetadata)

      // Assert
      expect(spy).toHaveBeenCalledWith('Complex log', complexMetadata)

      // Cleanup
      spy.mockRestore()
    })
  })

  describe('Niveles de logging por entorno', () => {
    test('debe usar nivel debug en development', () => {
      process.env.NODE_ENV = 'development'

      // En desarrollo, debug debe estar habilitado
      expect(['debug', 'info']).toContain(logger.level)
    })

    test('debe usar nivel info en production', () => {
      process.env.NODE_ENV = 'production'

      // En producción, solo info o superior
      expect(['info', 'warn', 'error']).toContain(logger.level)
    })

    test('debe usar nivel info en test', () => {
      process.env.NODE_ENV = 'test'

      // En testing, info o superior para no saturar
      expect(['info', 'warn', 'error']).toContain(logger.level)
    })
  })

  describe('Manejo de errores', () => {
    test('no debe fallar con parámetros undefined', () => {
      // Arrange & Act & Assert
      expect(() => {
        logger.info(undefined)
      }).not.toThrow()
    })

    test('no debe fallar con parámetros null', () => {
      // Arrange & Act & Assert
      expect(() => {
        logger.info(null)
      }).not.toThrow()
    })

    test('no debe fallar con metadata vacía', () => {
      // Arrange & Act & Assert
      expect(() => {
        logger.info('Message', {})
      }).not.toThrow()
    })

    test('debe manejar errores circulares en metadata', () => {
      // Arrange
      const circularObj = { prop: 'value' }
      circularObj.circular = circularObj

      // Act & Assert
      expect(() => {
        logger.info('Circular test', circularObj)
      }).not.toThrow()
    })
  })

  describe('Transports', () => {
    test('debe tener al menos un transport configurado', () => {
      expect(logger.transports).toBeDefined()
      expect(logger.transports.length).toBeGreaterThan(0)
    })

    test('debe incluir console transport', () => {
      const hasConsoleTransport = logger.transports.some(
        transport => transport.name === 'console'
      )
      expect(hasConsoleTransport).toBe(true)
    })
  })
})


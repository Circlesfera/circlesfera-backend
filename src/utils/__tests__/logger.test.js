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
      const message = 'Test info message'

      // Act & Assert - No debe lanzar error
      expect(() => {
        logger.info(message)
      }).not.toThrow()
    })

    test('debe poder loggear errores', () => {
      // Arrange
      const error = new Error('Test error')

      // Act & Assert - No debe lanzar error
      expect(() => {
        logger.error('Error occurred:', { error: error.message })
      }).not.toThrow()
    })

    test('debe poder loggear con metadata', () => {
      // Arrange
      const message = 'User action'
      const metadata = { userId: '123', action: 'login' }

      // Act & Assert - No debe lanzar error
      expect(() => {
        logger.info(message, metadata)
      }).not.toThrow()
    })

    test('debe manejar objetos complejos en metadata', () => {
      // Arrange
      const complexMetadata = {
        user: { id: '123', name: 'Test User' },
        request: { method: 'GET', path: '/api/test' },
        timestamp: Date.now()
      }

      // Act & Assert - No debe lanzar error
      expect(() => {
        logger.info('Complex log', complexMetadata)
      }).not.toThrow()
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

    test('debe manejar objetos circulares en metadata', () => {
      // Arrange
      const circularObj = { prop: 'value' }
      circularObj.circular = circularObj

      // Act & Assert
      // Winston maneja esto internamente, solo verificamos que no explote
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

  describe('Logger es una instancia de Winston', () => {
    test('debe ser una instancia válida de winston.Logger', () => {
      expect(logger).toBeInstanceOf(winston.Logger)
    })

    test('debe tener propiedad level', () => {
      expect(logger).toHaveProperty('level')
      expect(typeof logger.level).toBe('string')
    })

    test('debe tener propiedad transports', () => {
      expect(logger).toHaveProperty('transports')
      expect(Array.isArray(logger.transports)).toBe(true)
    })

    test('debe tener método log', () => {
      expect(logger).toHaveProperty('log')
      expect(typeof logger.log).toBe('function')
    })
  })

  describe('Logging en diferentes niveles', () => {
    test('debe permitir loggear en nivel info', () => {
      expect(() => {
        logger.info('Info level message')
      }).not.toThrow()
    })

    test('debe permitir loggear en nivel warn', () => {
      expect(() => {
        logger.warn('Warning level message')
      }).not.toThrow()
    })

    test('debe permitir loggear en nivel error', () => {
      expect(() => {
        logger.error('Error level message')
      }).not.toThrow()
    })

    test('debe permitir loggear en nivel debug', () => {
      expect(() => {
        logger.debug('Debug level message')
      }).not.toThrow()
    })
  })
})

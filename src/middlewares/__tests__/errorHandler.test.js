/**
 * Tests para errorHandler.js
 *
 * Este archivo contiene tests unitarios para el middleware de manejo de errores
 * centralizado que implementamos para resolver el Hallazgo Crítico #3.
 */

import { jest } from '@jest/globals'
import {
  AppError,
  errorHandler,
  handleUncaughtException,
  handleUnhandledRejection,
  notFoundHandler
} from '../errorHandler.js'

// Mock de logger
jest.mock('../../utils/logger.js', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
}))

// Mock de config
jest.mock('../../utils/config.js', () => ({
  isDevelopment: true
}))

describe('errorHandler', () => {
  let mockReq, mockRes, mockNext

  beforeEach(() => {
    mockReq = {
      method: 'GET',
      path: '/test',
      ip: '127.0.0.1',
      user: { id: '507f1f77bcf86cd799439011' },
      get: jest.fn(() => 'test-user-agent'),
      originalUrl: '/test'
    }
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    }
    mockNext = jest.fn()

    // Reset mocks
    jest.clearAllMocks()
  })

  describe('AppError', () => {
    it('debe crear error operacional con status code por defecto', () => {
      const error = new AppError('Test error')

      expect(error.message).toBe('Test error')
      expect(error.status).toBe('error')
      expect(error.isOperational).toBe(true)
    })

    it('debe crear error con status code personalizado', () => {
      const error = new AppError('Not found', 404)

      expect(error.message).toBe('Not found')
      expect(error.status).toBe('fail')
      expect(error.isOperational).toBe(true)
    })

    it('debe crear error no operacional', () => {
      const error = new AppError('System error', 500, false)

      expect(error.message).toBe('System error')
      expect(error.status).toBe('error')
      expect(error.isOperational).toBe(false)
    })
  })

  describe('errorHandler', () => {
    it('debe manejar error operacional personalizado', () => {
      const error = new AppError('Custom error', 400)

      errorHandler(error, mockReq, mockRes, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Custom error'
      })
    })

    it('debe manejar error de validación de Mongoose', () => {
      const error = new Error('Validation failed')
      error.name = 'ValidationError'
      error.errors = {
        email: { message: 'Email is required' },
        password: { message: 'Password is required' }
      }

      errorHandler(error, mockReq, mockRes, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Error de validación',
        errors: ['Email is required', 'Password is required']
      })
    })

    it('debe manejar error de casting de Mongoose', () => {
      const error = new Error('Cast to ObjectId failed')
      error.name = 'CastError'

      errorHandler(error, mockReq, mockRes, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'ID inválido proporcionado'
      })
    })

    it('debe manejar error de duplicado de Mongoose', () => {
      const error = new Error('Duplicate key error')
      error.code = 11000
      error.keyPattern = { email: 1 }

      errorHandler(error, mockReq, mockRes, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'El valor proporcionado para email ya existe'
      })
    })

    it('debe manejar error JWT inválido', () => {
      const error = new Error('Invalid token')
      error.name = 'JsonWebTokenError'

      errorHandler(error, mockReq, mockRes, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(401)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Token inválido'
      })
    })

    it('debe manejar error JWT expirado', () => {
      const error = new Error('Token expired')
      error.name = 'TokenExpiredError'

      errorHandler(error, mockReq, mockRes, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(401)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Token expirado'
      })
    })

    it('debe manejar error genérico en desarrollo', () => {
      const error = new Error('Generic error')
      error.statusCode = 500
      error.stack = 'Error stack trace'

      errorHandler(error, mockReq, mockRes, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Generic error',
        stack: 'Error stack trace'
      })
    })

    it('debe manejar error genérico en producción', () => {
      // Mock config para producción
      jest.doMock('../../utils/config.js', () => ({
        isDevelopment: false
      }))

      const error = new Error('Generic error')
      error.statusCode = 500
      error.stack = 'Error stack trace'

      errorHandler(error, mockReq, mockRes, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Error interno del servidor'
      })
    })

    it('debe usar status code por defecto si no está definido', () => {
      const error = new Error('Error without status code')

      errorHandler(error, mockReq, mockRes, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(500)
    })
  })

  describe('notFoundHandler', () => {
    it('debe retornar error 404 para rutas no encontradas', () => {
      const mockNext = jest.fn()
      notFoundHandler(mockReq, mockRes, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(404)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Ruta no encontrada'
      })
    })
  })

  describe('handleUnhandledRejection', () => {
    it('debe configurar handler para unhandled rejections', () => {
      const originalOn = process.on
      const mockOn = jest.fn()
      process.on = mockOn

      handleUnhandledRejection()

      expect(mockOn).toHaveBeenCalledWith('unhandledRejection', expect.any(Function))

      // Restaurar original
      process.on = originalOn
    })

    it('debe manejar unhandled rejection correctamente', () => {
      const originalOn = process.on
      let handler
      const mockOn = jest.fn((event, callback) => {
        if (event === 'unhandledRejection') {
          handler = callback
        }
      })
      process.on = mockOn

      handleUnhandledRejection()

      // Simular unhandled rejection
      const reason = new Error('Unhandled rejection')
      const promise = Promise.reject(reason)

      // Mock process.exit para evitar que termine el proceso
      const originalExit = process.exit
      process.exit = jest.fn()

      handler(reason, promise)

      // Verificar que se llamó al logger
      const logger = require('../../utils/logger.js')
      expect(logger.error).toHaveBeenCalledWith('Unhandled Rejection:', expect.objectContaining({
        reason,
        promise,
        stack: reason.stack,
        message: reason.message
      }))

      // Restaurar original
      process.on = originalOn
      process.exit = originalExit
    })
  })

  describe('handleUncaughtException', () => {
    it('debe configurar handler para uncaught exceptions', () => {
      const originalOn = process.on
      const mockOn = jest.fn()
      process.on = mockOn

      handleUncaughtException()

      expect(mockOn).toHaveBeenCalledWith('uncaughtException', expect.any(Function))

      // Restaurar original
      process.on = originalOn
    })

    it('debe manejar uncaught exception correctamente', () => {
      const originalOn = process.on
      let handler
      const mockOn = jest.fn((event, callback) => {
        if (event === 'uncaughtException') {
          handler = callback
        }
      })
      process.on = mockOn

      handleUncaughtException()

      // Simular uncaught exception
      const error = new Error('Uncaught exception')
      error.cause = 'Test cause'

      // Mock process.exit para evitar que termine el proceso
      const originalExit = process.exit
      process.exit = jest.fn()

      handler(error)

      // Verificar que se llamó al logger
      const logger = require('../../utils/logger.js')
      expect(logger.error).toHaveBeenCalledWith('Uncaught Exception:', expect.objectContaining({
        message: error.message,
        stack: error.stack,
        name: error.name,
        cause: error.cause,
        error
      }))

      // Restaurar original
      process.on = originalOn
      process.exit = originalExit
    })
  })

  describe('Integración de error handling', () => {
    it('debe manejar múltiples tipos de errores correctamente', () => {
      const errors = [
        { error: new AppError('Custom error', 400), expectedStatus: 400 },
        { error: new Error('Generic error'), expectedStatus: 500 }
      ]

      errors.forEach(({ error, expectedStatus }) => {
        // Reset mocks
        jest.clearAllMocks()

        errorHandler(error, mockReq, mockRes, mockNext)

        expect(mockRes.status).toHaveBeenCalledWith(expectedStatus)
        expect(mockRes.json).toHaveBeenCalled()
      })
    })
  })
})

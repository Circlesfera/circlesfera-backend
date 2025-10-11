/**
 * Jest Setup File - Configuración Global de Tests
 *
 * Este archivo se ejecuta antes de todos los tests
 * para configurar el entorno de testing.
 */

import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { config } from './src/utils/config.js'

// ========================================
// Variables Globales
// ========================================

let mongoServer

// ========================================
// Variables de Entorno para Tests
// ========================================

// NO usar hardcode - usar variables de entorno para tests
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = process.env.JWT_SECRET_TEST || 'test-jwt-secret-key-for-testing-only-12345678'
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET_TEST || 'test-jwt-refresh-secret-for-testing-only-12345678'
process.env.JWT_EXPIRES_IN = '15m'
process.env.JWT_REFRESH_EXPIRES_IN = '7d'

// ========================================
// Setup MongoDB Memory Server
// ========================================

/**
 * Conectar a MongoDB Memory Server antes de todos los tests
 */
beforeAll(async () => {
  try {
    // Cerrar cualquier conexión existente
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect()
    }

    // Crear servidor MongoDB en memoria
    mongoServer = await MongoMemoryServer.create({
      instance: {
        port: 27017 + Math.floor(Math.random() * 1000), // Puerto aleatorio para evitar conflictos
        dbName: 'circlesfera-test'
      }
    })

    const mongoUri = mongoServer.getUri()

    // Conectar Mongoose a MongoDB Memory Server
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000
    })

    console.log('✅ MongoDB Memory Server conectado para tests')
  } catch (error) {
    console.error('❌ Error conectando MongoDB Memory Server:', error)
    throw error
  }
}, 30000) // Timeout de 30 segundos para setup

/**
 * Limpiar base de datos después de cada test
 */
afterEach(async () => {
  if (mongoose.connection.readyState !== 0) {
    const collections = mongoose.connection.collections

    // Limpiar todas las colecciones
    for (const key in collections) {
      const collection = collections[key]
      await collection.deleteMany({})
    }
  }
})

/**
 * Desconectar y detener MongoDB Memory Server después de todos los tests
 */
afterAll(async () => {
  try {
    // Desconectar Mongoose
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect()
    }

    // Detener MongoDB Memory Server
    if (mongoServer) {
      await mongoServer.stop()
    }

    console.log('✅ MongoDB Memory Server desconectado')
  } catch (error) {
    console.error('❌ Error cerrando MongoDB Memory Server:', error)
    throw error
  }
}, 10000) // Timeout de 10 segundos para teardown

// ========================================
// Mock de Logger (configurado inline en cada test si necesario)
// ========================================
// Los mocks se configuran en los tests individuales para ES Modules

// ========================================
// Configuración Global de Tests
// ========================================

// Timeout está configurado en jest.config.js (testTimeout: 10000)

// ========================================
// Helper Functions para Tests
// ========================================

/**
 * Helper para crear mock de request
 */
global.mockRequest = (overrides = {}) => ({
  body: {},
  params: {},
  query: {},
  headers: {},
  user: null,
  ...overrides
})

/**
 * Helper para crear mock de response
 * Nota: No podemos usar jest.fn() aquí porque jest no está disponible en setup
 * Los tests individuales deben mockear con sus propias herramientas
 */
global.mockResponse = () => {
  const res = {
    statusCode: 200,
    statusCalled: false,
    jsonCalled: false,
    sendCalled: false,
    statusValue: null,
    jsonValue: null,
    sendValue: null
  }

  res.status = function (code) {
    res.statusCalled = true
    res.statusCode = code
    res.statusValue = code
    return res
  }

  res.json = function (data) {
    res.jsonCalled = true
    res.jsonValue = data
    // Si no se llamó status antes, usar 200 por defecto
    if (!res.statusCalled) {
      res.statusValue = 200
    }
    return res
  }

  res.send = function (data) {
    res.sendCalled = true
    res.sendValue = data
    if (!res.statusCalled) {
      res.statusValue = 200
    }
    return res
  }

  res.cookie = function () {
    return res
  }

  res.clearCookie = function () {
    return res
  }

  return res
}

/**
 * Helper para crear mock de next
 */
global.mockNext = () => {
  const next = function (error) {
    next.called = true
    next.error = error
  }
  next.called = false
  next.error = null
  return next
}

// ========================================
// Las funciones helper están disponibles globalmente
// ========================================

// No es necesario exportar, ya están en el scope global

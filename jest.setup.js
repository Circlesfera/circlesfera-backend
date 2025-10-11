/**
 * Setup global para Jest
 * Se ejecuta antes de cada test suite
 */

// Variables de entorno para testing
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-secret-key-for-testing'
process.env.MONGODB_URI = 'mongodb://localhost:27017/circlesfera-test'
process.env.PORT = '5001'

// Timeout global para tests
jest.setTimeout(10000)

// Mock de logger para tests
jest.mock('./src/utils/logger.js', () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}))


/**
 * Setup global para Jest
 * Se ejecuta antes de cada test suite
 */

// Variables de entorno para testing
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-secret-key-for-testing'
process.env.MONGODB_URI = 'mongodb://localhost:27017/circlesfera-test'
process.env.PORT = '5001'


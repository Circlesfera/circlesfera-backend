const mongoose = require('mongoose');

// Detectar si estamos en Docker/Alpine
const isDocker = process.env.NODE_ENV === 'test' && process.platform === 'linux';

let mongoServer;
let mongoUri;

// Configurar variables de entorno para tests
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
process.env.JWT_EXPIRES_IN = '1h';
process.env.BCRYPT_SALT_ROUNDS = '10';

// Setup antes de todos los tests
beforeAll(async () => {
  if (isDocker) {
    // En Docker, usar MongoDB real o mock
    mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/circlesfera-test';
    console.log('🐳 Docker detected, using MongoDB URI:', mongoUri);
  } else {
    // En desarrollo local, usar MongoDB Memory Server
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      mongoServer = await MongoMemoryServer.create();
      mongoUri = mongoServer.getUri();
      console.log('💻 Local development, using MongoDB Memory Server');
    } catch (error) {
      console.log('⚠️  MongoDB Memory Server failed, using local MongoDB');
      mongoUri = 'mongodb://localhost:27017/circlesfera-test';
    }
  }

  await mongoose.connect(mongoUri);
}, 30000);

// Limpiar después de cada test
afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany();
  }
});

// Cerrar conexión después de todos los tests
afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
}, 30000);

// Suprimir logs durante tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Test mínimo para que Jest reconozca el archivo
describe('Test Setup', () => {
  it('should setup test environment', () => {
    expect(true).toBe(true);
  });
});
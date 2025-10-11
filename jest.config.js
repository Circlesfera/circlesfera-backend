export default {
  // Entorno de test
  testEnvironment: 'node',

  // Extensiones de archivo a testear
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],

  // Archivos a ignorar
  testPathIgnorePatterns: [
    '/node_modules/',
    '/uploads/',
    '/logs/'
  ],

  // Cobertura de código
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/*.spec.js',
    '!**/node_modules/**',
    '!**/uploads/**',
    '!**/logs/**'
  ],

  // Directorio de cobertura
  coverageDirectory: 'coverage',

  // Transformaciones
  transform: {},

  // Soporte para ES Modules
  extensionsToTreatAsEsm: ['.js'],

  // Tiempo máximo de ejecución de un test
  testTimeout: 10000,

  // Configuración de módulos
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },

  // Configuración de NODE_OPTIONS para ES Modules
  globals: {},

  // Setup antes de cada test
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  // Verbose output
  verbose: true,

  // Detectar memory leaks
  detectOpenHandles: true,
  detectLeaks: true,

  // Forzar salida después de tests
  forceExit: true,

  // Limpia automáticamente los mocks entre tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true
}


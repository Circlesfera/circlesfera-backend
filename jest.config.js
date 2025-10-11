export default {
  // Entorno de test
  testEnvironment: 'node',

  // Extensiones de archivo a testear
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/__tests__/**/*.spec.js',
    '**/src/**/*.test.js',
    '**/src/**/*.spec.js'
  ],

  // Archivos a ignorar
  testPathIgnorePatterns: [
    '/node_modules/',
    '/uploads/',
    '/logs/',
    '/coverage/',
    '/dist/'
  ],

  // Cobertura de código
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/*.spec.js',
    '!src/**/__tests__/**',
    '!**/node_modules/**',
    '!**/uploads/**',
    '!**/logs/**',
    '!**/coverage/**'
  ],

  // Directorio de cobertura
  coverageDirectory: 'coverage',

  // Umbrales de cobertura (comentados por ahora, descomentar en Fase 2)
  // coverageThreshold: {
  //   global: {
  //     branches: 60,
  //     functions: 60,
  //     lines: 60,
  //     statements: 60
  //   }
  // },

  // Reportes de cobertura
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],

  // Transformaciones (ninguna para ES Modules)
  transform: {},

  // Tiempo máximo de ejecución de un test (10 segundos)
  testTimeout: 10000,

  // Setup antes de cada test
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  // Verbose output
  verbose: true,

  // Detectar handles abiertos (deshabilitado para evitar warnings con MongoDB)
  detectOpenHandles: false,

  // Forzar salida después de tests
  forceExit: true,

  // Limpia automáticamente los mocks entre tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // Configuración de módulos (para ES Modules)
  // extensionsToTreatAsEsm: ['.js'], // No necesario con "type": "module" en package.json
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },

  // Globals para tests
  globals: {
    'NODE_ENV': 'test'
  },

  // Max workers (para paralelización)
  maxWorkers: '50%',

  // Notificar cuando tests se completen (opcional)
  notify: false,

  // Mostrar errores individuales
  bail: false
}


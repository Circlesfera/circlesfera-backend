/**
 * Configuración centralizada de la aplicación
 * Todas las variables de entorno deben ser accedidas a través de este módulo
 */

const config = {
  // Entorno
  nodeEnv: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production'
}

// Log de configuración para debug
console.log('🔧 Backend Config:', {
  nodeEnv: config.nodeEnv,
  isDevelopment: config.isDevelopment,
  isProduction: config.isProduction,
  port: process.env.PORT || 5001,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3001'
})

const configFull = {
  // Entorno
  nodeEnv: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',

  // Servidor
  port: parseInt(process.env.PORT, 10) || 5001,

  // Base de datos
  mongodbUri: process.env.MONGODB_URI || process.env.MONGO_URI,

  // Redis (opcional - solo en producción)
  redisUrl: process.env.REDIS_URL || null,

  // Seguridad
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '30d',
  bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12,

  // CORS
  corsOrigin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
    : ['http://localhost:3001'],

  // Rate Limiting
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000, // 15 min
  rateLimitMaxRequests:
    parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,

  // Upload
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 104857600, // 100MB
  maxFilesCount: parseInt(process.env.MAX_FILES_COUNT, 10) || 10,

  // Paginación
  defaultPageLimit: parseInt(process.env.DEFAULT_PAGE_LIMIT, 10) || 10,
  maxPageLimit: parseInt(process.env.MAX_PAGE_LIMIT, 10) || 100,

  // Validación
  minSearchLength: parseInt(process.env.MIN_SEARCH_LENGTH, 10) || 2,
  minPasswordLength: parseInt(process.env.MIN_PASSWORD_LENGTH, 10) || 8,

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info'
}

/**
 * Valida que todas las variables de entorno críticas estén configuradas
 * @throws {Error} Si falta alguna variable crítica
 */
const validateConfig = () => {
  const errors = []

  // Variables requeridas en producción
  if (configFull.isProduction) {
    if (!configFull.mongodbUri) {
      errors.push('MONGODB_URI es requerido en producción')
    }
    if (!configFull.jwtSecret) {
      errors.push('JWT_SECRET es requerido en producción')
    }
  }

  // Variables requeridas siempre
  if (!configFull.jwtSecret) {
    errors.push(
      'JWT_SECRET debe estar configurado (genera uno con: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'
    )
  }

  if (!configFull.mongodbUri) {
    errors.push('MONGODB_URI debe estar configurado')
  }

  // Validaciones de valores
  if (configFull.bcryptSaltRounds < 10 || configFull.bcryptSaltRounds > 15) {
    errors.push('BCRYPT_SALT_ROUNDS debe estar entre 10 y 15')
  }

  if (configFull.port < 1024 || configFull.port > 65535) {
    errors.push('PORT debe estar entre 1024 y 65535')
  }

  if (errors.length > 0) {
    throw new Error(
      `Errores de configuración:\n${errors.map(e => `  - ${e}`).join('\n')}`
    )
  }

  return true
}

/**
 * Obtiene un límite de paginación validado
 * @param {number} requested - Límite solicitado
 * @returns {number} Límite validado
 */
configFull.getPaginationLimit = requested => {
  const limit = parseInt(requested, 10)
  if (isNaN(limit) || limit < 1) {
    return configFull.defaultPageLimit
  }
  return Math.min(limit, configFull.maxPageLimit)
}

module.exports = { config: configFull, validateConfig }

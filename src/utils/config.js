/**
 * Configuración centralizada de la aplicación
 * Todas las variables de entorno deben ser accedidas a través de este módulo
 */

// Cargar dotenv ANTES de acceder a process.env
import dotenv from 'dotenv'
dotenv.config()

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
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, // Secret para refresh tokens (diferente por seguridad)
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m', // Access token corto
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d', // Refresh token largo
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m', // Legacy, usar jwtAccessExpiresIn
  bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12,

  // CORS - NO usar fallback en producción
  corsOrigin: (() => {
    if (process.env.CORS_ORIGIN) {
      return process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
    }
    return process.env.NODE_ENV === 'production' ? [] : ['http://localhost:3001']
  })(),

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
  logLevel: process.env.LOG_LEVEL || 'info',

  // Contacto
  contactEmail: process.env.CONTACT_EMAIL || 'contact@circlesfera.com',
  supportEmail: process.env.SUPPORT_EMAIL || 'support@circlesfera.com',

  // Features Flags
  features: {
    stories: process.env.FEATURES_STORIES !== 'false',
    reels: process.env.FEATURES_REELS !== 'false',
    live: process.env.FEATURES_LIVE !== 'false',
    messages: process.env.FEATURES_MESSAGES !== 'false'
  }
}

// URLs Públicas - calculadas después de la definición del objeto
const { isProduction } = configFull
const { port } = configFull
configFull.appUrl = process.env.APP_URL || (isProduction ? null : `http://localhost:${port}`)
configFull.apiUrl = process.env.API_URL || (isProduction ? null : `http://localhost:${port}`)
configFull.frontendUrl = process.env.FRONTEND_URL || (isProduction ? null : 'http://localhost:3001')

// Email
configFull.emailFrom = process.env.EMAIL_FROM || 'CircleSfera <noreply@circlesfera.com>'
configFull.emailFromName = process.env.EMAIL_FROM_NAME || 'CircleSfera'
configFull.emailService = process.env.EMAIL_SERVICE || 'development' // 'sendgrid', 'nodemailer', 'development'
configFull.sendgridApiKey = process.env.SENDGRID_API_KEY || null

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
    if (!configFull.appUrl) {
      errors.push('APP_URL es requerido en producción')
    }
    if (!configFull.apiUrl) {
      errors.push('API_URL es requerido en producción')
    }
    if (configFull.corsOrigin.length === 0) {
      errors.push('CORS_ORIGIN es requerido en producción')
    }
    if (configFull.emailService === 'sendgrid' && !configFull.sendgridApiKey) {
      errors.push('SENDGRID_API_KEY es requerido cuando EMAIL_SERVICE=sendgrid')
    }
  }

  // Variables requeridas siempre
  if (!configFull.jwtSecret) {
    errors.push(
      'JWT_SECRET debe estar configurado (genera uno con: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'
    )
  }

  // Validar longitud mínima del JWT secret (seguridad)
  if (configFull.jwtSecret && configFull.jwtSecret.length < 32) {
    errors.push(
      `JWT_SECRET debe tener al menos 32 caracteres para ser seguro (actualmente: ${configFull.jwtSecret.length} caracteres)`
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

export { configFull as config, validateConfig }

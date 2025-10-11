import winston from 'winston'
import path from 'path'
import fs from 'fs'

// Configuración de formatos
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack }) => {
    if (stack) {
      return `${timestamp} [${level.toUpperCase()}]: ${message}\n${stack}`
    }
    return `${timestamp} [${level.toUpperCase()}]: ${message}`
  })
)

// Configuración de transports
const transports = [
  // Archivo para errores
  new winston.transports.File({
    filename: path.join('logs', 'error.log'),
    level: 'error',
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }),
  // Archivo para todos los logs
  new winston.transports.File({
    filename: path.join('logs', 'combined.log'),
    maxsize: 5242880, // 5MB
    maxFiles: 5
  })
]

// En desarrollo, también mostrar en consola
if (process.env.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        customFormat
      )
    })
  )
}

// Crear logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  transports,
  // No salir al recibir error
  exitOnError: false
})

// Crear directorio de logs si no existe
const logsDir = path.join(process.cwd(), 'logs')
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true })
}

// Wrapper para mantener compatibilidad con console.log
logger.log = (level, ...args) => {
  if (typeof level === 'string' && ['error', 'warn', 'info', 'debug'].includes(level)) {
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ')
    logger[level](message)
  } else {
    const message = [level, ...args].map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ')
    logger.info(message)
  }
}

// Override del método error para manejar mejor los objetos
const originalError = logger.error
logger.error = (message, ...args) => {
  const processedArgs = args.map(arg =>
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  )

  if (processedArgs.length > 0) {
    originalError(message + ' ' + processedArgs.join(' '))
  } else {
    originalError(message)
  }
}

// Métodos helper
logger.request = (req, message) => {
  logger.info(`[${req.method}] ${req.path} - ${message}`, {
    requestId: req.id,
    ip: req.ip
  })
}

logger.response = (req, res, message) => {
  const responseTime = req.startTime ? Date.now() - req.startTime : null
  logger.info(`[${req.method}] ${req.path} - ${res.statusCode} - ${message}`, {
    requestId: req.id,
    responseTime: responseTime ? `${responseTime}ms` : undefined,
    ip: req.ip
  })
}

export default logger

const { v4: uuidv4 } = require('uuid')

/**
 * Middleware para agregar Request ID único a cada request
 * Útil para rastrear requests en logs y debugging
 */
const requestId = (req, res, next) => {
  // Usar ID del header si existe, sino generar uno nuevo
  req.id = req.headers['x-request-id'] || uuidv4()

  // Agregar el ID a los headers de respuesta
  res.setHeader('X-Request-ID', req.id)

  // Agregar timestamp
  req.startTime = Date.now()

  next()
}

module.exports = requestId


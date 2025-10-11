import { v4 as uuidv4 } from 'uuid'

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

export default requestId


import { fileTypeFromBuffer } from 'file-type'
import logger from '../utils/logger.js'

/**
 * Validación mejorada de archivos subidos
 * Incluye validación de magic bytes, tipos MIME, tamaño y dimensiones
 */

// Configuración de límites
const FILE_LIMITS = {
  image: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'],
    allowedExtensions: ['jpg', 'jpeg', 'png', 'webp', 'gif']
  },
  video: {
    maxSize: 100 * 1024 * 1024, // 100MB
    allowedTypes: ['video/mp4', 'video/webm', 'video/quicktime'],
    allowedExtensions: ['mp4', 'webm', 'mov'],
    maxDuration: 60, // 60 segundos para reels
    allowedAspectRatios: [9/16, 16/9, 1/1] // Vertical, horizontal, cuadrado
  },
  audio: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['audio/mpeg', 'audio/wav', 'audio/webm', 'audio/ogg'],
    allowedExtensions: ['mp3', 'wav', 'webm', 'ogg']
  }
}

/**
 * Validar tipo de archivo usando magic bytes
 * @param {Buffer} buffer - Buffer del archivo
 * @param {string} expectedType - Tipo esperado (image, video, audio)
 * @returns {Promise<boolean>} True si es válido
 */
export const validateFileType = async (buffer, expectedType) => {
  try {
    const fileType = await fileTypeFromBuffer(buffer)

    if (!fileType) {
      logger.warn('No se pudo detectar el tipo de archivo')
      return false
    }

    const limits = FILE_LIMITS[expectedType]
    if (!limits) {
      logger.error(`Tipo de archivo no soportado: ${expectedType}`)
      return false
    }

    // Validar mime type
    if (!limits.allowedTypes.includes(fileType.mime)) {
      logger.warn(`Tipo MIME no permitido: ${fileType.mime}`)
      return false
    }

    // Validar extensión
    if (!limits.allowedExtensions.includes(fileType.ext)) {
      logger.warn(`Extensión no permitida: ${fileType.ext}`)
      return false
    }

    return true
  } catch (error) {
    logger.error('Error al validar tipo de archivo:', error)
    return false
  }
}

/**
 * Validar tamaño de archivo
 * @param {number} size - Tamaño del archivo en bytes
 * @param {string} fileType - Tipo de archivo (image, video, audio)
 * @returns {boolean} True si es válido
 */
export const validateFileSize = (size, fileType) => {
  const limits = FILE_LIMITS[fileType]
  if (!limits) {
    return false
  }

  return size <= limits.maxSize
}

/**
 * Middleware para validar imágenes
 */
export const validateImage = async (req, res, next) => {
  try {
    const file = req.file || (req.files && req.files[0])

    if (!file) {
      return next()
    }

    // Validar tamaño
    if (!validateFileSize(file.size, 'image')) {
      return res.status(400).json({
        success: false,
        message: `El archivo excede el tamaño máximo permitido (${FILE_LIMITS.image.maxSize / (1024 * 1024)}MB)`
      })
    }

    // Validar tipo usando magic bytes
    const isValid = await validateFileType(file.buffer, 'image')
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de archivo no permitido. Solo se permiten imágenes JPG, PNG, WebP y GIF'
      })
    }

    next()
  } catch (error) {
    logger.error('Error al validar imagen:', error)
    return res.status(500).json({
      success: false,
      message: 'Error al validar el archivo'
    })
  }
}

/**
 * Middleware para validar videos
 */
export const validateVideo = async (req, res, next) => {
  try {
    const file = req.file || (req.files && req.files.video && req.files.video[0])

    if (!file) {
      return next()
    }

    // Validar tamaño
    if (!validateFileSize(file.size, 'video')) {
      return res.status(400).json({
        success: false,
        message: `El video excede el tamaño máximo permitido (${FILE_LIMITS.video.maxSize / (1024 * 1024)}MB)`
      })
    }

    // Validar tipo usando magic bytes
    const isValid = await validateFileType(file.buffer, 'video')
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de archivo no permitido. Solo se permiten videos MP4, WebM y MOV'
      })
    }

    // TODO: Validar duración y aspect ratio usando ffprobe
    // Esto requeriría instalar ffmpeg/ffprobe en el servidor

    next()
  } catch (error) {
    logger.error('Error al validar video:', error)
    return res.status(500).json({
      success: false,
      message: 'Error al validar el archivo'
    })
  }
}

/**
 * Middleware para validar audio
 */
export const validateAudio = async (req, res, next) => {
  try {
    const file = req.file || (req.files && req.files.audio && req.files.audio[0])

    if (!file) {
      return next()
    }

    // Validar tamaño
    if (!validateFileSize(file.size, 'audio')) {
      return res.status(400).json({
        success: false,
        message: `El audio excede el tamaño máximo permitido (${FILE_LIMITS.audio.maxSize / (1024 * 1024)}MB)`
      })
    }

    // Validar tipo usando magic bytes
    const isValid = await validateFileType(file.buffer, 'audio')
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de archivo no permitido. Solo se permiten audios MP3, WAV, WebM y OGG'
      })
    }

    next()
  } catch (error) {
    logger.error('Error al validar audio:', error)
    return res.status(500).json({
      success: false,
      message: 'Error al validar el archivo'
    })
  }
}

/**
 * Validar múltiples archivos
 */
export const validateMultipleFiles = (fileType) => {
  return async (req, res, next) => {
    try {
      const files = req.files

      if (!files || Object.keys(files).length === 0) {
        return next()
      }

      // Validar cada archivo
      for (const fieldname in files) {
        const fileArray = Array.isArray(files[fieldname]) ? files[fieldname] : [files[fieldname]]

        for (const file of fileArray) {
          // Validar tamaño
          if (!validateFileSize(file.size, fileType)) {
            return res.status(400).json({
              success: false,
              message: 'Uno de los archivos excede el tamaño máximo permitido'
            })
          }

          // Validar tipo
          const isValid = await validateFileType(file.buffer, fileType)
          if (!isValid) {
            return res.status(400).json({
              success: false,
              message: 'Uno de los archivos no es del tipo permitido'
            })
          }
        }
      }

      next()
    } catch (error) {
      logger.error('Error al validar archivos:', error)
      return res.status(500).json({
        success: false,
        message: 'Error al validar los archivos'
      })
    }
  }
}

export { FILE_LIMITS }


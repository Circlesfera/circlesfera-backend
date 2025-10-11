// Configuración de dimensiones estándar para medios (Instagram-style)
const MEDIA_CONFIG = {
  // Stories (Historias efímeras de 24h)
  STORY: {
    width: 1080,
    height: 1350,
    ratio: 1080 / 1350, // 0.8 (4:5)
    maxDuration: 60, // segundos
    formats: ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov', 'avi'],
    description: 'Historias efímeras que duran 24 horas'
  },

  // Posts normales (Publicaciones del feed principal)
  POST: {
    width: 1080,
    height: 1080,
    ratio: 1, // 1:1 (cuadrado)
    maxDuration: 300, // 5 minutos
    formats: ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov', 'avi'],
    description: 'Publicaciones normales del feed principal'
  },

  // Reels (Videos cortos estilo TikTok)
  REEL: {
    width: 1080,
    height: 1920,
    ratio: 1080 / 1920, // 0.5625 (9:16)
    maxDuration: 90, // 90 segundos máximo
    formats: ['mp4', 'mov', 'avi'],
    description: 'Videos cortos estilo TikTok/Reels'
  },

  // Videos largos (IGTV, contenido extenso)
  LONG_VIDEO: {
    width: 1920,
    height: 1080,
    ratio: 16 / 9, // 16:9 (landscape)
    maxDuration: 3600, // 1 hora
    formats: ['mp4', 'mov', 'avi', 'mkv'],
    description: 'Videos largos, documentales, IGTV'
  },

  // Avatares de perfil
  AVATAR: {
    width: 400,
    height: 400,
    ratio: 1, // 1:1 (cuadrado)
    formats: ['jpg', 'jpeg', 'png', 'webp'],
    description: 'Foto de perfil del usuario'
  }
}

// Función para validar proporción de imagen/video
const validateAspectRatio = (width, height, targetType) => {
  if (!width || !height) return true // Skip validation if dimensions not provided

  const config = MEDIA_CONFIG[targetType]
  if (!config) return true // Skip validation if type not found

  const ratio = width / height
  const tolerance = 0.1 // 10% tolerance

  return Math.abs(ratio - config.ratio) <= tolerance
}

// Función para obtener dimensiones recomendadas
const getRecommendedDimensions = (type) => {
  const config = MEDIA_CONFIG[type]
  if (!config) {
    throw new Error(`Tipo de medio no válido: ${type}`)
  }

  return {
    width: config.width,
    height: config.height,
    ratio: config.ratio,
    maxDuration: config.maxDuration,
    formats: config.formats
  }
}

export {
  MEDIA_CONFIG,
  validateAspectRatio,
  getRecommendedDimensions
}

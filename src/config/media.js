// Configuración de dimensiones estándar para medios (Instagram oficial 2024-2025)
const MEDIA_CONFIG = {
  // Stories (Historias efímeras de 24h) - Pantalla completa vertical
  STORY: {
    width: 1080,
    height: 1920,
    ratio: 9 / 16, // 0.5625 (9:16) - Estándar oficial de Instagram
    maxDuration: 60, // segundos
    formats: ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov', 'avi'],
    description: 'Historias efímeras de 24h en formato vertical pantalla completa'
  },

  // Posts normales (Publicaciones del feed principal)
  // Instagram soporta: 1:1 (cuadrado), 4:5 (vertical), 1.91:1 (horizontal)
  POST: {
    width: 1080,
    height: 1080,
    ratio: 1, // 1:1 (cuadrado) - Formato principal
    maxDuration: 300, // 5 minutos
    formats: ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov', 'avi'],
    description: 'Publicaciones del feed (soporta 1:1, 4:5, 1.91:1)',
    variants: {
      square: { width: 1080, height: 1080, ratio: 1 }, // 1:1
      vertical: { width: 1080, height: 1350, ratio: 4 / 5 }, // 4:5
      horizontal: { width: 1080, height: 566, ratio: 1.91 / 1 } // 1.91:1
    }
  },

  // Reels (Videos cortos estilo TikTok) - Pantalla completa vertical
  REEL: {
    width: 1080,
    height: 1920,
    ratio: 9 / 16, // 0.5625 (9:16) - Estándar oficial de Instagram
    maxDuration: 90, // 90 segundos máximo
    formats: ['mp4', 'mov', 'avi'],
    description: 'Videos cortos verticales pantalla completa (TikTok/Reels)'
  },

  // IGTV (Videos largos)
  IGTV: {
    width: 1080,
    height: 1920,
    ratio: 9 / 16, // 9:16 (vertical) - Formato principal
    maxDuration: 3600, // 1 hora
    formats: ['mp4', 'mov', 'avi'],
    description: 'IGTV - Videos largos (soporta 9:16 vertical y 16:9 horizontal)',
    variants: {
      vertical: { width: 1080, height: 1920, ratio: 9 / 16 }, // 9:16
      horizontal: { width: 1920, height: 1080, ratio: 16 / 9 } // 16:9
    }
  },

  // Avatares de perfil (se muestra circular)
  AVATAR: {
    width: 320,
    height: 320,
    ratio: 1, // 1:1 (cuadrado)
    formats: ['jpg', 'jpeg', 'png', 'webp'],
    description: 'Foto de perfil (mínimo 320x320, se muestra circular)'
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

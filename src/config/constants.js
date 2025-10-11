/**
 * Constantes centralizadas de la aplicación
 * NO hardcodear valores en el código, usar estas constantes
 */

// ============================================
// LÍMITES DE CONTENIDO
// ============================================
export const CONTENT_LIMITS = {
  // Usuarios
  USERNAME: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 30
  },
  BIO: {
    MAX_LENGTH: 160
  },
  FULL_NAME: {
    MAX_LENGTH: 50
  },

  // Posts
  CAPTION: {
    MAX_LENGTH: 2200
  },
  TAGS: {
    MAX_PER_POST: 30,
    MAX_LENGTH: 50
  },
  IMAGES: {
    MAX_PER_POST: 10
  },

  // Comentarios
  COMMENT: {
    MAX_LENGTH: 500
  },

  // Mensajes
  MESSAGE: {
    MAX_LENGTH: 1000
  },

  // Stories
  STORY_DURATION_MS: 24 * 60 * 60 * 1000, // 24 horas

  // Reels
  REEL: {
    MAX_DURATION_SECONDS: 60,
    MIN_DURATION_SECONDS: 3
  }
}

// ============================================
// LÍMITES DE ARCHIVOS
// ============================================
export const FILE_LIMITS = {
  IMAGE: {
    MAX_SIZE: 10 * 1024 * 1024, // 10MB
    ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.gif', '.webp']
  },
  VIDEO: {
    MAX_SIZE: 100 * 1024 * 1024, // 100MB
    ALLOWED_TYPES: ['video/mp4', 'video/webm', 'video/quicktime'],
    ALLOWED_EXTENSIONS: ['.mp4', '.webm', '.mov'],
    MAX_DURATION: 60, // segundos
    MIN_DURATION: 3 // segundos
  },
  AUDIO: {
    MAX_SIZE: 10 * 1024 * 1024, // 10MB
    ALLOWED_TYPES: ['audio/mpeg', 'audio/wav', 'audio/ogg'],
    ALLOWED_EXTENSIONS: ['.mp3', '.wav', '.ogg']
  },
  AVATAR: {
    MAX_SIZE: 5 * 1024 * 1024, // 5MB
    ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
    ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp']
  }
}

// ============================================
// RATE LIMITS POR OPERACIÓN
// ============================================
export const RATE_LIMITS = {
  // Autenticación
  LOGIN: {
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5
  },
  REGISTER: {
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 3
  },
  PASSWORD_CHANGE: {
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 3
  },

  // Creación de contenido
  POST_CREATE: {
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 20
  },
  REEL_CREATE: {
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 15
  },
  STORY_CREATE: {
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 30
  },
  COMMENT_CREATE: {
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 100
  },

  // Mensajería
  SEND_MESSAGE: {
    windowMs: 60 * 1000, // 1 minuto
    max: 20
  },

  // Acciones sociales
  LIKE: {
    windowMs: 60 * 1000, // 1 minuto
    max: 60
  },
  FOLLOW: {
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 100
  }
}

// ============================================
// TIEMPOS DE CACHÉ (segundos)
// ============================================
export const CACHE_TTL = {
  USER_PROFILE: 15 * 60, // 15 minutos
  FEED: 5 * 60, // 5 minutos
  STORIES: 2 * 60, // 2 minutos
  TRENDING_POSTS: 30 * 60, // 30 minutos
  USER_STATS: 10 * 60, // 10 minutos
  SEARCH_RESULTS: 5 * 60 // 5 minutos
}

// ============================================
// PAGINACIÓN
// ============================================
export const PAGINATION = {
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
  MIN_LIMIT: 1
}

// ============================================
// VALIDACIÓN
// ============================================
export const VALIDATION = {
  PASSWORD: {
    MIN_LENGTH: 8,
    MAX_LENGTH: 128,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBER: true,
    REQUIRE_SPECIAL: false
  },
  SEARCH: {
    MIN_LENGTH: 2,
    MAX_LENGTH: 100
  },
  EMAIL: {
    MAX_LENGTH: 255
  }
}

// ============================================
// CÓDIGOS DE ESTADO HTTP
// ============================================
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500
}

// ============================================
// TIPOS DE NOTIFICACIONES
// ============================================
export const NOTIFICATION_TYPES = {
  LIKE: 'like',
  COMMENT: 'comment',
  FOLLOW: 'follow',
  MENTION: 'mention',
  MESSAGE: 'message',
  SYSTEM: 'system'
}

// ============================================
// TIPOS DE CONTENIDO
// ============================================
export const CONTENT_TYPES = {
  POST: {
    IMAGE: 'image',
    VIDEO: 'video'
  },
  STORY: {
    IMAGE: 'image',
    VIDEO: 'video',
    TEXT: 'text'
  },
  MESSAGE: {
    TEXT: 'text',
    IMAGE: 'image',
    VIDEO: 'video',
    AUDIO: 'audio',
    LOCATION: 'location'
  }
}

// ============================================
// FEATURES FLAGS (valores por defecto)
// ============================================
export const DEFAULT_FEATURES = {
  STORIES: true,
  REELS: true,
  LIVE: true,
  MESSAGES: true,
  NOTIFICATIONS: true,
  PUSH_NOTIFICATIONS: false
}

// ============================================
// MENSAJES DE ERROR COMUNES
// ============================================
export const ERROR_MESSAGES = {
  UNAUTHORIZED: 'No autorizado. Por favor, inicia sesión.',
  FORBIDDEN: 'No tienes permiso para realizar esta acción.',
  NOT_FOUND: 'Recurso no encontrado.',
  VALIDATION_ERROR: 'Error de validación en los datos proporcionados.',
  INTERNAL_ERROR: 'Error interno del servidor. Por favor, intenta más tarde.',
  RATE_LIMIT_EXCEEDED: 'Demasiadas peticiones. Por favor, intenta más tarde.',
  INVALID_CREDENTIALS: 'Credenciales inválidas.',
  USER_EXISTS: 'El usuario ya existe.',
  EMAIL_EXISTS: 'El email ya está registrado.',
  WEAK_PASSWORD: 'La contraseña no cumple con los requisitos de seguridad.'
}

// ============================================
// REGEX PATTERNS
// ============================================
export const REGEX_PATTERNS = {
  USERNAME: /^[a-zA-Z0-9._]{3,30}$/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  HASHTAG: /#[a-zA-Z0-9_]+/g,
  MENTION: /@[a-zA-Z0-9._]+/g,
  URL: /(https?:\/\/[^\s]+)/g
}

// ============================================
// EXPORTAR TODO COMO OBJETO ÚNICO (opcional)
// ============================================
export const CONSTANTS = {
  CONTENT_LIMITS,
  FILE_LIMITS,
  RATE_LIMITS,
  CACHE_TTL,
  PAGINATION,
  VALIDATION,
  HTTP_STATUS,
  NOTIFICATION_TYPES,
  CONTENT_TYPES,
  DEFAULT_FEATURES,
  ERROR_MESSAGES,
  REGEX_PATTERNS
}

export default CONSTANTS


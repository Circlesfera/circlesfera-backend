const { config } = require('./config');
const logger = require('./logger');

/**
 * Helper para gestionar URLs de CDN
 * Soporta CloudFront, Cloudflare, y otros CDNs
 */

/**
 * Obtener URL del CDN si está configurado, sino la URL local
 * @param {string} path - Ruta del archivo (ej: 'uploads/image.jpg')
 * @returns {string} URL completa del archivo
 */
const getCDNUrl = path => {
  // Si hay CDN configurado en producción, usarlo
  if (config.isProduction && process.env.CDN_URL) {
    return `${process.env.CDN_URL}/${path}`;
  }

  // En desarrollo o sin CDN, usar URL local
  const baseUrl = process.env.BASE_URL || 'http://localhost:5001';
  return `${baseUrl}/${path}`;
};

/**
 * Convertir path local a URL de CDN
 * @param {string} localPath - Path local del archivo
 * @returns {string} URL del CDN
 */
const convertToCDN = localPath => {
  // Remover 'uploads/' del inicio si existe
  const cleanPath = localPath.replace(/^uploads\//, '');
  return getCDNUrl(`uploads/${cleanPath}`);
};

/**
 * Generar URLs de CDN para múltiples archivos
 * @param {Array<string>} paths - Array de paths locales
 * @returns {Array<string>} Array de URLs de CDN
 */
const batchConvertToCDN = paths => {
  return paths.map(path => convertToCDN(path));
};

/**
 * Optimizar objeto con URLs para usar CDN
 * Reemplaza URLs locales por URLs de CDN recursivamente
 * @param {Object} obj - Objeto a procesar
 * @returns {Object} Objeto con URLs de CDN
 */
const optimizeObjectForCDN = obj => {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => optimizeObjectForCDN(item));
  }

  const result = {};

  for (const [key, value] of Object.entries(obj)) {
    // Si es una URL de imagen/video local, convertir a CDN
    if (
      (key === 'url' || key === 'avatar' || key === 'thumbnail') &&
      typeof value === 'string' &&
      value.includes('/uploads/')
    ) {
      result[key] = convertToCDN(value);
    }
    // Procesar recursivamente objetos anidados
    else if (value && typeof value === 'object') {
      result[key] = optimizeObjectForCDN(value);
    }
    // Mantener otros valores sin cambios
    else {
      result[key] = value;
    }
  }

  return result;
};

/**
 * Middleware para convertir URLs a CDN en respuestas
 */
const cdnMiddleware = (req, res, next) => {
  // Solo aplicar en producción si hay CDN configurado
  if (!config.isProduction || !process.env.CDN_URL) {
    return next();
  }

  // Interceptar res.json para modificar las URLs
  const originalJson = res.json.bind(res);

  res.json = function (data) {
    const optimizedData = optimizeObjectForCDN(data);
    return originalJson(optimizedData);
  };

  next();
};

/**
 * Invalidar caché de CDN (si soporta invalidación)
 * @param {Array<string>} paths - Paths a invalidar
 */
const invalidateCDN = async paths => {
  try {
    // TODO: Implementar invalidación según el CDN usado
    // Cloudflare, CloudFront, etc tienen APIs diferentes

    if (process.env.CDN_INVALIDATION_WEBHOOK) {
      // Llamar webhook de invalidación si está configurado
      await fetch(process.env.CDN_INVALIDATION_WEBHOOK, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.CDN_API_KEY && {
            Authorization: `Bearer ${process.env.CDN_API_KEY}`,
          }),
        },
        body: JSON.stringify({ paths }),
      });

      logger.info(`CDN invalidado para ${paths.length} archivos`);
    }
  } catch (error) {
    logger.error('Error invalidando CDN:', error);
    // No fallar si la invalidación falla
  }
};

/**
 * Verificar si CDN está configurado
 * @returns {boolean}
 */
const isCDNConfigured = () => {
  return config.isProduction && !!process.env.CDN_URL;
};

module.exports = {
  getCDNUrl,
  convertToCDN,
  batchConvertToCDN,
  optimizeObjectForCDN,
  cdnMiddleware,
  invalidateCDN,
  isCDNConfigured,
};

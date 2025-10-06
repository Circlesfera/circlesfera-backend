const { optimizeImage, createThumbnail } = require('../utils/mediaProcessor');
const logger = require('../utils/logger');

/**
 * Middleware para optimizar automáticamente imágenes subidas
 * Se ejecuta después del middleware de upload
 */
const imageOptimizer = async (req, res, next) => {
  try {
    // Si no hay archivos, continuar
    if (!req.files) {
      return next();
    }

    const filesToProcess = [];

    // Recopilar todos los archivos de imagen
    if (req.files.image) {
      filesToProcess.push(
        ...(Array.isArray(req.files.image)
          ? req.files.image
          : [req.files.image])
      );
    }
    if (req.files.images) {
      filesToProcess.push(
        ...(Array.isArray(req.files.images)
          ? req.files.images
          : [req.files.images])
      );
    }
    if (req.files.avatar) {
      filesToProcess.push(
        ...(Array.isArray(req.files.avatar)
          ? req.files.avatar
          : [req.files.avatar])
      );
    }

    // Filtrar solo imágenes
    const imageFiles = filesToProcess.filter(
      file => file.mimetype && file.mimetype.startsWith('image/')
    );

    if (imageFiles.length === 0) {
      return next();
    }

    // Optimizar imágenes en paralelo
    const optimizationPromises = imageFiles.map(async file => {
      try {
        // Optimizar imagen original
        await optimizeImage(file.path, {
          quality: 90,
          maxWidth: 1920,
          maxHeight: 1920,
        });

        // Crear thumbnail para imágenes de perfil o posts
        if (req.body.type === 'image' || file.fieldname === 'avatar') {
          await createThumbnail(file.path, 150);
        }

        logger.info(`Imagen optimizada: ${file.filename}`);
      } catch (error) {
        logger.error(`Error optimizando ${file.filename}:`, error);
        // No fallar si la optimización falla, continuar con el archivo original
      }
    });

    await Promise.all(optimizationPromises);

    next();
  } catch (error) {
    logger.error('Error en imageOptimizer middleware:', error);
    // No fallar, continuar con archivos sin optimizar
    next();
  }
};

module.exports = imageOptimizer;

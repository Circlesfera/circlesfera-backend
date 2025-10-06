const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const logger = require('./logger');

/**
 * Configuración de calidad y tamaños para imágenes
 */
const IMAGE_SIZES = {
  thumbnail: { width: 150, height: 150, quality: 80 },
  small: { width: 320, height: 320, quality: 85 },
  medium: { width: 640, height: 640, quality: 90 },
  large: { width: 1080, height: 1080, quality: 92 },
  original: { quality: 95 },
};

/**
 * Comprimir y redimensionar imagen
 * @param {string} inputPath - Ruta del archivo original
 * @param {string} outputPath - Ruta donde guardar el archivo procesado
 * @param {Object} options - Opciones de procesamiento
 * @returns {Promise<Object>} Información del archivo procesado
 */
const processImage = async (inputPath, outputPath, options = {}) => {
  try {
    const {
      width,
      height,
      quality = 90,
      format = 'jpeg',
      fit = 'cover',
    } = options;

    let pipeline = sharp(inputPath);

    // Redimensionar si se especifica
    if (width || height) {
      pipeline = pipeline.resize(width, height, {
        fit,
        withoutEnlargement: true,
      });
    }

    // Aplicar formato y calidad
    switch (format.toLowerCase()) {
      case 'jpeg':
      case 'jpg':
        pipeline = pipeline.jpeg({ quality, progressive: true });
        break;
      case 'png':
        pipeline = pipeline.png({ quality, progressive: true });
        break;
      case 'webp':
        pipeline = pipeline.webp({ quality });
        break;
      default:
        pipeline = pipeline.jpeg({ quality, progressive: true });
    }

    // Guardar archivo procesado
    await pipeline.toFile(outputPath);

    // Obtener información del archivo
    const stats = await fs.stat(outputPath);
    const metadata = await sharp(outputPath).metadata();

    return {
      path: outputPath,
      size: stats.size,
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
    };
  } catch (error) {
    logger.error('Error procesando imagen:', error);
    throw error;
  }
};

/**
 * Crear múltiples versiones de una imagen
 * @param {string} inputPath - Ruta de la imagen original
 * @param {string} baseOutputPath - Ruta base para guardar las versiones
 * @returns {Promise<Object>} Rutas de todas las versiones creadas
 */
const createImageVariants = async (inputPath, baseOutputPath) => {
  try {
    const ext = path.extname(baseOutputPath);
    const baseName = path.basename(baseOutputPath, ext);
    const dir = path.dirname(baseOutputPath);

    const variants = {};

    // Crear versiones en paralelo
    await Promise.all(
      Object.entries(IMAGE_SIZES).map(async ([sizeName, config]) => {
        const outputPath = path.join(dir, `${baseName}_${sizeName}${ext}`);

        await processImage(inputPath, outputPath, {
          ...config,
          format: ext.replace('.', ''),
        });

        variants[sizeName] = outputPath;
      })
    );

    return variants;
  } catch (error) {
    logger.error('Error creando variantes de imagen:', error);
    throw error;
  }
};

/**
 * Optimizar imagen manteniendo la calidad
 * @param {string} filePath - Ruta del archivo a optimizar
 * @param {Object} options - Opciones de optimización
 * @returns {Promise<Object>} Información del archivo optimizado
 */
const optimizeImage = async (filePath, options = {}) => {
  try {
    const { quality = 90, maxWidth = 1920, maxHeight = 1920 } = options;

    const metadata = await sharp(filePath).metadata();

    // Solo redimensionar si la imagen es muy grande
    let pipeline = sharp(filePath);

    if (metadata.width > maxWidth || metadata.height > maxHeight) {
      pipeline = pipeline.resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    // Aplicar compresión según el formato
    if (metadata.format === 'jpeg' || metadata.format === 'jpg') {
      pipeline = pipeline.jpeg({ quality, progressive: true });
    } else if (metadata.format === 'png') {
      pipeline = pipeline.png({
        quality,
        progressive: true,
        compressionLevel: 9,
      });
    } else if (metadata.format === 'webp') {
      pipeline = pipeline.webp({ quality });
    }

    // Sobrescribir archivo original
    const buffer = await pipeline.toBuffer();
    await fs.writeFile(filePath, buffer);

    const stats = await fs.stat(filePath);

    logger.info(
      `Imagen optimizada: ${filePath} (${(stats.size / 1024).toFixed(2)} KB)`
    );

    return {
      path: filePath,
      size: stats.size,
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
    };
  } catch (error) {
    logger.error('Error optimizando imagen:', error);
    throw error;
  }
};

/**
 * Convertir imagen a formato WebP (más eficiente)
 * @param {string} inputPath - Ruta de la imagen original
 * @param {number} quality - Calidad de la conversión (1-100)
 * @returns {Promise<string>} Ruta del archivo WebP
 */
const convertToWebP = async (inputPath, quality = 90) => {
  try {
    const outputPath = inputPath.replace(/\.(jpe?g|png)$/i, '.webp');

    await sharp(inputPath).webp({ quality }).toFile(outputPath);

    logger.info(`Imagen convertida a WebP: ${outputPath}`);

    return outputPath;
  } catch (error) {
    logger.error('Error convirtiendo a WebP:', error);
    throw error;
  }
};

/**
 * Crear thumbnail de una imagen
 * @param {string} inputPath - Ruta de la imagen original
 * @param {number} size - Tamaño del thumbnail (cuadrado)
 * @returns {Promise<string>} Ruta del thumbnail
 */
const createThumbnail = async (inputPath, size = 150) => {
  try {
    const ext = path.extname(inputPath);
    const thumbnailPath = inputPath.replace(ext, `_thumb${ext}`);

    await sharp(inputPath)
      .resize(size, size, {
        fit: 'cover',
        position: 'center',
      })
      .jpeg({ quality: 80, progressive: true })
      .toFile(thumbnailPath);

    logger.info(`Thumbnail creado: ${thumbnailPath}`);

    return thumbnailPath;
  } catch (error) {
    logger.error('Error creando thumbnail:', error);
    throw error;
  }
};

module.exports = {
  processImage,
  createImageVariants,
  optimizeImage,
  convertToWebP,
  createThumbnail,
  IMAGE_SIZES,
};

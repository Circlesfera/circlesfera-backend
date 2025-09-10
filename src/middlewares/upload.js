const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Crear directorio uploads si no existe
const uploadsDir = 'uploads';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename (req, file, cb) {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, uniqueSuffix + extension);
  },
});

const fileFilter = (req, file, cb) => {
  // Tipos de archivo permitidos
  const imageTypes = /jpeg|jpg|png|gif|webp/;
  const videoTypes = /mp4|avi|mov|wmv|flv|webm|mkv/;

  const extname = path.extname(file.originalname).toLowerCase();
  const isImage = imageTypes.test(extname) && file.mimetype.startsWith('image/');
  const isVideo = videoTypes.test(extname) && file.mimetype.startsWith('video/');

  if (isImage || isVideo) {
    return cb(null, true);
  }

  cb(new Error('Solo se permiten imágenes (JPEG, PNG, GIF, WebP) y videos (MP4, AVI, MOV, WMV, FLV, WebM, MKV)'));
};

// Configuración para diferentes tipos de archivo
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB máximo para todos los archivos
    files: 10, // Máximo 10 archivos por request
  },
});

// Middleware para manejar errores de multer
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'El archivo es demasiado grande. Máximo 100MB',
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Demasiados archivos. Máximo 10 archivos',
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Campo de archivo inesperado',
      });
    }
  }

  if (error.message.includes('Solo se permiten')) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  console.error('Error en upload:', error);
  return res.status(500).json({
    success: false,
    message: 'Error al subir archivo',
  });
};

// Configuraciones específicas
const uploadSingle = upload.single('file');
const uploadMultiple = upload.array('files', 10);
const uploadFields = upload.fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'images', maxCount: 10 },
  { name: 'image', maxCount: 1 },
  { name: 'video', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 },
]);

module.exports = {
  upload,
  uploadSingle,
  uploadMultiple,
  uploadFields,
  handleUploadError,
};

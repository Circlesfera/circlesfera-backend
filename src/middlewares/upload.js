const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
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
    fileSize: 100 * 1024 * 1024 // 100MB máximo para todos los archivos
  }
});

module.exports = upload;

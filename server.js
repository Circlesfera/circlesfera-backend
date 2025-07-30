require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./src/config/db');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Conexión a la base de datos
connectDB();

// Rutas
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/posts', require('./src/routes/post'));
app.use('/api/users', require('./src/routes/user'));
app.use('/api/comments', require('./src/routes/comment'));
app.use('/api/stories', require('./src/routes/story'));

// Servir imágenes de uploads
app.use('/uploads', express.static('uploads'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});

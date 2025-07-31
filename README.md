# CircleSfera Backend

Backend API para CircleSfera - Plataforma social moderna inspirada en Instagram.

## 🚀 Características

- **Autenticación JWT** - Sistema seguro de login y registro
- **Gestión de usuarios** - Perfiles, seguimientos, búsquedas
- **Posts y Stories** - Creación, edición, likes, comentarios
- **Sistema de mensajería** - Conversaciones directas y grupales
- **Notificaciones en tiempo real** - Sistema completo de notificaciones
- **API RESTful** - Endpoints bien documentados y estructurados
- **Seguridad avanzada** - Helmet, rate limiting, CORS configurado
- **Base de datos MongoDB** - Escalable y flexible

## 🛠️ Tecnologías

- **Node.js** - Runtime de JavaScript
- **Express 5** - Framework web
- **MongoDB** - Base de datos NoSQL
- **Mongoose** - ODM para MongoDB
- **JWT** - Autenticación stateless
- **Multer** - Manejo de archivos
- **Helmet** - Seguridad HTTP
- **Rate Limiting** - Protección contra spam

## 📋 Requisitos

- Node.js >= 18.0.0
- npm >= 9.0.0
- MongoDB (local o Atlas)

## 🔧 Instalación

1. **Clonar el repositorio**
   ```bash
   git clone https://github.com/Circlesfera/circlesfera-backend.git
   cd circlesfera-backend
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**
   ```bash
   cp .env.example .env
   ```
   
   Editar `.env` con tus configuraciones:
   ```env
   NODE_ENV=development
   PORT=5001
   MONGODB_URI=mongodb://localhost:27017/circlesfera
   JWT_SECRET=tu_jwt_secret_super_seguro
   ```

4. **Ejecutar el servidor**
   ```bash
   # Desarrollo
   npm run dev
   
   # Producción
   npm start
   ```

## 🚀 Scripts Disponibles

- `npm start` - Ejecutar en producción
- `npm run dev` - Ejecutar en desarrollo con nodemon
- `npm test` - Ejecutar tests
- `npm run lint` - Verificar código con ESLint
- `npm run lint:fix` - Corregir errores de ESLint
- `npm run format` - Formatear código con Prettier

## 📡 Endpoints Principales

### Autenticación
- `POST /api/auth/register` - Registro de usuarios
- `POST /api/auth/login` - Login de usuarios
- `POST /api/auth/refresh` - Renovar token

### Usuarios
- `GET /api/users/profile/:username` - Obtener perfil
- `GET /api/users/search` - Buscar usuarios
- `POST /api/users/:username/follow` - Seguir usuario

### Posts
- `GET /api/posts/feed` - Obtener feed
- `POST /api/posts` - Crear post
- `GET /api/posts/:id` - Obtener post específico

### Stories
- `GET /api/stories/feed` - Obtener stories
- `POST /api/stories` - Crear story
- `GET /api/stories/:id` - Obtener story específico

### Mensajería
- `GET /api/conversations` - Obtener conversaciones
- `POST /api/messages/conversation/:id/text` - Enviar mensaje

## 🔒 Seguridad

- **JWT Tokens** - Autenticación stateless
- **Rate Limiting** - Protección contra spam
- **Helmet** - Headers de seguridad HTTP
- **CORS** - Configuración específica de orígenes
- **Validación de datos** - Express-validator en todos los endpoints

## 🐛 Solución de Problemas

### Error de path-to-regexp
Si encuentras el error `Missing parameter name at X: https://git.new/pathToRegexpError`, esto es un problema conocido con Express 5 y las rutas catch-all. La solución implementada:

1. Eliminamos la ruta catch-all problemática `app.use('*', ...)`
2. Usamos un middleware de manejo de errores sin patrón específico
3. Las rutas no encontradas se manejan automáticamente

### Warnings de MongoDB
Los warnings sobre `useNewUrlParser` y `useUnifiedTopology` son normales en versiones recientes de MongoDB. Estos parámetros ya no son necesarios.

## 📝 Estructura del Proyecto

```
src/
├── config/
│   └── db.js          # Configuración de MongoDB
├── controllers/
│   ├── authController.js
│   ├── userController.js
│   ├── postController.js
│   ├── storyController.js
│   ├── commentController.js
│   ├── notificationController.js
│   ├── conversationController.js
│   └── messageController.js
├── middlewares/
│   ├── auth.js        # Middleware de autenticación
│   └── upload.js      # Middleware de subida de archivos
├── models/
│   ├── User.js
│   ├── Post.js
│   ├── Story.js
│   ├── Comment.js
│   ├── Notification.js
│   ├── Conversation.js
│   └── Message.js
└── routes/
    ├── auth.js
    ├── user.js
    ├── post.js
    ├── story.js
    ├── comment.js
    ├── notification.js
    ├── conversation.js
    └── message.js
```

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para detalles.

## 👥 Equipo

- **CircleSfera Team** - Desarrollo y mantenimiento

## 🔗 Enlaces

- [Frontend Repository](https://github.com/Circlesfera/circlesfera-frontend)
- [Documentación API](https://circlesfera.com/api-docs)
- [Sitio Web](https://circlesfera.com)

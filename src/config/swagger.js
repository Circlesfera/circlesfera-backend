const swaggerJsdoc = require('swagger-jsdoc')
const { config } = require('../utils/config')

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'CircleSfera API',
      version: '1.0.0',
      description: 'API REST para la red social CircleSfera - Instagram + TikTok moderna',
      contact: {
        name: 'CircleSfera Team',
        url: 'https://github.com/circlesfera',
        email: 'dev@circlesfera.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: `http://localhost:${config.port}`,
        description: 'Servidor de desarrollo'
      },
      {
        url: 'https://api.circlesfera.com',
        description: 'Servidor de producción'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Token JWT obtenido al hacer login o register'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '507f1f77bcf86cd799439011' },
            username: { type: 'string', example: 'john_doe' },
            email: { type: 'string', example: 'john@example.com' },
            fullName: { type: 'string', example: 'John Doe' },
            avatar: { type: 'string', nullable: true },
            bio: { type: 'string', nullable: true },
            isVerified: { type: 'boolean', default: false },
            followersCount: { type: 'number', example: 150 },
            followingCount: { type: 'number', example: 200 },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Post: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            user: { $ref: '#/components/schemas/User' },
            type: { type: 'string', enum: ['image', 'video'] },
            caption: { type: 'string' },
            likes: { type: 'array', items: { type: 'string' } },
            comments: { type: 'array', items: { type: 'string' } },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', default: false },
            message: { type: 'string' },
            errors: { type: 'array', items: { type: 'string' } }
          }
        }
      },
      responses: {
        UnauthorizedError: {
          description: 'Token de autenticación faltante o inválido',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        ValidationError: {
          description: 'Error de validación de datos',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ],
    tags: [
      { name: 'Auth', description: 'Autenticación y autorización' },
      { name: 'Users', description: 'Gestión de usuarios' },
      { name: 'Posts', description: 'Publicaciones' },
      { name: 'Reels', description: 'Videos cortos' },
      { name: 'Stories', description: 'Historias efímeras' },
      { name: 'Comments', description: 'Comentarios' },
      { name: 'Messages', description: 'Mensajería directa' },
      { name: 'Notifications', description: 'Notificaciones' },
      { name: 'Health', description: 'Health checks del sistema' }
    ]
  },
  apis: [
    './src/routes/*.js',
    './server.js'
  ]
}

module.exports = swaggerJsdoc(options)


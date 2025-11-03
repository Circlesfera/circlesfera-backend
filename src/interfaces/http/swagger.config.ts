import swaggerJsdoc from 'swagger-jsdoc';
import { env } from '@config/index.js';

const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'CircleSfera API',
      version: '0.1.0',
      description: 'API REST para CircleSfera - Plataforma social con funcionalidades de Instagram',
      contact: {
        name: 'CircleSfera Team'
      },
      license: {
        name: 'MIT'
      }
    },
    servers: [
      {
        url: env.API_URL || 'http://localhost:4000',
        description: 'Servidor de desarrollo'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Token de acceso JWT'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              description: 'Código de error legible'
            },
            message: {
              type: 'string',
              description: 'Mensaje de error para el usuario'
            },
            issues: {
              type: 'array',
              items: {
                type: 'object'
              },
              description: 'Detalles de validación (solo en errores de validación)'
            }
          }
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            handle: { type: 'string' },
            displayName: { type: 'string' },
            bio: { type: 'string', nullable: true },
            avatarUrl: { type: 'string', nullable: true },
            isVerified: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        Post: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            author: { $ref: '#/components/schemas/User' },
            caption: { type: 'string' },
            media: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  kind: { type: 'string', enum: ['image', 'video'] },
                  url: { type: 'string' },
                  thumbnailUrl: { type: 'string' },
                  width: { type: 'number', nullable: true },
                  height: { type: 'number', nullable: true },
                  durationMs: { type: 'number', nullable: true }
                }
              }
            },
            stats: {
              type: 'object',
              properties: {
                likes: { type: 'number' },
                comments: { type: 'number' },
                saves: { type: 'number' },
                shares: { type: 'number' },
                views: { type: 'number' }
              }
            },
            createdAt: { type: 'string', format: 'date-time' },
            isLikedByViewer: { type: 'boolean' },
            isSavedByViewer: { type: 'boolean' }
          }
        }
      }
    },
    tags: [
      { name: 'Auth', description: 'Autenticación y registro' },
      { name: 'Users', description: 'Gestión de usuarios y perfiles' },
      { name: 'Feed', description: 'Publicaciones y feeds' },
      { name: 'Interactions', description: 'Likes, comentarios, follows' },
      { name: 'Stories', description: 'Stories temporales' },
      { name: 'Messages', description: 'Mensajería directa' },
      { name: 'Notifications', description: 'Notificaciones' },
      { name: 'Hashtags', description: 'Gestión de hashtags' },
      { name: 'Analytics', description: 'Estadísticas y métricas' }
    ]
  },
  apis: ['./src/interfaces/http/routes/**/*.ts', './src/modules/**/controllers/*.ts']
};

export const swaggerSpec = swaggerJsdoc(swaggerOptions);


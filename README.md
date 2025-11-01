# CircleSfera Backend

Backend basado en Node.js + TypeScript siguiendo principios de Clean Architecture, SOLID y arquitectura hexagonal. Expone APIs REST y canales WebSocket para la plataforma social CircleSfera.

## Requisitos
- Node.js >= 20.10
- npm >= 10 (o pnpm/yarn configurados manualmente)
- Docker (para entornos locales con MongoDB/Redis/MinIO)

## Scripts
- `npm run dev`: inicia el servidor en modo desarrollo con recarga en caliente.
- `npm run build`: compila TypeScript a JavaScript en `dist/`.
- `npm run start`: ejecuta la versión compilada (uso en producción/PM2).
- `npm run lint`: ejecuta ESLint con reglas estrictas.
- `npm run test`: corre las pruebas unitarias/integración (Jest + Supertest).

## Estructura Clave
```
src/
  config/        Validación y orquestación de variables de entorno
  core/          Entidades, contratos, casos de uso y errores de dominio
  infra/         Adaptadores de infraestructura (MongoDB, Redis, S3, BullMQ, Logger)
  interfaces/    Entradas/salidas (HTTP, WebSocket)
  modules/       Contextos de negocio (auth, users, media, feed, interactions, moderation, analytics)
  shared/        Tipos utilitarios y helpers compartidos
  workers/       Procesos asíncronos (p.ej. pipeline ffmpeg)
```

## Flujo de Arranque
1. Validación de variables de entorno (`src/config/env.ts`).
2. Conexión a MongoDB, Redis y cliente S3 (`src/infra/**/*`).
3. Inicialización de Express + Socket.IO (`src/app.ts`).
4. Exposición de API REST en el mismo dominio que el frontend (`circlesfera.com`) bajo `/api/*` o el path configurado por el gateway.

## Documentación
- `docs/architecture/overview.md`: visión general de módulos y flujos.
- Próximamente: especificaciones OpenAPI por módulo en `docs/api/`.

## Próximos Pasos
1. Implementar módulo de autenticación con JWT & refresh tokens.
2. Configurar colas BullMQ y workers ffmpeg para procesamiento multimedia.
3. Integrar pipelines CI/CD y observabilidad (Sentry + OpenTelemetry).
4. Definir contrato OpenAPI y publicarlo para consumo directo desde el frontend unificado.

## Conexión a MongoDB
- **MongoDB Atlas**: actualiza tu `.env.local` estableciendo `MONGO_URI` con la cadena `mongodb+srv://…` proporcionada por Atlas. Asegúrate de permitir conexiones desde tu IP y de que el usuario tenga permisos sobre la base `circlesfera`.
- **Docker local**: si prefieres usar contenedores, levanta MongoDB con `docker compose` y deja `MONGO_URI=mongodb://mongo:27017/circlesfera`.
- En ambos casos, revisa también `REDIS_HOST`, `REDIS_PORT` y almacenamiento S3/MinIO según tu entorno.
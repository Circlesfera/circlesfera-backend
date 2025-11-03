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

## Servicios Requeridos

### MongoDB
- **MongoDB Atlas**: actualiza tu `.env.local` estableciendo `MONGO_URI` con la cadena `mongodb+srv://…` proporcionada por Atlas. Asegúrate de permitir conexiones desde tu IP y de que el usuario tenga permisos sobre la base `circlesfera`.
- **Docker local**: si prefieres usar contenedores, levanta MongoDB con `docker compose` y deja `MONGO_URI=mongodb://mongo:27017/circlesfera`.

### Redis
- **Docker local**: `REDIS_HOST=redis`, `REDIS_PORT=6379`
- **Redis local**: `REDIS_HOST=localhost`, `REDIS_PORT=6379`

### MinIO (Almacenamiento de medios)
MinIO es un servidor de almacenamiento de objetos compatible con S3. Se usa para almacenar imágenes y videos.

**Usando Docker Compose (recomendado):**

```bash
# Desde la raíz del proyecto
docker-compose up -d minio

# El bucket se crea automáticamente. Para verificar:
docker exec circlesfera-minio-setup /bin/sh -c "mc ls minio"
```

**Variables de entorno:**

```env
# Para desarrollo local (fuera de Docker)
S3_ENDPOINT=http://localhost:9000

# Para desarrollo con Docker
S3_ENDPOINT=http://minio:9000

S3_REGION=us-east-1
S3_ACCESS_KEY=local-dev-access-key
S3_SECRET_KEY=local-dev-secret-key
S3_BUCKET_MEDIA=circlesfera-media
```

**Configuración manual (si no usas Docker):**

1. Instalar MinIO: `brew install minio/stable/minio` (macOS) o descargar desde [min.io](https://min.io/download)
2. Iniciar: `minio server ~/minio-data --console-address ":9001"`
3. Ejecutar script de setup: `./scripts/setup-minio.sh`

**Acceso a la consola web:**
- URL: `http://localhost:9001`
- Usuario: `local-dev-access-key`
- Contraseña: `local-dev-secret-key`

Para más detalles, ver `../docs/minio-setup.md`.

## Inicio Rápido Completo

```bash
# 1. Levantar servicios con Docker
docker-compose up -d

# 2. Configurar variables de entorno
cp env.example .env
# Editar .env con las credenciales correctas

# 3. Instalar dependencias
npm install

# 4. Iniciar backend en desarrollo
npm run dev
```

El servidor estará disponible en `http://localhost:4000`.
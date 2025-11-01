<!-- Documentación de arquitectura del backend de CircleSfera -->
# Arquitectura Backend CircleSfera

## Propósito
Esta guía describe la arquitectura técnica del backend de CircleSfera, los módulos principales y los flujos de datos críticos. El objetivo es asegurar un desarrollo alineado con principios SOLID, Clean Architecture y escalabilidad horizontal desde el inicio.

## Visión General de Capas
```
Clientes (Web, Mobile) ──> Interfaces (HTTP/REST, Socket.IO) ──> Casos de Uso ──> Repositorios ──> Infraestructura (MongoDB, Redis, S3, Colas)
```

- **Interfaces**: Controladores Express y gateways Socket.IO aplican validaciones, autenticación y serialización.
- **Casos de uso**: Implementan la lógica de negocio agnóstica de tecnologías. Cada caso de uso depende de contratos definidos en `core`.
- **Repositorios**: Adaptadores que traducen contratos de dominio a implementaciones específicas (MongoDB, Redis, S3, ffmpeg workers).
- **Infraestructura**: Conectores externos (bases de datos, colas, servicios de terceros) encapsulados para facilitar pruebas y reemplazos.

## Módulos Principales
- `Auth`: registro/login, refresco de tokens, rotación y revocación.
- `Users`: perfiles, configuración de privacidad, seguidores/seguidos.
- `Media`: subida multipart con Multer, almacenamiento S3/MinIO, pipeline ffmpeg para compresión y thumbnails.
- `Feed`: construcción de timeline por relaciones y recomendaciones (Redis + agregaciones Mongo).
- `Interactions`: likes, comentarios, guardados, compartidos con notificaciones en tiempo real.
- `Moderation`: reportes, flags, gestión de contenido sensible.
- `Analytics`: eventos de engagement y retención, agregados servidos a paneles internos.

Cada módulo tendrá carpetas `controllers`, `dtos`, `services`, `repositories` y `mappers`, con pruebas unitarias e integración.

## Tecnologías Clave
- **Runtime**: Node.js 20 LTS, TypeScript estricto.
- **Framework**: Express 5 + Socket.IO para tiempo real.
- **Persistencia**: MongoDB (Typegoose), Redis (caching, colas, rate limiting), S3/MinIO para recursos multimedia.
- **Procesamiento**: BullMQ + workers ffmpeg (contenedorizados) para transcodificación asíncrona.
- **Autenticación**: JWT de acceso corto + refresh tokens en cookies httpOnly, alineado con dominio único (`circlesfera.com`), soporte para MFA futuro.
- **Seguridad**: Helmet, CORS granular, rate limiting (Redis), sanitización, auditoría con Pino + OpenTelemetry.

## Flujos Críticos
1. **Autenticación**: Registro → verificación credenciales (Argon2) → emisión JWT + refresh → almacenamiento de sesión en Redis → entrega de cookies httpOnly para consumo desde la misma raíz (`circlesfera.com`).
2. **Subida de medios**: Cliente firma URL → subida a backend → stream a S3 → evento en cola → worker ffmpeg procesa → actualización de metadatos.
3. **Feed**: Consulta agregada (MongoDB + Redis cache) → ordenación por relevancia → entrega paginada → invalidación en eventos de interacción.
4. **Notificaciones tiempo real**: Casos de uso publican eventos → Redis Pub/Sub → adaptador Socket.IO emite al canal del usuario.

## Pruebas y Calidad
- Tests unitarios por caso de uso (Jest).
- Tests de integración para controladores HTTP con Supertest.
- Tests end-to-end mediante entornos dockerizados.
- Cobertura mínima 80% con reportes en CI.

## Observabilidad
- Logs estructurados (Pino) con correlación de IDs.
- Monitoreo APM mediante OpenTelemetry → exportadores Prometheus/Grafana.
- Alertas en Sentry para errores críticos.

## Próximos Pasos
1. Definir `tsconfig` compartido y setup de linting.
2. Documentar contratos OpenAPI por módulo en `docs/api/`.
3. Elaborar ADR inicial sobre decisiones de persistencia y colas.
4. Configurar políticas de CORS y SameSite acordes al dominio único (`circlesfera.com`).

## Referencias
- [Clean Architecture](https://8thlight.com/blog/uncle-bob/2012/08/13/the-clean-architecture.html)
- [OWASP Cheat Sheets](https://cheatsheetseries.owasp.org/)

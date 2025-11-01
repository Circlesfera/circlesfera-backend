# Módulos de Dominio

Cada carpeta dentro de `src/modules` encapsula un contexto funcional específico. La organización sigue principios de Clean Architecture:

- `controllers/`: adaptadores HTTP/WS para el módulo.
- `dtos/`: objetos de transferencia y esquemas de validación (Zod).
- `services/`: casos de uso y orquestación de dominio.
- `repositories/`: implementaciones concretas de los contratos de persistencia.
- `mappers/`: transformaciones entre entidades, DTOs y modelos de persistencia.
- `__tests__/`: pruebas unitarias e integración del módulo.

Los módulos iniciales planificados son:
- `auth`
- `users`
- `media`
- `feed`
- `interactions`
- `moderation`
- `analytics`


# Configuración de GitHub Actions

Este directorio contiene los workflows de CI/CD para CircleSfera Backend.

## 🔐 Secrets Requeridos

Para que los workflows funcionen correctamente, necesitas configurar los siguientes **GitHub Secrets** en tu repositorio:

### Settings → Secrets and variables → Actions → New repository secret

### Secrets para Testing (CI)

| Secret | Descripción | Ejemplo |
|--------|-------------|---------|
| `JWT_SECRET_TEST` | Clave secreta para JWT en tests | `your-test-jwt-secret-key-minimum-32-chars` |
| `MONGODB_URI_TEST` | URI de MongoDB para tests | `mongodb://localhost:27017/circlesfera_test` |
| `REDIS_URL_TEST` | URL de Redis para tests (opcional) | `redis://localhost:6379` |

### Secrets para Producción (Deploy)

| Secret | Descripción | Ejemplo |
|--------|-------------|---------|
| `JWT_SECRET` | Clave secreta para JWT en producción | `your-production-jwt-secret-min-32-chars` |
| `MONGODB_URI` | URI de MongoDB Atlas en producción | `mongodb+srv://user:pass@cluster.mongodb.net/circlesfera` |
| `REDIS_URL` | URL de Redis en producción | `redis://your-redis-host:6379` |
| `SENTRY_DSN` | DSN de Sentry para monitoreo (opcional) | `https://xxx@sentry.io/xxx` |

### Secrets Opcionales

| Secret | Descripción |
|--------|-------------|
| `SNYK_TOKEN` | Token de Snyk para análisis de seguridad |
| `CODECOV_TOKEN` | Token de Codecov para reporte de cobertura |
| `SLACK_WEBHOOK` | Webhook de Slack para notificaciones |

## 📋 Workflows Disponibles

### `ci.yml` - Integración Continua

**Trigger:** Push o Pull Request a `main` o `develop`

**Jobs:**
1. **Test** - Ejecuta linting y tests en Node 18.x y 20.x
2. **Security** - Análisis de seguridad con npm audit y Snyk
3. **Build** - Verifica que el build de producción funcione
4. **Notify** - Notifica el resultado del CI

### `deploy.yml` - Deploy a Producción

**Trigger:** Push a `main` o manual

**Jobs:**
1. **Deploy** - Instala deps, ejecuta smoke tests y despliega

## 🚀 Cómo Configurar

### 1. Configurar Secrets en GitHub

```bash
# Ve a tu repositorio en GitHub
# Settings → Secrets and variables → Actions
# New repository secret

# Agregar cada secret listado arriba
```

### 2. Configurar Ambientes (Opcional)

Para el workflow de deploy, puedes crear un ambiente "production":

```
Settings → Environments → New environment → "production"
```

Esto permite:
- Requerir aprobación manual antes de deploy
- Configurar secrets específicos del ambiente
- Limitar qué branches pueden deployar

### 3. Habilitar GitHub Actions

```
Settings → Actions → General
Allow all actions and reusable workflows
```

## 🧪 Testing Localmente

Para simular el entorno de CI localmente:

```bash
# Crear archivo .env.test
cp .env.example .env.test

# Editar .env.test con valores de test
NODE_ENV=test
JWT_SECRET=your-test-jwt-secret-min-32-chars
MONGODB_URI=mongodb://localhost:27017/circlesfera_test
REDIS_URL=redis://localhost:6379

# Ejecutar tests
npm test -- --coverage
```

## 📊 Badges para README

Agrega estos badges a tu README principal:

```markdown
![CI](https://github.com/tu-usuario/circlesfera-backend/workflows/CI/badge.svg)
![Deploy](https://github.com/tu-usuario/circlesfera-backend/workflows/Deploy/badge.svg)
[![codecov](https://codecov.io/gh/tu-usuario/circlesfera-backend/branch/main/graph/badge.svg)](https://codecov.io/gh/tu-usuario/circlesfera-backend)
```

## ⚠️ Notas Importantes

1. **NUNCA** commits secrets o credenciales en el código
2. **SIEMPRE** usa GitHub Secrets para valores sensibles
3. Los secrets NO se exponen en logs de GitHub Actions
4. Rota secrets regularmente (cada 90 días mínimo)
5. Usa diferentes secrets para test y producción

## 🔒 Seguridad

- Los secrets están encriptados en GitHub
- Solo son accesibles durante la ejecución del workflow
- NO se imprimen en logs (son enmascarados)
- Tienen ámbito limitado al repositorio/ambiente

## 📚 Recursos

- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [GitHub Secrets Docs](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Best Practices](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)


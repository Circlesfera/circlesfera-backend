# 👑 Guía para Asignar Roles de Admin/Moderador

## 🎯 Roles Disponibles

CircleSfera tiene 3 niveles de roles:

```
👤 USER (default)
   - Crear contenido (posts, reels, stories)
   - Comentar y dar like
   - Seguir usuarios
   - Reportar contenido
   - Mensajería

👮 MODERATOR
   - Todo lo de User
   - ✅ Acceso al panel de administración (/admin)
   - ✅ Ver y gestionar reportes
   - ✅ Ver estadísticas de moderación
   - ✅ Tomar acciones: aprobar, rechazar, eliminar contenido

👑 ADMIN
   - Todo lo de Moderator
   - ✅ Cambiar roles de otros usuarios
   - ✅ Acceso completo al sistema
   - ✅ Gestión de configuración
```

---

## 🚀 OPCIÓN 1: Script Node.js (Recomendado)

**La forma más fácil y segura**

### Uso:

```bash
cd circlesfera-backend
node assign-role.js <username> <role>
```

### Ejemplos:

```bash
# Hacer a "johndoe" administrador
node assign-role.js johndoe admin

# Hacer a "janedoe" moderador
node assign-role.js janedoe moderator

# Quitar permisos (volver a user normal)
node assign-role.js someuser user
```

### Salida:

```
🔄 Conectando a MongoDB...
✅ Conectado a MongoDB

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ ROL ACTUALIZADO EXITOSAMENTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Usuario:      johndoe
  Email:        john@example.com
  Rol Anterior: user
  Rol Nuevo:    admin
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎉 Este usuario ahora es ADMINISTRADOR
   Puede acceder a: /admin
   Permisos: gestionar reportes, usuarios, estadísticas

✅ Desconectado de MongoDB
```

### Características:

- ✅ Conexión automática a MongoDB
- ✅ Validación de username y rol
- ✅ Muestra rol anterior y nuevo
- ✅ Notificación al usuario
- ✅ Logging completo
- ✅ Desconexión segura

---

## 🌐 OPCIÓN 2: API Endpoint (Para Producción)

**Desde código o Postman/cURL**

### Endpoint:

```
PUT /api/users/:userId/role
```

### Autenticación:

- Requiere: JWT token de un **admin**
- Header: `Authorization: Bearer <token>`
- CSRF token requerido

### Body:

```json
{
  "role": "admin"  // o "moderator" o "user"
}
```

### Ejemplo con cURL:

```bash
curl -X PUT http://localhost:5001/api/users/USER_ID/role \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "X-CSRF-Token: YOUR_CSRF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "admin"}'
```

### Respuesta:

```json
{
  "success": true,
  "message": "Rol actualizado de \"user\" a \"admin\" exitosamente",
  "user": {
    "_id": "...",
    "username": "johndoe",
    "email": "john@example.com",
    "role": "admin",
    "fullName": "John Doe",
    "avatar": "..."
  }
}
```

### Validaciones:

- ✅ Solo admins pueden cambiar roles
- ✅ No puedes cambiar tu propio rol
- ✅ Rol debe ser válido (user, moderator, admin)
- ✅ Usuario debe existir
- ✅ Notificación automática al usuario

---

## 💾 OPCIÓN 3: MongoDB Directamente

**Desde MongoDB Compass o mongosh**

### Usando MongoDB Compass (UI):

1. Conectar a MongoDB Atlas
2. Ir a la base de datos `circlesfera_dev`
3. Ir a la colección `users`
4. Buscar el usuario por username:
   ```javascript
   { "username": "johndoe" }
   ```
5. Editar el documento y agregar/cambiar:
   ```javascript
   { "role": "admin" }
   ```
6. Guardar cambios

### Usando mongosh (CLI):

```bash
# Conectar a MongoDB
mongosh "mongodb+srv://CircleSfera:PASSWORD@circlesfera.5calsal.mongodb.net/circlesfera_dev"

# Actualizar rol
db.users.updateOne(
  { username: "johndoe" },
  { $set: { role: "admin" } }
)

# Verificar
db.users.findOne({ username: "johndoe" }, { username: 1, email: 1, role: 1 })
```

### Actualizar múltiples usuarios:

```javascript
// Hacer admins a varios usuarios
db.users.updateMany(
  { username: { $in: ["user1", "user2", "user3"] } },
  { $set: { role: "admin" } }
)

// Ver todos los admins
db.users.find({ role: "admin" }, { username: 1, email: 1, role: 1 })

// Ver todos los moderadores
db.users.find({ role: "moderator" }, { username: 1, email: 1, role: 1 })
```

---

## 🔍 Verificar Roles Asignados

### Ver todos los usuarios con roles especiales:

```bash
# Con el script (próximamente)
node list-admins.js

# Con MongoDB
db.users.find(
  { role: { $in: ["admin", "moderator"] } },
  { username: 1, email: 1, role: 1, fullName: 1 }
).pretty()
```

---

## 🛡️ Seguridad

### Importante:

1. **Solo admins pueden cambiar roles** ✅
2. **No puedes cambiar tu propio rol** ✅
3. **Validación de rol** (user, moderator, admin) ✅
4. **Logging de todos los cambios** ✅
5. **Notificación al usuario** ✅

### Logs:

Todos los cambios de rol se registran en:
```bash
tail -f logs/combined.log | grep "Rol de usuario actualizado"
```

---

## 📝 Recomendaciones

### Para tu primer admin:

```bash
# Opción más fácil:
cd circlesfera-backend
node assign-role.js tu_username admin

# Verifica que funcione:
# 1. Login en la app
# 2. Ir a http://localhost:3001/admin
# 3. Deberías ver el dashboard
```

### Para producción:

1. **Siempre usar el script** para asignar roles iniciales
2. **Usar el API endpoint** para gestión programática
3. **Usar MongoDB directamente** solo para emergencias

### Buenas prácticas:

- ✅ Mínimo de admins (1-2 personas)
- ✅ Moderadores según necesidad (escala gradual)
- ✅ Revisar logs regularmente
- ✅ No compartir credenciales de admin

---

## 🧪 Testing

### Probar el script:

```bash
# 1. Crear usuario de prueba (desde la app o API)
# 2. Asignar rol admin
node assign-role.js test_user admin

# 3. Login con ese usuario
# 4. Ir a /admin
# 5. Verificar que puedes ver reportes
```

### Probar el endpoint API:

```bash
# Necesitas un token de admin existente
# Obtener token: login como admin → copiar token
curl -X PUT http://localhost:5001/api/users/USER_ID/role \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "X-CSRF-Token: CSRF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "moderator"}'
```

---

## ❓ Preguntas Frecuentes

### ¿Cómo me hago admin a mí mismo?

```bash
# Con el script (más fácil):
node assign-role.js tu_username admin

# O con MongoDB directamente:
db.users.updateOne(
  { username: "tu_username" },
  { $set: { role: "admin" } }
)
```

### ¿Puedo tener múltiples admins?

Sí, no hay límite. Pero recomendamos:
- 1-2 admins (máxima confianza)
- 3-5 moderadores (según carga de trabajo)

### ¿Cómo quito permisos a un admin?

```bash
# Cambiar a user normal:
node assign-role.js username user
```

### ¿El usuario recibe notificación?

Sí, al cambiar el rol se crea una notificación automáticamente.

### ¿Qué pasa si cambio mi propio rol por error?

No puedes. El endpoint/script previene cambiar tu propio rol.

### ¿Los cambios son inmediatos?

Sí, pero el usuario necesitará:
1. **Cerrar sesión**
2. **Volver a iniciar sesión**
3. El nuevo rol se cargará con el login

---

## 📚 Archivos Relacionados

- `src/controllers/userController.js` - Función `changeUserRole`
- `src/routes/user.js` - Ruta `PUT /:userId/role`
- `src/schemas/userSchema.js` - Validación `changeRoleSchema`
- `src/middlewares/checkRole.js` - Middleware de autorización
- `src/models/User.js` - Campo `role` en schema
- `assign-role.js` - Script de asignación

---

## ✅ Checklist

Antes de asignar el primer admin:

- [ ] Backend funcionando
- [ ] MongoDB Atlas conectado
- [ ] Usuario registrado en la app
- [ ] Conoces el username exacto
- [ ] Script assign-role.js disponible

Ejecutar:

```bash
node assign-role.js <username> admin
```

¡Listo! Ya tienes un admin. 🎉

---

**Nota:** Este sistema permite contenido para adultos consensuado. Los moderadores deben entender la política de moderación (ver dashboard).


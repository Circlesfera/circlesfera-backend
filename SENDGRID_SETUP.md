# 📧 Configuración de SendGrid

## ✅ Instalación Completada

SendGrid ya está instalado y configurado en el código. Solo necesitas agregar las variables de entorno.

## 🔑 Variables de Entorno Requeridas

Agrega estas variables a tu archivo `.env`:

```env
# Email Service Configuration
EMAIL_SERVICE=sendgrid
EMAIL_FROM=noreply@circlesfera.com
EMAIL_FROM_NAME=CircleSfera
SENDGRID_API_KEY=SG.tu_api_key_aqui
```

## 📝 Cómo Obtener tu SendGrid API Key

1. **Inicia sesión en SendGrid**
   - Ve a https://sendgrid.com
   - Inicia sesión con tu cuenta

2. **Crea una API Key**
   - Settings → API Keys
   - Click "Create API Key"
   - Nombre: "CircleSfera Production"
   - Permisos: "Full Access" (o "Mail Send" mínimo)
   - Click "Create & View"

3. **Copia la API Key**
   - ⚠️ **IMPORTANTE**: Solo se muestra UNA VEZ
   - Copia y guárdala en tu .env

4. **Verifica tu dominio (Opcional pero Recomendado)**
   - Settings → Sender Authentication
   - Verifica tu dominio para mejor deliverability
   - Sigue las instrucciones de DNS

## 🔄 Configuración Rápida

### Desarrollo (Logging)

```env
NODE_ENV=development
EMAIL_SERVICE=development
# Los emails se loguean pero NO se envían
```

### Producción (SendGrid Real)

```env
NODE_ENV=production
EMAIL_SERVICE=sendgrid
EMAIL_FROM=noreply@tudominio.com
EMAIL_FROM_NAME=CircleSfera
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## 🧪 Probar el Servicio

### Desde el código:

```javascript
import EmailService from './services/emailService.js'

const emailService = new EmailService()

// Test de envío
await emailService.sendPasswordResetEmail(
  'tu@email.com',
  'username',
  'token_de_prueba'
)
```

### Verificar en logs:

**Desarrollo:**
```
📧 Email (DEV MODE): { to: 'email@example.com', subject: '...' }
```

**Producción:**
```
✅ Email enviado exitosamente: { to: 'email@example.com', messageId: '...' }
```

## 📊 Planes de SendGrid

### Free Tier
- ✅ 100 emails/día (3,000/mes)
- ✅ Suficiente para desarrollo y MVP
- ✅ $0/mes

### Essentials
- 💰 $19.95/mes
- 📨 50,000 emails/mes
- ✅ Recomendado para producción

### Pro
- 💰 $89.95/mes
- 📨 100,000 emails/mes
- ✅ Para escala

## 🔧 Características Implementadas

✅ **Password Reset Emails**
- Template HTML profesional
- Link seguro con token
- Expiración de 1 hora

✅ **Password Changed Confirmation**
- Notificación de cambio exitoso
- Alerta de seguridad

✅ **Error Handling**
- Logs detallados
- Retry logic incluido en SendGrid SDK
- Validación de configuración

✅ **Desarrollo vs Producción**
- Modo desarrollo: solo logs
- Modo producción: envío real con SendGrid

## 🔒 Seguridad

### ✅ Buenas Prácticas Implementadas:

1. **API Key en .env** (nunca en código)
2. **Validación de configuración** al inicio
3. **Logging seguro** (sin exponer datos sensibles)
4. **Error handling** robusto

### ⚠️ Recomendaciones:

1. **No compartir API Keys**
2. **Rotar keys** cada 3-6 meses
3. **Usar permisos mínimos** necesarios
4. **Monitorear uso** en dashboard SendGrid
5. **Verificar dominio** para mejor deliverability

## 📈 Monitoreo

### Dashboard SendGrid:
- **Activity Feed**: Ver emails enviados
- **Stats**: Métricas de deliverability
- **Suppressions**: Bounces y unsubscribes
- **Alerts**: Configurar alertas de uso

### Logs Backend:
```bash
# Ver logs de emails
tail -f logs/combined.log | grep "Email"

# Solo errores
tail -f logs/error.log | grep "email"
```

## 🐛 Troubleshooting

### Email no se envía:

1. **Verifica NODE_ENV y EMAIL_SERVICE**
   ```bash
   echo $NODE_ENV  # debe ser 'production'
   echo $EMAIL_SERVICE  # debe ser 'sendgrid'
   ```

2. **Verifica API Key**
   ```bash
   echo $SENDGRID_API_KEY  # debe empezar con 'SG.'
   ```

3. **Revisa logs**
   ```bash
   tail -f logs/error.log
   ```

### Email va a spam:

1. **Verifica tu dominio** en SendGrid
2. **Configura SPF/DKIM** en tu DNS
3. **Evita palabras spam** en subject
4. **No envíes desde @gmail.com** (usa tu dominio)

### Rate limit excedido:

1. **Free tier**: 100/día
2. **Upgrade plan** o espera 24h
3. **Implementar queue** si es necesario

## 🔗 Links Útiles

- 📚 [SendGrid Docs](https://docs.sendgrid.com/)
- 🔑 [API Keys](https://app.sendgrid.com/settings/api_keys)
- 📊 [Dashboard](https://app.sendgrid.com/dashboard)
- 🎯 [Sender Authentication](https://app.sendgrid.com/settings/sender_auth)
- 💬 [Support](https://support.sendgrid.com/)

## ✅ Checklist de Configuración

- [ ] Cuenta SendGrid creada
- [ ] API Key generada
- [ ] Variables agregadas a .env
- [ ] Servidor reiniciado
- [ ] Test de envío exitoso
- [ ] Logs verificados
- [ ] Dominio verificado (producción)
- [ ] SPF/DKIM configurados (producción)

---

**¡Configuración completa! 🎉**

Tu servicio de email ya está listo para enviar emails reales en producción.


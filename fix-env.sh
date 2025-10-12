#!/bin/bash

# Script para corregir el archivo .env para desarrollo local

echo "🔧 Corrigiendo archivo .env para desarrollo local..."
echo ""

# Crear backup si no existe
if [ ! -f .env.backup ]; then
  cp .env .env.backup
  echo "✅ Backup creado: .env.backup"
else
  echo "ℹ️  Usando backup existente: .env.backup"
fi

# Extraer credenciales del backup
MONGODB_URI=$(grep "^MONGODB_URI=" .env.backup | head -1 | cut -d'=' -f2-)
JWT_SECRET=$(grep "^JWT_SECRET=" .env.backup | head -1 | cut -d'=' -f2-)
JWT_REFRESH_SECRET=$(grep "^JWT_REFRESH_SECRET=" .env.backup | head -1 | cut -d'=' -f2-)
SENDGRID_API_KEY=$(grep "^SENDGRID_API_KEY=" .env.backup | head -1 | cut -d'=' -f2-)

# Crear nuevo .env limpio
cat > .env << EOF
# ===================================
# CIRCLESFERA BACKEND - DEVELOPMENT
# ===================================

# ENTORNO
NODE_ENV=development
PORT=5001

# BASE DE DATOS (MongoDB Atlas)
MONGODB_URI=$MONGODB_URI

# JWT SECRETS
JWT_SECRET=$JWT_SECRET
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d
BCRYPT_SALT_ROUNDS=12

# CORS (desarrollo)
CORS_ORIGIN=http://localhost:3001,http://localhost:3000

# URLs (desarrollo)
APP_URL=http://localhost:5001
API_URL=http://localhost:5001
FRONTEND_URL=http://localhost:3001

# EMAIL - SENDGRID
EMAIL_SERVICE=development
EMAIL_FROM=noreply@circlesfera.com
EMAIL_FROM_NAME=CircleSfera
SENDGRID_API_KEY=$SENDGRID_API_KEY

# RATE LIMITING
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# UPLOADS
UPLOAD_DIR=uploads
MAX_FILE_SIZE=104857600
MAX_FILES_COUNT=10

# LOGGING
LOG_LEVEL=info

# CONTACTO
CONTACT_EMAIL=contact@circlesfera.com
SUPPORT_EMAIL=support@circlesfera.com
EOF

echo "✅ Archivo .env actualizado para desarrollo"
echo ""
echo "📋 Cambios realizados:"
echo "  ✅ NODE_ENV=development (sin duplicados)"
echo "  ✅ EMAIL_SERVICE=development (para testing local)"
echo "  ✅ URLs de desarrollo configuradas"
echo "  ✅ CORS configurado para localhost"
echo "  ✅ SENDGRID_API_KEY preservada"
echo ""
echo "⚠️  IMPORTANTE:"
echo "  - Verifica que MONGODB_URI tenga tus credenciales correctas"
echo "  - Verifica que JWT_SECRET sea seguro (mínimo 32 caracteres)"
echo ""
echo "🚀 Para arrancar el servidor:"
echo "  npm run dev"
echo ""
echo "📧 Para testing de email en producción:"
echo "  Cambia EMAIL_SERVICE=sendgrid"
echo ""


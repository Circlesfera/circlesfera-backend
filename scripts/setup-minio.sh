#!/bin/bash

# Script para configurar MinIO después de que esté corriendo
# Uso: ./scripts/setup-minio.sh

set -e

MINIO_ENDPOINT="${S3_ENDPOINT:-http://localhost:9000}"
MINIO_ACCESS_KEY="${S3_ACCESS_KEY:-local-dev-access-key}"
MINIO_SECRET_KEY="${S3_SECRET_KEY:-local-dev-secret-key}"
MINIO_BUCKET="${S3_BUCKET_MEDIA:-circlesfera-media}"

echo "🚀 Configurando MinIO..."
echo "Endpoint: $MINIO_ENDPOINT"
echo "Bucket: $MINIO_BUCKET"

# Instalar mc (MinIO Client) si no está instalado
if ! command -v mc &> /dev/null; then
    echo "📦 Instalando MinIO Client (mc)..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        brew install minio/stable/mc || echo "Instala minio client manualmente: brew install minio/stable/mc"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        wget https://dl.min.io/client/mc/release/linux-amd64/mc -O /tmp/mc
        chmod +x /tmp/mc
        sudo mv /tmp/mc /usr/local/bin/mc
    else
        echo "❌ Sistema operativo no soportado. Instala MinIO Client manualmente."
        exit 1
    fi
fi

# Configurar alias
echo "⚙️  Configurando alias de MinIO..."
mc alias set minio "$MINIO_ENDPOINT" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY"

# Crear bucket si no existe
echo "📦 Creando bucket '$MINIO_BUCKET'..."
mc mb "minio/$MINIO_BUCKET" --ignore-existing

# Configurar políticas de acceso (permiso de lectura público para media)
echo "🔒 Configurando políticas de acceso..."
mc anonymous set download "minio/$MINIO_BUCKET"

# Mostrar información del bucket
echo "✅ MinIO configurado exitosamente!"
echo ""
echo "📊 Información del bucket:"
mc ls "minio/$MINIO_BUCKET"
echo ""
echo "🌐 MinIO Console: http://localhost:9001"
echo "   Usuario: $MINIO_ACCESS_KEY"
echo "   Contraseña: $MINIO_SECRET_KEY"


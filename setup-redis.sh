#!/bin/bash

# Script para configurar Redis en desarrollo
# CircleSfera Backend - Setup Redis

echo "🔧 Configurando Redis para desarrollo..."

# Verificar si Redis está instalado
if ! command -v redis-server &> /dev/null; then
    echo "❌ Redis no está instalado."
    echo "📦 Instalando Redis..."

    # Detectar el sistema operativo
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install redis
        else
            echo "❌ Homebrew no está instalado. Por favor instala Redis manualmente."
            echo "💡 Visita: https://redis.io/docs/getting-started/installation/"
            exit 1
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        sudo apt-get update
        sudo apt-get install redis-server
    else
        echo "❌ Sistema operativo no soportado. Por favor instala Redis manualmente."
        echo "💡 Visita: https://redis.io/docs/getting-started/installation/"
        exit 1
    fi
fi

# Verificar si Redis está ejecutándose
if ! redis-cli ping &> /dev/null; then
    echo "🚀 Iniciando Redis..."

    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        brew services start redis
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        sudo systemctl start redis-server
    fi

    # Esperar a que Redis esté listo
    sleep 2

    if redis-cli ping &> /dev/null; then
        echo "✅ Redis está ejecutándose correctamente."
    else
        echo "❌ Error al iniciar Redis."
        exit 1
    fi
else
    echo "✅ Redis ya está ejecutándose."
fi

# Configurar variables de entorno
echo "🔧 Configurando variables de entorno..."

# Verificar si existe .env
if [ ! -f .env ]; then
    echo "📝 Creando archivo .env..."
    cp .env.example .env 2>/dev/null || touch .env
fi

# Agregar Redis URL si no existe
if ! grep -q "REDIS_URL" .env; then
    echo "REDIS_URL=redis://localhost:6379" >> .env
    echo "✅ REDIS_URL agregado al archivo .env"
else
    echo "✅ REDIS_URL ya está configurado en .env"
fi

# Mostrar información de Redis
echo ""
echo "🎉 Redis configurado exitosamente!"
echo "📊 Información de Redis:"
echo "   - Host: localhost"
echo "   - Puerto: 6379"
echo "   - URL: redis://localhost:6379"
echo ""
echo "🔍 Para verificar que Redis funciona:"
echo "   redis-cli ping"
echo ""
echo "🚀 Para iniciar el servidor backend:"
echo "   npm run dev"
echo ""
echo "💡 Para detener Redis:"
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "   brew services stop redis"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "   sudo systemctl stop redis-server"
fi

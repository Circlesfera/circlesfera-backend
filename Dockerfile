# Dockerfile para CircleSfera Backend
FROM node:20-alpine

# Instalar dependencias del sistema
RUN apk add --no-cache dumb-init wget

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install --omit=dev && npm cache clean --force

# Copiar código fuente
COPY . .

# Cambiar propiedad de archivos al usuario nodejs
RUN chown -R nodejs:nodejs /app
USER nodejs

# Crear directorio de logs
RUN mkdir -p logs

# Exponer puerto
EXPOSE 3001

# Variables de entorno
ENV NODE_ENV=production
ENV PORT=3001

# Comando de inicio
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]

import mongoose from 'mongoose'
import logger from '../utils/logger.js'

const connectDB = async () => {
  try {
    // Verificar que la URI de MongoDB esté configurada
    const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI

    if (!mongoURI) {
      throw new Error('MONGODB_URI no está configurada en las variables de entorno')
    }

    logger.info('🔗 Intentando conectar a MongoDB...')
    // Ocultar credenciales en logs - solo mostrar host
    const sanitizedUri = mongoURI.includes('@')
      ? `mongodb://${mongoURI.split('@')[1]}`
      : 'mongodb://localhost'
    logger.info(`📊 Conectando a: ${sanitizedUri}`)

    await mongoose.connect(mongoURI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferCommands: false
    })

    logger.info('✅ MongoDB conectado exitosamente')
    logger.info(`📊 Base de datos: ${mongoose.connection.name}`)
    logger.info(`🌐 Host: ${mongoose.connection.host}:${mongoose.connection.port}`)

    // Manejar eventos de conexión
    mongoose.connection.on('error', (err) => {
      logger.error('❌ Error en la conexión de MongoDB:', err)
    })

    mongoose.connection.on('disconnected', () => {
      logger.warn('⚠️  MongoDB desconectado')
    })

    // Manejar cierre graceful
    process.on('SIGINT', async () => {
      await mongoose.connection.close()
      logger.info('🔄 Conexión de MongoDB cerrada por terminación de la aplicación')
      process.exit(0)
    })

  } catch (error) {
    logger.error('❌ Error al conectar a MongoDB:', error.message)
    logger.error('💡 Asegúrate de que MongoDB esté ejecutándose y la URI sea correcta')
    logger.error('💡 Asegúrate de que tu URI de MongoDB Atlas sea correcta')
    process.exit(1)
  }
}

export default connectDB

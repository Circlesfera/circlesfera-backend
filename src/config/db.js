const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Usar MongoDB Atlas por defecto según las preferencias del usuario
    const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb+srv://username:password@cluster.mongodb.net/circlesfera?retryWrites=true&w=majority';

    console.log('🔗 Intentando conectar a MongoDB...');
    console.log(`📊 URI: ${mongoURI}`);

    await mongoose.connect(mongoURI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferCommands: false,
    });

    console.log('✅ MongoDB conectado exitosamente');
    console.log(`📊 Base de datos: ${mongoose.connection.name}`);
    console.log(`🌐 Host: ${mongoose.connection.host}:${mongoose.connection.port}`);

    // Manejar eventos de conexión
    mongoose.connection.on('error', (err) => {
      console.error('❌ Error en la conexión de MongoDB:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️  MongoDB desconectado');
    });

    // Manejar cierre graceful
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('🔄 Conexión de MongoDB cerrada por terminación de la aplicación');
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Error al conectar a MongoDB:', error.message);
    console.error('💡 Asegúrate de que MongoDB esté ejecutándose y la URI sea correcta');
    console.error('💡 Si usas MongoDB local, ejecuta: brew services start mongodb-community');
    process.exit(1);
  }
};

module.exports = connectDB;

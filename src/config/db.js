const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/circlesfera';
    
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
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
    process.exit(1);
  }
};

module.exports = connectDB;

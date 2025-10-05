#!/usr/bin/env node

/**
 * Script para crear usuarios de prueba
 * USO: node src/utils/create-test-users.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const logger = require('../utils/logger');

async function createTestUsers() {
  try {
    // Conectar a la base de datos
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/circlesfera', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    logger.info('🔗 Conectado a la base de datos');
    
    // Verificar que todas las variables de entorno estén configuradas
    const requiredEnvVars = [
      'TEST_USER_1_USERNAME',
      'TEST_USER_1_EMAIL', 
      'TEST_USER_1_PASSWORD',
      'TEST_USER_1_FULLNAME',
      'TEST_USER_1_BIO',
      'TEST_USER_2_USERNAME',
      'TEST_USER_2_EMAIL',
      'TEST_USER_2_PASSWORD',
      'TEST_USER_2_FULLNAME',
      'TEST_USER_2_BIO'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      throw new Error(`Variables de entorno requeridas no configuradas: ${missingVars.join(', ')}`);
    }
    
    // Crear usuario 1
    const user1 = new User({
      username: process.env.TEST_USER_1_USERNAME,
      email: process.env.TEST_USER_1_EMAIL,
      password: process.env.TEST_USER_1_PASSWORD,
      fullName: process.env.TEST_USER_1_FULLNAME,
      bio: process.env.TEST_USER_1_BIO
    });
    
    await user1.save();
    logger.info('✅ Usuario 1 creado:', user1.username);
    
    // Crear usuario 2
    const user2 = new User({
      username: process.env.TEST_USER_2_USERNAME,
      email: process.env.TEST_USER_2_EMAIL,
      password: process.env.TEST_USER_2_PASSWORD,
      fullName: process.env.TEST_USER_2_FULLNAME,
      bio: process.env.TEST_USER_2_BIO
    });
    
    await user2.save();
    logger.info('✅ Usuario 2 creado:', user2.username);
    
    // Mostrar información de los usuarios
    logger.info('📊 Usuarios creados:');
    logger.info(`   - ${user1.username} (ID: ${user1._id})`);
    logger.info(`   - ${user2.username} (ID: ${user2._id})`);
    
  } catch (error) {
    if (error.code === 11000) {
      logger.warn('⚠️  Los usuarios ya existen');
    } else {
      logger.error('❌ Error al crear usuarios:', error);
      throw error;
    }
  } finally {
    // Cerrar conexión
    await mongoose.connection.close();
    logger.info('🔌 Conexión a la base de datos cerrada');
  }
}

// Ejecutar el script
if (require.main === module) {
  createTestUsers()
    .then(() => {
      logger.info('🎉 Script completado exitosamente');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('💥 Error fatal:', error);
      process.exit(1);
    });
}

module.exports = createTestUsers;

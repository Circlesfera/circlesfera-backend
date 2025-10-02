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
    
    // Crear usuario 1
    const user1 = new User({
      username: 'testuser',
      email: 'testuser@example.com',
      password: 'password123',
      fullName: 'Usuario de Prueba',
      bio: 'Usuario de prueba para CircleSfera'
    });
    
    await user1.save();
    logger.info('✅ Usuario 1 creado:', user1.username);
    
    // Crear usuario 2
    const user2 = new User({
      username: 'circlesfera',
      email: 'circlesfera@example.com',
      password: 'password123',
      fullName: 'CircleSfera',
      bio: 'Cuenta oficial de CircleSfera'
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

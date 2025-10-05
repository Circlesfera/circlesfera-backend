#!/usr/bin/env node

/**
 * Script para eliminar todos los usuarios de la base de datos
 * USO: node scripts/delete-all-users.js
 * 
 * ⚠️  ADVERTENCIA: Este script eliminará TODOS los usuarios de la base de datos
 * ⚠️  Esta acción NO se puede deshacer
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const logger = require('../utils/logger');

async function deleteAllUsers() {
  try {
    // Conectar a la base de datos
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/circlesfera', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    logger.info('🔗 Conectado a la base de datos');
    
    // Contar usuarios antes de eliminar
    const userCount = await User.countDocuments();
    logger.info(`📊 Total de usuarios en la base de datos: ${userCount}`);
    
    if (userCount === 0) {
      logger.info('✅ No hay usuarios para eliminar');
      return;
    }
    
    // Confirmar eliminación
    logger.warn('⚠️  ADVERTENCIA: Se eliminarán TODOS los usuarios');
    logger.warn('⚠️  Esta acción NO se puede deshacer');
    
    // Eliminar todos los usuarios
    const result = await User.deleteMany({});
    
    logger.info(`🗑️  Usuarios eliminados: ${result.deletedCount}`);
    
    // Verificar que se eliminaron todos
    const remainingUsers = await User.countDocuments();
    
    if (remainingUsers === 0) {
      logger.info('✅ Todos los usuarios han sido eliminados exitosamente');
    } else {
      logger.error(`❌ Error: Quedan ${remainingUsers} usuarios en la base de datos`);
    }
    
    // Mostrar estadísticas finales
    logger.info('📈 Estadísticas finales:');
    logger.info(`   - Usuarios eliminados: ${result.deletedCount}`);
    logger.info(`   - Usuarios restantes: ${remainingUsers}`);
    
  } catch (error) {
    logger.error('❌ Error al eliminar usuarios:', error);
    throw error;
  } finally {
    // Cerrar conexión
    await mongoose.connection.close();
    logger.info('🔌 Conexión a la base de datos cerrada');
  }
}

// Ejecutar el script
if (require.main === module) {
  deleteAllUsers()
    .then(() => {
      logger.info('🎉 Script completado exitosamente');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('💥 Error fatal:', error);
      process.exit(1);
    });
}

module.exports = deleteAllUsers;

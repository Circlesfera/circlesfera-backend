#!/usr/bin/env node

/**
 * Script para probar que un usuario no puede seguir/bloquearse a sí mismo
 * USO: node src/utils/test-self-actions.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const logger = require('../utils/logger');

async function testSelfActions() {
  try {
    // Conectar a la base de datos
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/circlesfera', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    logger.info('🔗 Conectado a la base de datos');
    
    // Buscar usuario de prueba
    const testUser = await User.findOne({ username: 'testuser' });
    
    if (!testUser) {
      logger.error('❌ No se encontró el usuario de prueba');
      return;
    }
    
    logger.info(`📊 Usuario encontrado: ${testUser.username} (ID: ${testUser._id})`);
    
    // Test 1: Intentar seguirse a sí mismo
    logger.info('\n🧪 Test 1: Intentar seguirse a sí mismo');
    
    if (testUser.following.includes(testUser._id)) {
      logger.warn('⚠️  El usuario ya se está siguiendo a sí mismo - removiendo...');
      testUser.following = testUser.following.filter(
        id => id.toString() !== testUser._id.toString()
      );
      await testUser.save();
      logger.info('✅ Auto-seguimiento removido');
    } else {
      logger.info('ℹ️  El usuario no se está siguiendo a sí mismo (correcto)');
    }
    
    // Test 2: Intentar bloquearse a sí mismo
    logger.info('\n🧪 Test 2: Intentar bloquearse a sí mismo');
    
    if (testUser.blockedUsers.includes(testUser._id)) {
      logger.warn('⚠️  El usuario ya se tiene bloqueado a sí mismo - removiendo...');
      testUser.blockedUsers = testUser.blockedUsers.filter(
        id => id.toString() !== testUser._id.toString()
      );
      await testUser.save();
      logger.info('✅ Auto-bloqueo removido');
    } else {
      logger.info('ℹ️  El usuario no se tiene bloqueado a sí mismo (correcto)');
    }
    
    // Test 3: Verificar que no puede seguirse a sí mismo
    logger.info('\n🧪 Test 3: Verificar validación de auto-seguimiento');
    
    try {
      // Intentar añadir a following
      if (!testUser.following.includes(testUser._id)) {
        testUser.following.push(testUser._id);
        await testUser.save();
        logger.error('❌ ERROR: El usuario pudo seguirse a sí mismo');
        
        // Remover inmediatamente
        testUser.following = testUser.following.filter(
          id => id.toString() !== testUser._id.toString()
        );
        await testUser.save();
        logger.info('✅ Auto-seguimiento removido');
      }
    } catch (error) {
      logger.info('✅ Validación funcionando: No se puede seguir a sí mismo');
    }
    
    // Test 4: Verificar que no puede bloquearse a sí mismo
    logger.info('\n🧪 Test 4: Verificar validación de auto-bloqueo');
    
    try {
      // Intentar añadir a blockedUsers
      if (!testUser.blockedUsers.includes(testUser._id)) {
        testUser.blockedUsers.push(testUser._id);
        await testUser.save();
        logger.error('❌ ERROR: El usuario pudo bloquearse a sí mismo');
        
        // Remover inmediatamente
        testUser.blockedUsers = testUser.blockedUsers.filter(
          id => id.toString() !== testUser._id.toString()
        );
        await testUser.save();
        logger.info('✅ Auto-bloqueo removido');
      }
    } catch (error) {
      logger.info('✅ Validación funcionando: No se puede bloquear a sí mismo');
    }
    
    // Estado final
    const finalUser = await User.findById(testUser._id);
    logger.info('\n📊 Estado final del usuario:');
    logger.info(`   - Following: [${finalUser.following.join(', ')}]`);
    logger.info(`   - Blocked Users: [${finalUser.blockedUsers.join(', ')}]`);
    
    // Verificar que no se sigue a sí mismo
    const isFollowingSelf = finalUser.following.includes(finalUser._id);
    const isBlockingSelf = finalUser.blockedUsers.includes(finalUser._id);
    
    if (!isFollowingSelf && !isBlockingSelf) {
      logger.info('✅ Usuario limpio: No se sigue ni se bloquea a sí mismo');
    } else {
      logger.error('❌ Usuario con problemas de auto-acción');
    }
    
    logger.info('\n🎉 Test completado exitosamente');
    
  } catch (error) {
    logger.error('❌ Error en test:', error);
    throw error;
  } finally {
    // Cerrar conexión
    await mongoose.connection.close();
    logger.info('🔌 Conexión a la base de datos cerrada');
  }
}

// Ejecutar el script
if (require.main === module) {
  testSelfActions()
    .then(() => {
      logger.info('✅ Test de auto-acciones completado');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('💥 Error fatal:', error);
      process.exit(1);
    });
}

module.exports = testSelfActions;

#!/usr/bin/env node

/**
 * Script para probar la funcionalidad de follow/unfollow
 * USO: node src/utils/test-follow.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const logger = require('../utils/logger');

async function testFollowUnfollow() {
  try {
    // Conectar a la base de datos
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/circlesfera', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    logger.info('🔗 Conectado a la base de datos');
    
    // Buscar usuarios de prueba
    const user1 = await User.findOne({ username: 'testuser' });
    const user2 = await User.findOne({ username: 'circlesfera' });
    
    if (!user1 || !user2) {
      logger.error('❌ No se encontraron los usuarios de prueba');
      return;
    }
    
    logger.info('📊 Usuarios encontrados:');
    logger.info(`   - ${user1.username} (ID: ${user1._id})`);
    logger.info(`   - ${user2.username} (ID: ${user2._id})`);
    
    // Estado inicial
    logger.info('🔍 Estado inicial:');
    logger.info(`   - ${user1.username} following: [${user1.following.join(', ')}]`);
    logger.info(`   - ${user2.username} followers: [${user2.followers.join(', ')}]`);
    
    // Test 1: user1 sigue a user2
    logger.info('\n🧪 Test 1: user1 sigue a user2');
    
    if (!user1.following.includes(user2._id)) {
      user1.following.push(user2._id);
      await user1.save();
      
      user2.followers.push(user1._id);
      await user2.save();
      
      logger.info('✅ user1 ahora sigue a user2');
    } else {
      logger.info('ℹ️  user1 ya seguía a user2');
    }
    
    // Estado después del follow
    const user1AfterFollow = await User.findById(user1._id);
    const user2AfterFollow = await User.findById(user2._id);
    
    logger.info('📊 Estado después del follow:');
    logger.info(`   - ${user1AfterFollow.username} following: [${user1AfterFollow.following.join(', ')}]`);
    logger.info(`   - ${user2AfterFollow.username} followers: [${user2AfterFollow.followers.join(', ')}]`);
    
    // Test 2: user1 deja de seguir a user2
    logger.info('\n🧪 Test 2: user1 deja de seguir a user2');
    
    if (user1AfterFollow.following.includes(user2._id)) {
      user1AfterFollow.following = user1AfterFollow.following.filter(
        id => id.toString() !== user2._id.toString()
      );
      await user1AfterFollow.save();
      
      user2AfterFollow.followers = user2AfterFollow.followers.filter(
        id => id.toString() !== user1._id.toString()
      );
      await user2AfterFollow.save();
      
      logger.info('✅ user1 dejó de seguir a user2');
    } else {
      logger.info('ℹ️  user1 no seguía a user2');
    }
    
    // Estado final
    const user1Final = await User.findById(user1._id);
    const user2Final = await User.findById(user2._id);
    
    logger.info('📊 Estado final:');
    logger.info(`   - ${user1Final.username} following: [${user1Final.following.join(', ')}]`);
    logger.info(`   - ${user2Final.username} followers: [${user2Final.followers.join(', ')}]`);
    
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
  testFollowUnfollow()
    .then(() => {
      logger.info('✅ Test de follow/unfollow completado');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('💥 Error fatal:', error);
      process.exit(1);
    });
}

module.exports = testFollowUnfollow;

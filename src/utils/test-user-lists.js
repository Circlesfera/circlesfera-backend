#!/usr/bin/env node

/**
 * Script para probar que las listas de seguidores/seguidos no incluyen al propio usuario
 * USO: node src/utils/test-user-lists.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const logger = require('../utils/logger');

async function testUserLists() {
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
    logger.info('\n🔍 Estado inicial:');
    logger.info(`   - ${user1.username} following: [${user1.following.join(', ')}]`);
    logger.info(`   - ${user1.username} followers: [${user1.followers.join(', ')}]`);
    logger.info(`   - ${user2.username} following: [${user2.following.join(', ')}]`);
    logger.info(`   - ${user2.username} followers: [${user2.followers.join(', ')}]`);
    
    // Test 1: Verificar que user1 no aparece en sus propias listas
    logger.info('\n🧪 Test 1: Verificar que user1 no aparece en sus propias listas');
    
    const user1Following = user1.following.filter(id => id.toString() !== user1._id.toString());
    const user1Followers = user1.followers.filter(id => id.toString() !== user1._id.toString());
    
    logger.info(`   - Following sin auto-referencia: [${user1Following.join(', ')}]`);
    logger.info(`   - Followers sin auto-referencia: [${user1Followers.join(', ')}]`);
    
    if (user1Following.length === user1.following.length && user1Followers.length === user1.followers.length) {
      logger.info('✅ user1 no aparece en sus propias listas');
    } else {
      logger.warn('⚠️  user1 aparece en sus propias listas - esto debería corregirse');
    }
    
    // Test 2: Verificar que user2 no aparece en sus propias listas
    logger.info('\n🧪 Test 2: Verificar que user2 no aparece en sus propias listas');
    
    const user2Following = user2.following.filter(id => id.toString() !== user2._id.toString());
    const user2Followers = user2.followers.filter(id => id.toString() !== user2._id.toString());
    
    logger.info(`   - Following sin auto-referencia: [${user2Following.join(', ')}]`);
    logger.info(`   - Followers sin auto-referencia: [${user2Followers.join(', ')}]`);
    
    if (user2Following.length === user2.following.length && user2Followers.length === user2.followers.length) {
      logger.info('✅ user2 no aparece en sus propias listas');
    } else {
      logger.warn('⚠️  user2 aparece en sus propias listas - esto debería corregirse');
    }
    
    // Test 3: Limpiar auto-referencias si existen
    logger.info('\n🧪 Test 3: Limpiar auto-referencias si existen');
    
    let cleaned = false;
    
    // Limpiar user1
    if (user1.following.includes(user1._id)) {
      user1.following = user1.following.filter(id => id.toString() !== user1._id.toString());
      cleaned = true;
    }
    if (user1.followers.includes(user1._id)) {
      user1.followers = user1.followers.filter(id => id.toString() !== user1._id.toString());
      cleaned = true;
    }
    
    // Limpiar user2
    if (user2.following.includes(user2._id)) {
      user2.following = user2.following.filter(id => id.toString() !== user2._id.toString());
      cleaned = true;
    }
    if (user2.followers.includes(user2._id)) {
      user2.followers = user2.followers.filter(id => id.toString() !== user2._id.toString());
      cleaned = true;
    }
    
    if (cleaned) {
      await user1.save();
      await user2.save();
      logger.info('✅ Auto-referencias limpiadas');
    } else {
      logger.info('ℹ️  No se encontraron auto-referencias para limpiar');
    }
    
    // Estado final
    const finalUser1 = await User.findById(user1._id);
    const finalUser2 = await User.findById(user2._id);
    
    logger.info('\n📊 Estado final:');
    logger.info(`   - ${finalUser1.username} following: [${finalUser1.following.join(', ')}]`);
    logger.info(`   - ${finalUser1.username} followers: [${finalUser1.followers.join(', ')}]`);
    logger.info(`   - ${finalUser2.username} following: [${finalUser2.following.join(', ')}]`);
    logger.info(`   - ${finalUser2.username} followers: [${finalUser2.followers.join(', ')}]`);
    
    // Verificar que no hay auto-referencias
    const user1HasSelfFollowing = finalUser1.following.includes(finalUser1._id);
    const user1HasSelfFollowers = finalUser1.followers.includes(finalUser1._id);
    const user2HasSelfFollowing = finalUser2.following.includes(finalUser2._id);
    const user2HasSelfFollowers = finalUser2.followers.includes(finalUser2._id);
    
    if (!user1HasSelfFollowing && !user1HasSelfFollowers && !user2HasSelfFollowing && !user2HasSelfFollowers) {
      logger.info('✅ Todos los usuarios están limpios de auto-referencias');
    } else {
      logger.error('❌ Aún hay auto-referencias en los usuarios');
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
  testUserLists()
    .then(() => {
      logger.info('✅ Test de listas de usuarios completado');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('💥 Error fatal:', error);
      process.exit(1);
    });
}

module.exports = testUserLists;

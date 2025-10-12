#!/usr/bin/env node

/**
 * Script para asignar roles a usuarios en CircleSfera
 *
 * Uso:
 *   node assign-role.js <username> <role>
 *
 * Roles disponibles: user, moderator, admin
 *
 * Ejemplos:
 *   node assign-role.js johndoe admin
 *   node assign-role.js janedoe moderator
 *   node assign-role.js normaluser user
 */

import mongoose from 'mongoose'
import User from './src/models/User.js'
import { config } from './src/utils/config.js'
import logger from './src/utils/logger.js'

const VALID_ROLES = ['user', 'moderator', 'admin']

const assignRole = async () => {
  try {
    // Obtener argumentos
    const username = process.argv[2]
    const role = process.argv[3]

    // Validar argumentos
    if (!username || !role) {
      console.error('\n❌ Error: Debes proporcionar username y rol\n')
      console.log('Uso: node assign-role.js <username> <role>\n')
      console.log('Ejemplos:')
      console.log('  node assign-role.js johndoe admin')
      console.log('  node assign-role.js janedoe moderator\n')
      process.exit(1)
    }

    if (!VALID_ROLES.includes(role)) {
      console.error(`\n❌ Error: Rol "${role}" no es válido\n`)
      console.log(`Roles válidos: ${VALID_ROLES.join(', ')}\n`)
      process.exit(1)
    }

    console.log('\n🔄 Conectando a MongoDB...\n')

    // Conectar a MongoDB
    await mongoose.connect(config.mongodbUri)
    console.log('✅ Conectado a MongoDB\n')

    // Buscar usuario
    const user = await User.findOne({ username: username.toLowerCase() })

    if (!user) {
      console.error(`❌ Error: Usuario "${username}" no encontrado\n`)
      await mongoose.disconnect()
      process.exit(1)
    }

    // Verificar rol actual
    const oldRole = user.role || 'user'

    if (oldRole === role) {
      console.log(`ℹ️  El usuario "${username}" ya tiene el rol "${role}"\n`)
      await mongoose.disconnect()
      process.exit(0)
    }

    // Actualizar rol
    user.role = role
    await user.save()

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('✅ ROL ACTUALIZADO EXITOSAMENTE')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`  Usuario:      ${user.username}`)
    console.log(`  Email:        ${user.email}`)
    console.log(`  Rol Anterior: ${oldRole}`)
    console.log(`  Rol Nuevo:    ${role}`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    if (role === 'admin') {
      console.log('🎉 Este usuario ahora es ADMINISTRADOR')
      console.log('   Puede acceder a: /admin')
      console.log('   Permisos: gestionar reportes, usuarios, estadísticas\n')
    } else if (role === 'moderator') {
      console.log('👮 Este usuario ahora es MODERADOR')
      console.log('   Puede acceder a: /admin')
      console.log('   Permisos: gestionar reportes, ver estadísticas\n')
    } else {
      console.log('👤 Este usuario ahora es USUARIO NORMAL')
      console.log('   Sin acceso a panel de administración\n')
    }

    logger.info('Rol actualizado:', {
      username: user.username,
      oldRole,
      newRole: role
    })

    await mongoose.disconnect()
    console.log('✅ Desconectado de MongoDB\n')
    process.exit(0)

  } catch (error) {
    console.error('\n❌ Error:', error.message, '\n')
    logger.error('Error en assign-role:', error)

    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect()
    }

    process.exit(1)
  }
}

// Ejecutar script
assignRole()


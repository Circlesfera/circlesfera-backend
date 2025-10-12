/**
 * Script de prueba para verificar que SendGrid está configurado correctamente
 *
 * Uso:
 *   node test-email.js tu@email.com
 */

import emailService from './src/services/emailService.js'
import logger from './src/utils/logger.js'
import { config } from './src/utils/config.js'

const testEmail = async () => {

  // Email de destino (desde argumentos o default)
  const toEmail = process.argv[2] || 'luisfeliu@circlesfera.com'

  console.log('\n🧪 TEST DE EMAIL SERVICE\n')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📊 Configuración actual:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  NODE_ENV:        ${config.nodeEnv}`)
  console.log(`  EMAIL_SERVICE:   ${config.emailService}`)
  console.log(`  EMAIL_FROM:      ${config.emailFrom}`)
  console.log(`  EMAIL_FROM_NAME: ${config.emailFromName}`)
  console.log(`  SENDGRID_API_KEY: ${config.sendgridApiKey ? '✅ Configurada' : '❌ No configurada'}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  // Verificar configuración
  if (config.emailService === 'sendgrid' && !config.sendgridApiKey) {
    console.error('❌ ERROR: EMAIL_SERVICE=sendgrid pero SENDGRID_API_KEY no está configurada\n')
    process.exit(1)
  }

  try {
    console.log(`📧 Enviando email de prueba a: ${toEmail}\n`)

    // Enviar email de prueba
    const result = await emailService.sendPasswordResetEmail(
      toEmail,
      'Usuario de Prueba',
      'test-token-12345'
    )

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('✅ RESULTADO:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('  Success:    ✅', result.success)
    console.log('  Message ID: ', result.messageId)
    console.log('  Provider:   ', result.provider || 'N/A')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    if (config.emailService === 'development') {
      console.log('ℹ️  Modo desarrollo: Email NO enviado, solo logueado')
      console.log('   Para enviar emails reales, configura:\n')
      console.log('   EMAIL_SERVICE=sendgrid')
      console.log('   SENDGRID_API_KEY=tu_api_key\n')
    } else if (config.emailService === 'sendgrid') {
      console.log('✅ Email enviado exitosamente con SendGrid!')
      console.log('   Verifica tu inbox (incluyendo spam)\n')
      console.log('📊 Dashboard SendGrid:')
      console.log('   https://app.sendgrid.com/activity\n')
    }

  } catch (error) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.error('❌ ERROR AL ENVIAR EMAIL:')
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.error('  Mensaje:', error.message)
    if (error.response) {
      console.error('  Código:', error.code)
      console.error('  Detalles:', error.response?.body)
    }
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    console.log('💡 Posibles soluciones:\n')
    console.log('1. Verifica que SENDGRID_API_KEY sea correcta')
    console.log('2. Verifica que la API Key tenga permisos "Mail Send"')
    console.log('3. Verifica que el email FROM esté verificado en SendGrid')
    console.log('4. Revisa: https://app.sendgrid.com/settings/api_keys\n')

    process.exit(1)
  }
}

// Ejecutar test
testEmail()


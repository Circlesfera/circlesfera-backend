import logger from '../utils/logger.js'
import { config } from '../utils/config.js'

/**
 * Servicio de Email
 *
 * Por ahora loguea los emails en desarrollo.
 * En producción, integrar con:
 * - SendGrid (npm install @sendgrid/mail)
 * - Nodemailer + SMTP
 * - AWS SES
 * - Mailgun
 */

class EmailService {
  constructor() {
    this.from = config.emailFrom || 'CircleSfera <noreply@circlesfera.com>'
    this.isDevelopment = config.isDevelopment
  }

  /**
   * Enviar email de recuperación de contraseña
   */
  async sendPasswordResetEmail(email, username, resetToken) {
    const resetUrl = `${config.frontendUrl}/reset-password?token=${resetToken}`

    const subject = 'Recupera tu contraseña - CircleSfera'
    const html = this.getPasswordResetTemplate(username, resetUrl)
    const text = `
Hola ${username},

Recibimos una solicitud para restablecer tu contraseña en CircleSfera.

Para crear una nueva contraseña, haz clic en el siguiente enlace:
${resetUrl}

Este enlace expira en 1 hora.

Si no solicitaste este cambio, ignora este correo y tu contraseña permanecerá igual.

Saludos,
El equipo de CircleSfera
    `.trim()

    return this.send({
      to: email,
      subject,
      html,
      text
    })
  }

  /**
   * Enviar email de confirmación de cambio de contraseña
   */
  async sendPasswordChangedEmail(email, username) {
    const subject = 'Tu contraseña ha sido cambiada - CircleSfera'
    const html = this.getPasswordChangedTemplate(username)
    const text = `
Hola ${username},

Tu contraseña de CircleSfera ha sido cambiada exitosamente.

Si no realizaste este cambio, contacta inmediatamente a nuestro equipo de soporte.

Saludos,
El equipo de CircleSfera
    `.trim()

    return this.send({
      to: email,
      subject,
      html,
      text
    })
  }

  /**
   * Método principal para enviar emails
   */
  async send({ to, subject, html, text }) {
    try {
      if (this.isDevelopment) {
        // En desarrollo, solo loguear
        logger.info('📧 Email (DEV MODE):', {
          to,
          subject,
          preview: text.substring(0, 100) + '...'
        })
        logger.debug('Email completo:', { to, subject, html, text })
        return { success: true, messageId: 'dev-mode-' + Date.now() }
      }

      // TODO: En producción, integrar servicio real de email
      // Ejemplo con SendGrid:
      /*
      const sgMail = require('@sendgrid/mail')
      sgMail.setApiKey(process.env.SENDGRID_API_KEY)

      const msg = {
        to,
        from: this.from,
        subject,
        text,
        html
      }

      const result = await sgMail.send(msg)
      return { success: true, messageId: result[0].headers['x-message-id'] }
      */

      // Ejemplo con Nodemailer:
      /*
      const nodemailer = require('nodemailer')
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      })

      const info = await transporter.sendMail({
        from: this.from,
        to,
        subject,
        text,
        html
      })

      return { success: true, messageId: info.messageId }
      */

      logger.warn('Email service not configured for production')
      return { success: false, error: 'Email service not configured' }
    } catch (error) {
      logger.error('Error sending email:', {
        error: error.message,
        to,
        subject
      })
      throw error
    }
  }

  /**
   * Template HTML para email de reset password
   */
  getPasswordResetTemplate(username, resetUrl) {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recupera tu contraseña</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; }
    .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>CircleSfera</h1>
      <p>Recupera tu contraseña</p>
    </div>
    <div class="content">
      <p>Hola <strong>${username}</strong>,</p>

      <p>Recibimos una solicitud para restablecer tu contraseña en CircleSfera.</p>

      <p>Para crear una nueva contraseña, haz clic en el siguiente botón:</p>

      <center>
        <a href="${resetUrl}" class="button">Restablecer Contraseña</a>
      </center>

      <p>O copia y pega este enlace en tu navegador:</p>
      <p style="word-break: break-all; color: #667eea;">${resetUrl}</p>

      <div class="warning">
        <strong>⚠️ Importante:</strong>
        <ul>
          <li>Este enlace expira en <strong>1 hora</strong></li>
          <li>Solo puedes usar este enlace una vez</li>
          <li>Si no solicitaste este cambio, ignora este correo</li>
        </ul>
      </div>

      <p>Si tienes algún problema, contacta a nuestro equipo de soporte.</p>

      <p>Saludos,<br>El equipo de CircleSfera</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} CircleSfera. Todos los derechos reservados.</p>
      <p>Este es un correo automático, por favor no respondas.</p>
    </div>
  </div>
</body>
</html>
    `.trim()
  }

  /**
   * Template HTML para email de confirmación de cambio
   */
  getPasswordChangedTemplate(username) {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contraseña cambiada</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; }
    .success { background: #d4edda; border: 1px solid #28a745; padding: 15px; border-radius: 5px; margin: 20px 0; color: #155724; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>CircleSfera</h1>
      <p>Contraseña Actualizada</p>
    </div>
    <div class="content">
      <p>Hola <strong>${username}</strong>,</p>

      <div class="success">
        <strong>✅ Contraseña cambiada exitosamente</strong>
      </div>

      <p>Tu contraseña de CircleSfera ha sido cambiada correctamente.</p>

      <p><strong>Si no realizaste este cambio:</strong></p>
      <ul>
        <li>Contacta inmediatamente a nuestro equipo de soporte</li>
        <li>Cambia tu contraseña lo antes posible</li>
        <li>Revisa la actividad reciente de tu cuenta</li>
      </ul>

      <p>Saludos,<br>El equipo de CircleSfera</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} CircleSfera. Todos los derechos reservados.</p>
      <p>Este es un correo automático, por favor no respondas.</p>
    </div>
  </div>
</body>
</html>
    `.trim()
  }
}

// Exportar instancia singleton
export default new EmailService()


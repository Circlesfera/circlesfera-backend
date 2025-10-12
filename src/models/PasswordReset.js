import mongoose from 'mongoose'
import crypto from 'crypto'

const PasswordResetSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El usuario es requerido']
  },

  token: {
    type: String,
    required: [true, 'El token es requerido'],
    unique: true,
    index: true
  },

  // Hash del token para mayor seguridad
  tokenHash: {
    type: String,
    required: true
  },

  expiresAt: {
    type: Date,
    required: [true, 'La fecha de expiración es requerida'],
    index: true
  },

  used: {
    type: Boolean,
    default: false
  },

  usedAt: {
    type: Date
  },

  ipAddress: {
    type: String
  },

  userAgent: {
    type: String
  }
}, {
  timestamps: true
})

// Índices para optimizar búsquedas
PasswordResetSchema.index({ user: 1, createdAt: -1 })
PasswordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }) // TTL index

// Método estático para generar token
PasswordResetSchema.statics.generateToken = function () {
  // Generar token de 32 bytes (64 caracteres hex)
  const token = crypto.randomBytes(32).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

  return { token, tokenHash }
}

// Método estático para crear reset token
PasswordResetSchema.statics.createResetToken = async function (userId, ipAddress, userAgent) {
  // Invalidar tokens anteriores del usuario
  await this.updateMany(
    { user: userId, used: false },
    { used: true, usedAt: new Date() }
  )

  // Generar nuevo token
  const { token, tokenHash } = this.generateToken()

  // Crear registro (expira en 1 hora)
  const resetToken = await this.create({
    user: userId,
    token,
    tokenHash,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hora
    ipAddress,
    userAgent
  })

  return { token, resetToken }
}

// Método estático para verificar token
PasswordResetSchema.statics.verifyToken = async function (token) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

  const resetToken = await this.findOne({
    tokenHash,
    used: false,
    expiresAt: { $gt: new Date() }
  }).populate('user')

  return resetToken
}

// Método de instancia para marcar como usado
PasswordResetSchema.methods.markAsUsed = function () {
  this.used = true
  this.usedAt = new Date()
  return this.save()
}

export default mongoose.model('PasswordReset', PasswordResetSchema)


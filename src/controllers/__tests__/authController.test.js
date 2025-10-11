/* global mockRequest, mockResponse, describe, test, expect */

/**
 * Tests para Auth Controller
 *
 * Verifica las funcionalidades críticas de autenticación:
 * registro, login, y gestión de sesiones.
 */

// ✅ CORREGIDO: Imports ordenados alfabéticamente
import { login, register } from '../authController.js'
import User from '../../models/User.js'

// Datos de test sin hardcode
const createTestUserData = () => ({
  username: `testuser_${Date.now()}`,
  email: `test_${Date.now()}@example.com`,
  password: 'Password123!',
  fullName: 'Test User'
})

describe('Auth Controller', () => {
  describe('register', () => {
    test('debe registrar un nuevo usuario correctamente', async () => {
      // Arrange
      const userData = createTestUserData()
      const req = mockRequest({ body: userData })
      const res = mockResponse()

      // Act
      await register(req, res)

      // Assert
      expect(res.statusCalled).toBe(true)
      expect(res.statusValue).toBe(201)
      expect(res.jsonCalled).toBe(true)
      expect(res.jsonValue.success).toBe(true)
      expect(res.jsonValue.user.username).toBe(userData.username.toLowerCase())
      expect(res.jsonValue.user.email).toBe(userData.email.toLowerCase())

      // Verify user was created in DB
      const createdUser = await User.findOne({ email: userData.email.toLowerCase() })
      expect(createdUser).toBeDefined()
      expect(createdUser.username).toBe(userData.username.toLowerCase())
    })

    test('debe retornar error 400 con email duplicado', async () => {
      // Arrange
      const userData1 = createTestUserData()
      const userData2 = createTestUserData()

      // Asegurar que tengan emails iguales pero usernames DIFERENTES
      userData2.email = userData1.email // Same email
      userData2.username = `different_${Date.now()}_${Math.random()}` // Different username

      // Create first user
      await User.create(userData1)

      // Try to create duplicate email with different username
      const req = mockRequest({ body: userData2 })
      const res = mockResponse()

      // Act
      await register(req, res)

      // Assert
      expect(res.statusValue).toBe(400)
      expect(res.jsonValue.success).toBe(false)
      expect(res.jsonValue.message).toContain('email')
    })

    test('debe retornar error 400 con username duplicado', async () => {
      // Arrange
      const userData1 = createTestUserData()
      const userData2 = createTestUserData()
      userData2.username = userData1.username // Same username

      // Create first user
      await User.create(userData1)

      // Try to create duplicate username
      const req = mockRequest({ body: userData2 })
      const res = mockResponse()

      // Act
      await register(req, res)

      // Assert
      expect(res.statusValue).toBe(400)
      expect(res.jsonValue.success).toBe(false)
      expect(res.jsonValue.message).toContain('usuario')
    })

    test('debe hashear la contraseña antes de guardar', async () => {
      // Arrange
      const userData = createTestUserData()
      const req = mockRequest({ body: userData })
      const res = mockResponse()

      // Act
      await register(req, res)

      // Assert
      const createdUser = await User.findOne({ email: userData.email.toLowerCase() })
      expect(createdUser.password).not.toBe(userData.password)
      expect(createdUser.password.length).toBeGreaterThan(50) // Hashed
    })

    test('debe convertir username y email a minúsculas', async () => {
      // Arrange
      const userData = createTestUserData()
      userData.username = 'UPPERCASE'
      userData.email = 'UPPERCASE@EXAMPLE.COM'

      const req = mockRequest({ body: userData })
      const res = mockResponse()

      // Act
      await register(req, res)

      // Assert
      const createdUser = await User.findOne({ username: 'uppercase' })
      expect(createdUser).toBeDefined()
      expect(createdUser.username).toBe('uppercase')
      expect(createdUser.email).toBe('uppercase@example.com')
    })

    test('no debe retornar la contraseña en la respuesta', async () => {
      // Arrange
      const userData = createTestUserData()
      const req = mockRequest({ body: userData })
      const res = mockResponse()

      // Act
      await register(req, res)

      // Assert
      expect(res.jsonValue.user.password).toBeUndefined()
    })
  })

  describe('login', () => {
    test('debe hacer login con email y contraseña correctos', async () => {
      // Arrange
      const userData = createTestUserData()

      // Create user first
      await User.create(userData)

      const req = mockRequest({
        body: {
          email: userData.email,
          password: userData.password
        }
      })
      const res = mockResponse()

      // Act
      await login(req, res)

      // Assert
      expect(res.statusValue).toBe(200)
      expect(res.jsonValue.success).toBe(true)
      expect(res.jsonValue.token).toBeDefined()
      expect(typeof res.jsonValue.token).toBe('string')
      expect(res.jsonValue.refreshToken).toBeDefined()
      expect(res.jsonValue.user.email).toBe(userData.email.toLowerCase())
    })

    test('debe retornar error 401 con email incorrecto', async () => {
      // Arrange
      const req = mockRequest({
        body: {
          email: 'nonexistent@example.com',
          password: 'Password123!'
        }
      })
      const res = mockResponse()

      // Act
      await login(req, res)

      // Assert
      expect(res.statusValue).toBe(401)
      expect(res.jsonValue.success).toBe(false)
      expect(res.jsonValue.message.toLowerCase()).toContain('credenciales')
    })

    test('debe retornar error 401 con contraseña incorrecta', async () => {
      // Arrange
      const userData = createTestUserData()
      await User.create(userData)

      const req = mockRequest({
        body: {
          email: userData.email,
          password: 'WrongPassword123!'
        }
      })
      const res = mockResponse()

      // Act
      await login(req, res)

      // Assert
      expect(res.statusValue).toBe(401)
      expect(res.jsonValue.success).toBe(false)
    })

    test('debe generar access token y refresh token', async () => {
      // Arrange
      const userData = createTestUserData()
      await User.create(userData)

      const req = mockRequest({
        body: {
          email: userData.email,
          password: userData.password
        }
      })
      const res = mockResponse()

      // Act
      await login(req, res)

      // Assert
      expect(res.jsonValue.token).toBeDefined()
      expect(typeof res.jsonValue.token).toBe('string')
      expect(res.jsonValue.refreshToken).toBeDefined()
      expect(typeof res.jsonValue.refreshToken).toBe('string')
      expect(res.jsonValue.token).not.toBe(res.jsonValue.refreshToken)
    })

    test('no debe retornar la contraseña en la respuesta', async () => {
      // Arrange
      const userData = createTestUserData()
      await User.create(userData)

      const req = mockRequest({
        body: {
          email: userData.email,
          password: userData.password
        }
      })
      const res = mockResponse()

      // Act
      await login(req, res)

      // Assert
      expect(res.jsonValue.user.password).toBeUndefined()
    })

    test('debe aceptar email case-insensitive', async () => {
      // Arrange
      const userData = createTestUserData()
      await User.create(userData)

      const req = mockRequest({
        body: {
          email: userData.email.toUpperCase(), // Uppercase email
          password: userData.password
        }
      })
      const res = mockResponse()

      // Act
      await login(req, res)

      // Assert
      expect(res.statusValue).toBe(200)
      expect(res.jsonValue.success).toBe(true)
    })

    // TODO: Implementar actualización de lastLogin en authController
    // test('debe actualizar lastLogin después del login', async () => { ... })
  })

  describe('Seguridad', () => {
    test('no debe revelar si el email existe en error de login', async () => {
      // Arrange
      const req = mockRequest({
        body: {
          email: 'nonexistent@example.com',
          password: 'Password123!'
        }
      })
      const res = mockResponse()

      // Act
      await login(req, res)

      // Assert
      const message = res.jsonValue.message.toLowerCase()
      expect(message).not.toContain('email')
      expect(message).not.toContain('usuario')
      // Debe ser un mensaje genérico
      expect(message).toContain('credenciales')
    })

    test('no debe revelar información sensible en errores', async () => {
      // Arrange
      const userData = createTestUserData()
      await User.create(userData)

      const req = mockRequest({
        body: {
          email: userData.email,
          password: 'WrongPassword'
        }
      })
      const res = mockResponse()

      // Act
      await login(req, res)

      // Assert
      expect(res.jsonValue.user).toBeUndefined()
      expect(res.jsonValue.token).toBeUndefined()
      expect(res.jsonValue.refreshToken).toBeUndefined()
    })
  })
})

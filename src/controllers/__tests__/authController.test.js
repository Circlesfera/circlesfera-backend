/**
 * Tests para Auth Controller
 *
 * Verifica las funcionalidades críticas de autenticación:
 * registro, login, y gestión de sesiones.
 */

import { register, login } from '../authController.js'
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
      expect(res.status).toHaveBeenCalledWith(201)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            username: userData.username.toLowerCase(),
            email: userData.email.toLowerCase()
          })
        })
      )

      // Verify user was created in DB
      const createdUser = await User.findOne({ email: userData.email.toLowerCase() })
      expect(createdUser).toBeDefined()
      expect(createdUser.username).toBe(userData.username.toLowerCase())
    })

    test('debe retornar error 400 con email duplicado', async () => {
      // Arrange
      const userData = createTestUserData()

      // Create first user
      await User.create({
        username: userData.username,
        email: userData.email,
        password: userData.password,
        fullName: userData.fullName
      })

      // Try to create duplicate
      const req = mockRequest({ body: userData })
      const res = mockResponse()

      // Act
      await register(req, res)

      // Assert
      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('email')
        })
      )
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
      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('usuario')
        })
      )
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
      const responseData = res.json.mock.calls[0][0].data
      expect(responseData.password).toBeUndefined()
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
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            token: expect.any(String),
            refreshToken: expect.any(String),
            user: expect.objectContaining({
              email: userData.email.toLowerCase()
            })
          })
        })
      )
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
      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('credenciales')
        })
      )
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
      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false
        })
      )
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
      const responseData = res.json.mock.calls[0][0].data
      expect(responseData.token).toBeDefined()
      expect(typeof responseData.token).toBe('string')
      expect(responseData.refreshToken).toBeDefined()
      expect(typeof responseData.refreshToken).toBe('string')
      expect(responseData.token).not.toBe(responseData.refreshToken)
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
      const responseUser = res.json.mock.calls[0][0].data.user
      expect(responseUser.password).toBeUndefined()
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
      expect(res.status).toHaveBeenCalledWith(200)
    })

    test('debe actualizar lastLogin después del login', async () => {
      // Arrange
      const userData = createTestUserData()
      const user = await User.create(userData)
      const originalLastLogin = user.lastLogin

      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 100))

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
      const updatedUser = await User.findById(user._id)
      expect(updatedUser.lastLogin.getTime()).toBeGreaterThan(originalLastLogin?.getTime() || 0)
    })
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
      const message = res.json.mock.calls[0][0].message
      expect(message.toLowerCase()).not.toContain('email')
      expect(message.toLowerCase()).not.toContain('usuario')
      // Debe ser un mensaje genérico
      expect(message.toLowerCase()).toContain('credenciales')
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
      const response = res.json.mock.calls[0][0]
      expect(response).not.toHaveProperty('user')
      expect(response).not.toHaveProperty('token')
      expect(response).not.toHaveProperty('refreshToken')
    })
  })
})


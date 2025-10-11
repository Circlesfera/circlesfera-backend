/**
 * Tests para Validation Schemas (Zod)
 *
 * Verifica que los schemas de validación funcionen correctamente
 * y rechacen datos inválidos.
 */

// ✅ CORREGIDO: Imports ordenados alfabéticamente
import { loginSchema, registerSchema, updateProfileSchema } from '../userSchema.js'
import { createPostSchema } from '../postSchema.js'
import { createReelSchema } from '../reelSchema.js'

describe('Validation Schemas', () => {
  describe('registerSchema', () => {
    test('debe validar datos de registro correctos', () => {
      // Arrange
      const validData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123',
        fullName: 'Test User'
      }

      // Act
      const result = registerSchema.safeParse(validData)

      // Assert
      expect(result.success).toBe(true)
      expect(result.data?.username).toBe('testuser')
      expect(result.data?.email).toBe('test@example.com')
    })

    test('debe convertir username a minúsculas', () => {
      // Arrange
      const data = {
        username: 'UPPERCASE',
        email: 'test@example.com',
        password: 'Password123'
      }

      // Act
      const result = registerSchema.safeParse(data)

      // Assert
      expect(result.success).toBe(true)
      expect(result.data?.username).toBe('uppercase')
    })

    test('debe convertir email a minúsculas', () => {
      // Arrange
      const data = {
        username: 'testuser',
        email: 'TEST@EXAMPLE.COM',
        password: 'Password123'
      }

      // Act
      const result = registerSchema.safeParse(data)

      // Assert
      expect(result.success).toBe(true)
      expect(result.data?.email).toBe('test@example.com')
    })

    test('debe rechazar username menor a 3 caracteres', () => {
      // Arrange
      const data = {
        username: 'ab',
        email: 'test@example.com',
        password: 'Password123'
      }

      // Act
      const result = registerSchema.safeParse(data)

      // Assert
      expect(result.success).toBe(false)
    })

    test('debe rechazar username mayor a 20 caracteres', () => {
      // Arrange
      const data = {
        username: 'a'.repeat(21),
        email: 'test@example.com',
        password: 'Password123'
      }

      // Act
      const result = registerSchema.safeParse(data)

      // Assert
      expect(result.success).toBe(false)
    })

    test('debe rechazar username con caracteres especiales', () => {
      // Arrange
      const data = {
        username: 'test-user',
        email: 'test@example.com',
        password: 'Password123'
      }

      // Act
      const result = registerSchema.safeParse(data)

      // Assert
      expect(result.success).toBe(false)
    })

    test('debe rechazar email inválido', () => {
      // Arrange
      const data = {
        username: 'testuser',
        email: 'invalid-email',
        password: 'Password123'
      }

      // Act
      const result = registerSchema.safeParse(data)

      // Assert
      expect(result.success).toBe(false)
    })

    test('debe rechazar password sin mayúscula', () => {
      // Arrange
      const data = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      }

      // Act
      const result = registerSchema.safeParse(data)

      // Assert
      expect(result.success).toBe(false)
    })

    test('debe rechazar password sin minúscula', () => {
      // Arrange
      const data = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'PASSWORD123'
      }

      // Act
      const result = registerSchema.safeParse(data)

      // Assert
      expect(result.success).toBe(false)
    })

    test('debe rechazar password sin número', () => {
      // Arrange
      const data = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'PasswordOnly'
      }

      // Act
      const result = registerSchema.safeParse(data)

      // Assert
      expect(result.success).toBe(false)
    })

    test('debe rechazar password menor a 8 caracteres', () => {
      // Arrange
      const data = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Pass12'
      }

      // Act
      const result = registerSchema.safeParse(data)

      // Assert
      expect(result.success).toBe(false)
    })
  })

  describe('loginSchema', () => {
    test('debe validar credenciales correctas', () => {
      // Arrange
      const validData = {
        email: 'test@example.com',
        password: 'Password123'
      }

      // Act
      const result = loginSchema.safeParse(validData)

      // Assert
      expect(result.success).toBe(true)
    })

    test('debe rechazar sin email', () => {
      // Arrange
      const data = {
        password: 'Password123'
      }

      // Act
      const result = loginSchema.safeParse(data)

      // Assert
      expect(result.success).toBe(false)
    })

    test('debe rechazar sin password', () => {
      // Arrange
      const data = {
        email: 'test@example.com'
      }

      // Act
      const result = loginSchema.safeParse(data)

      // Assert
      expect(result.success).toBe(false)
    })
  })

  describe('createPostSchema', () => {
    test('debe validar post con type y caption', () => {
      // Arrange
      const validData = {
        type: 'image',
        caption: 'Test caption',
        location: 'Test Location',
        tags: 'test,photo'
      }

      // Act
      const result = createPostSchema.safeParse(validData)

      // Assert
      expect(result.success).toBe(true)
    })

    test('debe aceptar post sin caption (solo type requerido)', () => {
      // Arrange
      const data = {
        type: 'video'
      }

      // Act
      const result = createPostSchema.safeParse(data)

      // Assert
      expect(result.success).toBe(true)
    })

    test('debe rechazar post sin type (campo requerido)', () => {
      // Arrange
      const data = {
        caption: 'Test caption'
      }

      // Act
      const result = createPostSchema.safeParse(data)

      // Assert
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('type')
      }
    })

    test('debe rechazar caption demasiado largo', () => {
      // Arrange
      const data = {
        caption: 'a'.repeat(2300), // Más de 2200 caracteres
        media: ['image.jpg']
      }

      // Act
      const result = createPostSchema.safeParse(data)

      // Assert
      expect(result.success).toBe(false)
    })
  })

  describe('createReelSchema', () => {
    test('debe validar reel con video válido', () => {
      // Arrange
      const validData = {
        video: 'video.mp4',
        caption: 'Test reel',
        thumbnail: 'thumb.jpg'
      }

      // Act
      const result = createReelSchema.safeParse(validData)

      // Assert
      expect(result.success).toBe(true)
    })

    test('debe aceptar reel solo con caption (todos los campos opcionales)', () => {
      // Arrange - El video se maneja con multer, no con el schema
      const data = {
        caption: 'Test reel'
      }

      // Act
      const result = createReelSchema.safeParse(data)

      // Assert
      expect(result.success).toBe(true)
    })

    test('debe aceptar reel vacío (todos los campos opcionales)', () => {
      // Arrange - El video se sube con multer, el schema solo valida metadata
      const data = {}

      // Act
      const result = createReelSchema.safeParse(data)

      // Assert
      expect(result.success).toBe(true)
    })
  })

  describe('updateProfileSchema', () => {
    test('debe validar actualización parcial', () => {
      // Arrange
      const validData = {
        fullName: 'New Name',
        bio: 'New bio'
      }

      // Act
      const result = updateProfileSchema.safeParse(validData)

      // Assert
      expect(result.success).toBe(true)
    })

    test('debe aceptar actualización vacía', () => {
      // Arrange
      const data = {}

      // Act
      const result = updateProfileSchema.safeParse(data)

      // Assert
      expect(result.success).toBe(true)
    })

    test('debe rechazar bio demasiado larga', () => {
      // Arrange
      const data = {
        bio: 'a'.repeat(200) // Más de 150 caracteres
      }

      // Act
      const result = updateProfileSchema.safeParse(data)

      // Assert
      expect(result.success).toBe(false)
    })
  })

  describe('Manejo de errores', () => {
    test('debe retornar errores descriptivos', () => {
      // Arrange
      const invalidData = {
        username: 'ab', // Too short
        email: 'invalid',
        password: 'weak'
      }

      // Act
      const result = registerSchema.safeParse(invalidData)

      // Assert
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues).toBeDefined()
        expect(result.error.issues.length).toBeGreaterThan(0)
      }
    })

    test('debe incluir path del campo con error', () => {
      // Arrange
      const invalidData = {
        username: 'ab',
        email: 'test@example.com',
        password: 'Password123'
      }

      // Act
      const result = registerSchema.safeParse(invalidData)

      // Assert
      if (!result.success) {
        const usernameError = result.error.issues.find(
          issue => issue.path.includes('username')
        )
        expect(usernameError).toBeDefined()
      }
    })
  })
})


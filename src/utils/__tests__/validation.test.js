import { validateEmail, validateUsername, validatePassword } from '../validation.js'

describe('Validation Utils', () => {
  describe('validateEmail', () => {
    test('debe validar emails correctos', () => {
      expect(validateEmail('test@example.com')).toBe(true)
      expect(validateEmail('user.name@domain.co')).toBe(true)
      expect(validateEmail('user+tag@example.com')).toBe(true)
    })

    test('debe rechazar emails inválidos', () => {
      expect(validateEmail('invalid')).toBe(false)
      expect(validateEmail('invalid@')).toBe(false)
      expect(validateEmail('@example.com')).toBe(false)
      expect(validateEmail('invalid@.com')).toBe(false)
      expect(validateEmail('')).toBe(false)
    })
  })

  describe('validateUsername', () => {
    test('debe validar usernames correctos', () => {
      expect(validateUsername('user123')).toBe(true)
      expect(validateUsername('user_name')).toBe(true)
      expect(validateUsername('username')).toBe(true)
    })

    test('debe rechazar usernames inválidos', () => {
      expect(validateUsername('ab')).toBe(false) // muy corto
      expect(validateUsername('a'.repeat(21))).toBe(false) // muy largo
      expect(validateUsername('user name')).toBe(false) // con espacio
      expect(validateUsername('user-name')).toBe(false) // con guión
      expect(validateUsername('')).toBe(false)
    })
  })

  describe('validatePassword', () => {
    test('debe validar contraseñas correctas', () => {
      expect(validatePassword('Password123')).toBe(true)
      expect(validatePassword('MyP@ssw0rd')).toBe(true)
      expect(validatePassword('Abcd1234')).toBe(true)
    })

    test('debe rechazar contraseñas inválidas', () => {
      expect(validatePassword('short')).toBe(false) // muy corta
      expect(validatePassword('password')).toBe(false) // sin mayúscula
      expect(validatePassword('PASSWORD')).toBe(false) // sin minúscula
      expect(validatePassword('Password')).toBe(false) // sin número
      expect(validatePassword('')).toBe(false)
    })
  })
})


import {
  formatDate,
  formatRelativeTime,
  isValidDate,
  getDaysDifference
} from '../dateFormatter.js'

describe('Date Formatter Utils', () => {
  describe('formatDate', () => {
    test('debe formatear fechas correctamente', () => {
      const date = new Date('2024-01-15T12:30:00')
      expect(formatDate(date)).toBeTruthy()
      expect(typeof formatDate(date)).toBe('string')
    })

    test('debe manejar fechas inválidas', () => {
      expect(formatDate(null)).toBe('Fecha inválida')
      expect(formatDate(undefined)).toBe('Fecha inválida')
      expect(formatDate('invalid')).toBe('Fecha inválida')
    })
  })

  describe('formatRelativeTime', () => {
    test('debe formatear tiempos relativos', () => {
      const now = new Date()
      const minutesAgo = new Date(now - 5 * 60 * 1000) // 5 minutos atrás

      expect(formatRelativeTime(minutesAgo)).toContain('minuto')
    })

    test('debe formatear "justo ahora"', () => {
      const now = new Date()
      expect(formatRelativeTime(now)).toBe('Justo ahora')
    })
  })

  describe('isValidDate', () => {
    test('debe validar fechas correctas', () => {
      expect(isValidDate(new Date())).toBe(true)
      expect(isValidDate(new Date('2024-01-15'))).toBe(true)
    })

    test('debe rechazar fechas inválidas', () => {
      expect(isValidDate(null)).toBe(false)
      expect(isValidDate(undefined)).toBe(false)
      expect(isValidDate('not a date')).toBe(false)
      expect(isValidDate({})).toBe(false)
    })
  })

  describe('getDaysDifference', () => {
    test('debe calcular diferencia de días', () => {
      const date1 = new Date('2024-01-15')
      const date2 = new Date('2024-01-20')

      expect(getDaysDifference(date1, date2)).toBe(5)
    })

    test('debe manejar fechas en orden inverso', () => {
      const date1 = new Date('2024-01-20')
      const date2 = new Date('2024-01-15')

      expect(getDaysDifference(date1, date2)).toBe(5)
    })
  })
})


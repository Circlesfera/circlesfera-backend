import {
  parsePaginationParams,
  parseSortParams,
  createPaginationObject
} from '../pagination.js'

describe('Pagination Utils', () => {
  describe('parsePaginationParams', () => {
    test('debe parsear parámetros válidos', () => {
      const query = { page: '2', limit: '30' }
      const result = parsePaginationParams(query)

      expect(result.page).toBe(2)
      expect(result.limit).toBe(30)
      expect(result.skip).toBe(30) // (2-1) * 30
    })

    test('debe usar valores por defecto', () => {
      const query = {}
      const result = parsePaginationParams(query)

      expect(result.page).toBe(1)
      expect(result.limit).toBe(20)
      expect(result.skip).toBe(0)
    })

    test('debe validar límites máximos', () => {
      const query = { page: '1', limit: '500' }
      const result = parsePaginationParams(query, { maxLimit: 100 })

      expect(result.limit).toBe(100)
    })

    test('debe validar valores negativos', () => {
      const query = { page: '-1', limit: '-10' }
      const result = parsePaginationParams(query)

      expect(result.page).toBeGreaterThanOrEqual(1)
      expect(result.limit).toBeGreaterThan(0)
    })
  })

  describe('parseSortParams', () => {
    test('debe parsear ordenamiento descendente', () => {
      const result = parseSortParams('-createdAt')

      expect(result).toHaveProperty('createdAt')
      expect(result.createdAt).toBe(-1)
    })

    test('debe parsear ordenamiento ascendente', () => {
      const result = parseSortParams('username')

      expect(result).toHaveProperty('username')
      expect(result.username).toBe(1)
    })

    test('debe parsear múltiples campos', () => {
      const result = parseSortParams('-createdAt,username')

      expect(result).toHaveProperty('createdAt')
      expect(result).toHaveProperty('username')
      expect(result.createdAt).toBe(-1)
      expect(result.username).toBe(1)
    })

    test('debe usar ordenamiento por defecto', () => {
      const result = parseSortParams(null, '-createdAt')

      expect(result).toHaveProperty('createdAt')
      expect(result.createdAt).toBe(-1)
    })

    test('debe filtrar campos no permitidos', () => {
      const result = parseSortParams('username,password', null, ['username'])

      expect(result).toHaveProperty('username')
      expect(result).not.toHaveProperty('password')
    })
  })

  describe('createPaginationObject', () => {
    test('debe crear objeto de paginación correcto', () => {
      const result = createPaginationObject(2, 20, 100)

      expect(result.page).toBe(2)
      expect(result.limit).toBe(20)
      expect(result.total).toBe(100)
      expect(result.pages).toBe(5)
      expect(result.hasNext).toBe(true)
      expect(result.hasPrev).toBe(true)
    })

    test('debe indicar primera página', () => {
      const result = createPaginationObject(1, 20, 100)

      expect(result.hasPrev).toBe(false)
    })

    test('debe indicar última página', () => {
      const result = createPaginationObject(5, 20, 100)

      expect(result.hasNext).toBe(false)
    })

    test('debe manejar página única', () => {
      const result = createPaginationObject(1, 20, 10)

      expect(result.pages).toBe(1)
      expect(result.hasNext).toBe(false)
      expect(result.hasPrev).toBe(false)
    })
  })
})


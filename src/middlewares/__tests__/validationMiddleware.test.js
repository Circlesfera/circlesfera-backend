/**
 * Tests para validationMiddleware.js
 *
 * Este archivo contiene tests unitarios para el middleware de validación
 * centralizado que implementamos para resolver el Hallazgo Crítico #2.
 */

import { jest } from '@jest/globals'
import { validationResult } from 'express-validator'
import {
  handleValidationErrors,
  sanitizeInput,
  validateAdminUsersQuery,
  validateAnalyticsQuery,
  validateBanUser,
  validateCreateComment,
  validateCreateMessage,
  validateCreatePost,
  validateCreateReport,
  validateCreateUser,
  validateCustomMetrics,
  validateLogin,
  validateObjectId,
  validatePagination,
  validatePeriodComparison,
  validateRateLimit,
  validateRegister,
  validateReportQuery,
  validateSearch,
  validateStatsQuery,
  validateSuspendUser,
  validateUpdateComment,
  validateUpdatePost,
  validateUpdateReportStatus,
  validateUpdateUser,
  validateUpdateUserRole
} from '../validationMiddleware.js'

// Mock de express-validator
jest.mock('express-validator', () => ({
  validationResult: jest.fn(),
  body: jest.fn(() => ({
    isString: jest.fn().mockReturnThis(),
    isEmail: jest.fn().mockReturnThis(),
    isLength: jest.fn().mockReturnThis(),
    isIn: jest.fn().mockReturnThis(),
    isMongoId: jest.fn().mockReturnThis(),
    isInt: jest.fn().mockReturnThis(),
    isArray: jest.fn().mockReturnThis(),
    isObject: jest.fn().mockReturnThis(),
    optional: jest.fn().mockReturnThis(),
    trim: jest.fn().mockReturnThis(),
    withMessage: jest.fn().mockReturnThis(),
    run: jest.fn()
  })),
  param: jest.fn(() => ({
    isMongoId: jest.fn().mockReturnThis(),
    withMessage: jest.fn().mockReturnThis(),
    run: jest.fn()
  })),
  query: jest.fn(() => ({
    isString: jest.fn().mockReturnThis(),
    isInt: jest.fn().mockReturnThis(),
    isIn: jest.fn().mockReturnThis(),
    isMongoId: jest.fn().mockReturnThis(),
    optional: jest.fn().mockReturnThis(),
    trim: jest.fn().mockReturnThis(),
    isLength: jest.fn().mockReturnThis(),
    withMessage: jest.fn().mockReturnThis(),
    run: jest.fn()
  }))
}))

// Mock de logger
jest.mock('../../utils/logger.js', () => ({
  warn: jest.fn(),
  error: jest.fn()
}))

describe('validationMiddleware', () => {
  let mockReq, mockRes, mockNext

  beforeEach(() => {
    mockReq = {
      body: {},
      params: {},
      query: {},
      headers: {},
      user: null
    }
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    }
    mockNext = jest.fn()

    // Reset mocks
    jest.clearAllMocks()
  })

  describe('handleValidationErrors', () => {
    it('debe ser una función middleware', () => {
      expect(typeof handleValidationErrors).toBe('function')
    })
  })

  describe('validateObjectId', () => {
    it('debe ser una función que retorna middleware', () => {
      expect(typeof validateObjectId).toBe('function')
      const middleware = validateObjectId('userId')
      expect(typeof middleware).toBe('function')
    })
  })

  describe('validatePagination', () => {
    it('debe ser un array de validaciones', () => {
      expect(Array.isArray(validatePagination)).toBe(true)
      expect(validatePagination).toHaveLength(2) // page y limit
    })
  })

  describe('validateSearch', () => {
    it('debe ser un array de validaciones', () => {
      expect(Array.isArray(validateSearch)).toBe(true)
      expect(validateSearch).toHaveLength(1) // search query
    })
  })

  describe('validateCreatePost', () => {
    it('debe ser un array de validaciones', () => {
      expect(Array.isArray(validateCreatePost)).toBe(true)
      expect(validateCreatePost.length).toBeGreaterThan(0)
    })
  })

  describe('validateLogin', () => {
    it('debe ser un array de validaciones', () => {
      expect(Array.isArray(validateLogin)).toBe(true)
      expect(validateLogin.length).toBeGreaterThan(0)
    })
  })

  describe('validateRegister', () => {
    it('debe ser un array de validaciones', () => {
      expect(Array.isArray(validateRegister)).toBe(true)
      expect(validateRegister.length).toBeGreaterThan(0)
    })
  })

  describe('validateCreateReport', () => {
    it('debe ser un array de validaciones', () => {
      expect(Array.isArray(validateCreateReport)).toBe(true)
      expect(validateCreateReport.length).toBeGreaterThan(0)
    })
  })

  describe('validateUpdateUserRole', () => {
    it('debe ser un array de validaciones', () => {
      expect(Array.isArray(validateUpdateUserRole)).toBe(true)
      expect(validateUpdateUserRole.length).toBeGreaterThan(0)
    })
  })

  describe('validateBanUser', () => {
    it('debe ser un array de validaciones', () => {
      expect(Array.isArray(validateBanUser)).toBe(true)
      expect(validateBanUser.length).toBeGreaterThan(0)
    })
  })

  describe('validateStatsQuery', () => {
    it('debe ser un array de validaciones', () => {
      expect(Array.isArray(validateStatsQuery)).toBe(true)
      expect(validateStatsQuery.length).toBeGreaterThan(0)
    })
  })

  describe('validateAnalyticsQuery', () => {
    it('debe ser un array de validaciones', () => {
      expect(Array.isArray(validateAnalyticsQuery)).toBe(true)
      expect(validateAnalyticsQuery.length).toBeGreaterThan(0)
    })
  })

  describe('validatePeriodComparison', () => {
    it('debe ser un array de validaciones', () => {
      expect(Array.isArray(validatePeriodComparison)).toBe(true)
      expect(validatePeriodComparison.length).toBeGreaterThan(0)
    })
  })

  describe('validateCustomMetrics', () => {
    it('debe ser un array de validaciones', () => {
      expect(Array.isArray(validateCustomMetrics)).toBe(true)
      expect(validateCustomMetrics.length).toBeGreaterThan(0)
    })
  })

  describe('sanitizeInput', () => {
    it('debe ser una función middleware', () => {
      expect(typeof sanitizeInput).toBe('function')
    })
  })

  describe('validateRateLimit', () => {
    it('debe ser una función que retorna middleware', () => {
      expect(typeof validateRateLimit).toBe('function')
      const middleware = validateRateLimit()
      expect(typeof middleware).toBe('function')
    })
  })
})

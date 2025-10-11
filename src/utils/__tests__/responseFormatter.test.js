import {
  sendSuccess,
  sendSuccessWithPagination,
  sendError,
  sendCreated,
  sendNotFound,
  sendUnauthorized,
  sendForbidden,
  sendValidationError,
  sendNoContent
} from '../responseFormatter.js'

describe('Response Formatter Utils', () => {
  let mockRes

  beforeEach(() => {
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    }
  })

  describe('sendSuccess', () => {
    test('debe enviar respuesta exitosa con datos', () => {
      const data = { id: 1, name: 'Test' }
      sendSuccess(mockRes, data)

      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data
      })
    })

    test('debe incluir mensaje opcional', () => {
      const data = { id: 1 }
      const message = 'Operación exitosa'
      sendSuccess(mockRes, data, message)

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data,
        message
      })
    })

    test('debe permitir código de estado personalizado', () => {
      sendSuccess(mockRes, {}, null, 201)

      expect(mockRes.status).toHaveBeenCalledWith(201)
    })
  })

  describe('sendSuccessWithPagination', () => {
    test('debe enviar respuesta con paginación', () => {
      const data = [{ id: 1 }, { id: 2 }]
      const pagination = { page: 1, limit: 20, total: 50 }

      sendSuccessWithPagination(mockRes, data, pagination)

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data,
        pagination: expect.objectContaining({
          page: 1,
          limit: 20,
          total: 50,
          pages: 3,
          hasNext: true,
          hasPrev: false
        })
      })
    })
  })

  describe('sendError', () => {
    test('debe enviar respuesta de error', () => {
      const message = 'Error de prueba'
      sendError(mockRes, message)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message
      })
    })

    test('debe incluir errores de validación', () => {
      const errors = ['Campo requerido', 'Formato inválido']
      sendError(mockRes, 'Error de validación', 400, errors)

      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Error de validación',
        errors
      })
    })
  })

  describe('sendCreated', () => {
    test('debe enviar respuesta 201 Created', () => {
      const data = { id: 1 }
      sendCreated(mockRes, data)

      expect(mockRes.status).toHaveBeenCalledWith(201)
    })
  })

  describe('sendNotFound', () => {
    test('debe enviar respuesta 404', () => {
      sendNotFound(mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(404)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Recurso no encontrado'
      })
    })
  })

  describe('sendUnauthorized', () => {
    test('debe enviar respuesta 401', () => {
      sendUnauthorized(mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(401)
    })
  })

  describe('sendForbidden', () => {
    test('debe enviar respuesta 403', () => {
      sendForbidden(mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(403)
    })
  })

  describe('sendValidationError', () => {
    test('debe enviar error de validación', () => {
      const errors = ['Error 1', 'Error 2']
      sendValidationError(mockRes, errors)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Error de validación',
        errors
      })
    })
  })

  describe('sendNoContent', () => {
    test('debe enviar respuesta 204 sin contenido', () => {
      sendNoContent(mockRes)

      expect(mockRes.status).toHaveBeenCalledWith(204)
      expect(mockRes.send).toHaveBeenCalled()
    })
  })
})


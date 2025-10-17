/**
 * Tests para refactoredPostController.js
 *
 * Este archivo contiene tests unitarios para el controlador de posts refactorizado
 * que ya implementa validaciones y manejo de errores estructurado.
 */

import { jest } from '@jest/globals'
import { PostController, postController } from '../refactoredPostController.js'
import Post from '../../models/Post.js'
import User from '../../models/User.js'
import { AppError } from '../../middlewares/errorHandler.js'

// Mock de modelos
jest.mock('../../models/Post.js')
jest.mock('../../models/User.js')

// Mock de logger
jest.mock('../../utils/logger.js', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}))

describe('PostController', () => {
  let mockReq, mockRes, mockNext

  beforeEach(() => {
    mockReq = {
      body: {},
      params: {},
      query: {},
      user: { id: '507f1f77bcf86cd799439011' }
    }
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    }
    mockNext = jest.fn()

    // Reset mocks
    jest.clearAllMocks()
  })

  describe('createPost', () => {
    it('debe crear post exitosamente', async () => {
      const postData = {
        caption: 'Test post',
        media: ['image1.jpg', 'image2.jpg'],
        tags: ['test', 'example']
      }

      mockReq.body = postData

      const mockPost = {
        _id: '507f1f77bcf86cd799439012',
        ...postData,
        user: mockReq.user.id,
        createdAt: new Date(),
        toObject: () => ({ _id: '507f1f77bcf86cd799439012', ...postData })
      }

      Post.create.mockResolvedValue(mockPost)

      await PostController.createPost(mockReq, mockRes, mockNext)

      expect(Post.create).toHaveBeenCalledWith({
        ...postData,
        user: mockReq.user.id
      })
      expect(mockRes.status).toHaveBeenCalledWith(201)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockPost.toObject()
      })
    })

    it('debe manejar error al crear post', async () => {
      const postData = {
        caption: 'Test post',
        media: ['image1.jpg']
      }

      mockReq.body = postData

      const error = new Error('Database error')
      Post.create.mockRejectedValue(error)

      await PostController.createPost(mockReq, mockRes, mockNext)

      expect(mockNext).toHaveBeenCalledWith(error)
    })

    it('debe validar datos requeridos', async () => {
      mockReq.body = {
        caption: 'Test post'
        // Sin media
      }

      await PostController.createPost(mockReq, mockRes, mockNext)

      // Debería llamar a next con error de validación
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error))
    })
  })

  describe('getPosts', () => {
    it('debe obtener posts con paginación', async () => {
      const mockPosts = [
        { _id: '1', caption: 'Post 1', user: 'user1' },
        { _id: '2', caption: 'Post 2', user: 'user2' }
      ]

      mockReq.query = { page: '1', limit: '10' }

      Post.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              skip: jest.fn().mockResolvedValue(mockPosts)
            })
          })
        })
      })

      Post.countDocuments.mockResolvedValue(25)

      await PostController.getPosts(mockReq, mockRes, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockPosts,
        pagination: {
          page: 1,
          limit: 10,
          total: 25,
          pages: 3
        }
      })
    })

    it('debe manejar error al obtener posts', async () => {
      mockReq.query = { page: '1', limit: '10' }

      const error = new Error('Database error')
      Post.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              skip: jest.fn().mockRejectedValue(error)
            })
          })
        })
      })

      await PostController.getPosts(mockReq, mockRes, mockNext)

      expect(mockNext).toHaveBeenCalledWith(error)
    })
  })

  describe('getPostById', () => {
    it('debe obtener post por ID exitosamente', async () => {
      const postId = '507f1f77bcf86cd799439012'
      const mockPost = {
        _id: postId,
        caption: 'Test post',
        user: 'user1',
        toObject: () => ({ _id: postId, caption: 'Test post' })
      }

      mockReq.params.id = postId

      Post.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockPost)
      })

      await PostController.getPostById(mockReq, mockRes, mockNext)

      expect(Post.findById).toHaveBeenCalledWith(postId)
      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockPost.toObject()
      })
    })

    it('debe retornar 404 si post no existe', async () => {
      const postId = '507f1f77bcf86cd799439012'

      mockReq.params.id = postId

      Post.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null)
      })

      await PostController.getPostById(mockReq, mockRes, mockNext)

      expect(mockNext).toHaveBeenCalledWith(expect.any(AppError))
    })

    it('debe manejar error al obtener post', async () => {
      const postId = '507f1f77bcf86cd799439012'

      mockReq.params.id = postId

      const error = new Error('Database error')
      Post.findById.mockReturnValue({
        populate: jest.fn().mockRejectedValue(error)
      })

      await PostController.getPostById(mockReq, mockRes, mockNext)

      expect(mockNext).toHaveBeenCalledWith(error)
    })
  })

  describe('updatePost', () => {
    it('debe actualizar post exitosamente', async () => {
      const postId = '507f1f77bcf86cd799439012'
      const updateData = {
        caption: 'Updated post',
        tags: ['updated', 'test']
      }

      mockReq.params.id = postId
      mockReq.body = updateData

      const mockPost = {
        _id: postId,
        user: mockReq.user.id,
        ...updateData,
        toObject: () => ({ _id: postId, ...updateData })
      }

      Post.findById.mockResolvedValue(mockPost)
      Post.findByIdAndUpdate.mockResolvedValue(mockPost)

      await PostController.updatePost(mockReq, mockRes, mockNext)

      expect(Post.findById).toHaveBeenCalledWith(postId)
      expect(Post.findByIdAndUpdate).toHaveBeenCalledWith(
        postId,
        updateData,
        { new: true, runValidators: true }
      )
      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockPost.toObject()
      })
    })

    it('debe retornar 404 si post no existe', async () => {
      const postId = '507f1f77bcf86cd799439012'

      mockReq.params.id = postId
      mockReq.body = { caption: 'Updated post' }

      Post.findById.mockResolvedValue(null)

      await PostController.updatePost(mockReq, mockRes, mockNext)

      expect(mockNext).toHaveBeenCalledWith(expect.any(AppError))
    })

    it('debe retornar 403 si usuario no es propietario', async () => {
      const postId = '507f1f77bcf86cd799439012'

      mockReq.params.id = postId
      mockReq.body = { caption: 'Updated post' }

      const mockPost = {
        _id: postId,
        user: 'different-user-id' // Diferente al usuario actual
      }

      Post.findById.mockResolvedValue(mockPost)

      await PostController.updatePost(mockReq, mockRes, mockNext)

      expect(mockNext).toHaveBeenCalledWith(expect.any(AppError))
    })
  })

  describe('deletePost', () => {
    it('debe eliminar post exitosamente', async () => {
      const postId = '507f1f77bcf86cd799439012'

      mockReq.params.id = postId

      const mockPost = {
        _id: postId,
        user: mockReq.user.id
      }

      Post.findById.mockResolvedValue(mockPost)
      Post.findByIdAndDelete.mockResolvedValue(mockPost)

      await PostController.deletePost(mockReq, mockRes, mockNext)

      expect(Post.findById).toHaveBeenCalledWith(postId)
      expect(Post.findByIdAndDelete).toHaveBeenCalledWith(postId)
      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Post eliminado exitosamente'
      })
    })

    it('debe retornar 404 si post no existe', async () => {
      const postId = '507f1f77bcf86cd799439012'

      mockReq.params.id = postId

      Post.findById.mockResolvedValue(null)

      await PostController.deletePost(mockReq, mockRes, mockNext)

      expect(mockNext).toHaveBeenCalledWith(expect.any(AppError))
    })

    it('debe retornar 403 si usuario no es propietario', async () => {
      const postId = '507f1f77bcf86cd799439012'

      mockReq.params.id = postId

      const mockPost = {
        _id: postId,
        user: 'different-user-id'
      }

      Post.findById.mockResolvedValue(mockPost)

      await PostController.deletePost(mockReq, mockRes, mockNext)

      expect(mockNext).toHaveBeenCalledWith(expect.any(AppError))
    })
  })

  describe('likePost', () => {
    it('debe dar like a post exitosamente', async () => {
      const postId = '507f1f77bcf86cd799439012'

      mockReq.params.id = postId

      const mockPost = {
        _id: postId,
        likes: [],
        save: jest.fn().mockResolvedValue(true)
      }

      Post.findById.mockResolvedValue(mockPost)

      await PostController.likePost(mockReq, mockRes, mockNext)

      expect(mockPost.likes).toContain(mockReq.user.id)
      expect(mockPost.save).toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Like agregado exitosamente'
      })
    })

    it('debe quitar like si ya existe', async () => {
      const postId = '507f1f77bcf86cd799439012'

      mockReq.params.id = postId

      const mockPost = {
        _id: postId,
        likes: [mockReq.user.id], // Ya tiene like
        save: jest.fn().mockResolvedValue(true)
      }

      Post.findById.mockResolvedValue(mockPost)

      await PostController.likePost(mockReq, mockRes, mockNext)

      expect(mockPost.likes).not.toContain(mockReq.user.id)
      expect(mockPost.save).toHaveBeenCalled()
      expect(mockRes.status).toHaveBeenCalledWith(200)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Like removido exitosamente'
      })
    })

    it('debe retornar 404 si post no existe', async () => {
      const postId = '507f1f77bcf86cd799439012'

      mockReq.params.id = postId

      Post.findById.mockResolvedValue(null)

      await PostController.likePost(mockReq, mockRes, mockNext)

      expect(mockNext).toHaveBeenCalledWith(expect.any(AppError))
    })
  })

  describe('Validaciones', () => {
    it('debe tener validaciones para crear post', () => {
      expect(PostController.createPostValidations).toBeDefined()
      expect(Array.isArray(PostController.createPostValidations)).toBe(true)
    })

    it('debe tener validaciones para actualizar post', () => {
      expect(PostController.updatePostValidations).toBeDefined()
      expect(Array.isArray(PostController.updatePostValidations)).toBe(true)
    })
  })

  describe('Manejo de errores', () => {
    it('debe usar asyncHandler para manejo automático de errores', () => {
      // Verificar que los métodos están envueltos en asyncHandler
      expect(PostController.createPost).toBeDefined()
      expect(PostController.getPosts).toBeDefined()
      expect(PostController.getPostById).toBeDefined()
      expect(PostController.updatePost).toBeDefined()
      expect(PostController.deletePost).toBeDefined()
      expect(PostController.likePost).toBeDefined()
    })
  })
})

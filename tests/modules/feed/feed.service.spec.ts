import { describe, it, expect, beforeEach } from '@jest/globals';

import { FeedService } from '@modules/feed/services/feed.service.js';
import { ApplicationError } from '@core/errors/application-error.js';
import type { PostRepository } from '@modules/feed/repositories/post.repository.js';
import type { UserRepository } from '@modules/users/repositories/user.repository.js';

// Mocks básicos
const mockPostRepository = {
  create: jest.fn(),
  findById: jest.fn(),
  findByAuthorId: jest.fn()
} as unknown as PostRepository;

const mockUserRepository = {
  findById: jest.fn(),
  findManyByIds: jest.fn()
} as unknown as UserRepository;

describe('FeedService', () => {
  let feedService: FeedService;

  beforeEach(() => {
    jest.clearAllMocks();
    // @ts-expect-error - Acceso privado para testing
    feedService = new FeedService();
    // @ts-expect-error - Mock de repositorios
    feedService['postRepository'] = mockPostRepository;
    // @ts-expect-error - Mock de repositorios
    feedService['users'] = mockUserRepository;
  });

  describe('createPost', () => {
    it('debe crear un post con datos válidos', async () => {
      const userId = 'user123';
      const payload = {
        caption: 'Test post',
        media: [
          {
            id: 'media1',
            kind: 'image' as const,
            url: 'https://example.com/image.jpg',
            thumbnailUrl: 'https://example.com/thumb.jpg',
            width: 1080,
            height: 1080
          }
        ]
      };

      const mockPost = {
        id: 'post123',
        authorId: userId,
        caption: payload.caption,
        media: payload.media,
        createdAt: new Date(),
        updatedAt: new Date(),
        likes: 0,
        comments: 0,
        saves: 0,
        views: 0
      };

      mockPostRepository.create = jest.fn().mockResolvedValue(mockPost);
      mockUserRepository.findById = jest.fn().mockResolvedValue({
        id: userId,
        handle: 'testuser',
        displayName: 'Test User',
        avatarUrl: ''
      });

      const result = await feedService.createPost(userId, payload);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockPost.id);
      expect(result.caption).toBe(payload.caption);
      expect(mockPostRepository.create).toHaveBeenCalled();
    });

    it('debe lanzar error si el usuario no existe', async () => {
      const userId = 'nonexistent';
      const payload = {
        caption: 'Test post',
        media: []
      };

      mockUserRepository.findById = jest.fn().mockResolvedValue(null);

      await expect(feedService.createPost(userId, payload)).rejects.toThrow(ApplicationError);
    });
  });

  describe('getPostById', () => {
    it('debe retornar null si el post no existe', async () => {
      const postId = 'nonexistent';
      const userId = 'user123';

      mockPostRepository.findById = jest.fn().mockResolvedValue(null);

      const result = await feedService.getPostById(postId, userId);

      expect(result).toBeNull();
    });

    it('debe retornar el post si existe', async () => {
      const postId = 'post123';
      const userId = 'user123';

      const mockPost = {
        id: postId,
        authorId: userId,
        caption: 'Test post',
        media: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        likes: 0,
        comments: 0,
        saves: 0,
        views: 0
      };

      mockPostRepository.findById = jest.fn().mockResolvedValue(mockPost);
      mockUserRepository.findById = jest.fn().mockResolvedValue({
        id: userId,
        handle: 'testuser',
        displayName: 'Test User',
        avatarUrl: ''
      });

      const result = await feedService.getPostById(postId, userId);

      expect(result).toBeDefined();
      expect(result?.id).toBe(postId);
    });
  });
});


import { describe, it, expect, beforeEach, jest } from '@jest/globals';

import { FeedService } from '@modules/feed/services/feed.service.js';
import { ApplicationError } from '@core/errors/application-error.js';
import type { PostRepository, PostEntity } from '@modules/feed/repositories/post.repository.js';
import type { UserRepository } from '@modules/users/repositories/user.repository.js';
import type { UserDomain } from '@modules/users/models/user.model.js';

// Mocks básicos
const mockPostRepository: jest.Mocked<PostRepository> = {
  create: jest.fn(),
  findFeed: jest.fn(),
  findByAuthorId: jest.fn(),
  countByAuthorId: jest.fn(),
  incrementLikes: jest.fn(),
  decrementLikes: jest.fn(),
  incrementComments: jest.fn(),
  findById: jest.fn(),
  findManyByIds: jest.fn(),
  findExplore: jest.fn(),
  findByHashtag: jest.fn(),
  findByHashtags: jest.fn(),
  searchPosts: jest.fn(),
  findFrames: jest.fn(),
  updateCaption: jest.fn(),
  deleteById: jest.fn(),
  archiveById: jest.fn(),
  unarchiveById: jest.fn(),
  findArchivedByAuthorId: jest.fn()
} as jest.Mocked<PostRepository>;

const mockUserRepository: jest.Mocked<UserRepository> = {
  create: jest.fn(),
  findByEmail: jest.fn(),
  findByHandle: jest.fn(),
  findById: jest.fn(),
  findManyByIds: jest.fn(),
  findManyByHandles: jest.fn(),
  searchUsers: jest.fn(),
  updateById: jest.fn(),
  update: jest.fn(),
  updatePassword: jest.fn(),
  deleteById: jest.fn()
} as jest.Mocked<UserRepository>;

describe('FeedService', () => {
  let feedService: FeedService;

  beforeEach(() => {
    jest.clearAllMocks();
    const stubFollows: any = { findFollowingIds: jest.fn(async () => []) };
    const stubBlocks: any = {
      findBlockedIds: jest.fn(async () => []),
      findBlockerIds: jest.fn(async () => []),
      findMutualBlocks: jest.fn(async () => ({ user1BlocksUser2: false, user2BlocksUser1: false }))
    };
    const stubLikes: any = {
      exists: jest.fn(async () => false),
      findLikedPostIds: jest.fn(async () => [])
    };
    const stubSaves: any = {
      exists: jest.fn(async () => false),
      findSavedPostIds: jest.fn(async () => [])
    };
    const stubHashtags: any = {};
    const stubMentions: any = {};
    const stubFollowHashtags: any = { findFollowedTags: jest.fn(async () => []) };
    const stubTags: any = { findByPostId: jest.fn(async () => []) };

    feedService = new FeedService(
      mockPostRepository,
      mockUserRepository,
      stubFollows,
      stubBlocks,
      stubLikes,
      stubSaves,
      stubHashtags,
      stubMentions,
      stubFollowHashtags,
      stubTags
    );
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

      const mockPost: PostEntity = {
        id: 'post123',
        authorId: userId,
        caption: payload.caption,
        media: payload.media,
        hashtags: [],
        isArchived: false,
        stats: {
        likes: 0,
        comments: 0,
        saves: 0,
          shares: 0,
        views: 0
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockUser: UserDomain = {
        id: userId,
        email: 'test@example.com',
        handle: 'testuser',
        displayName: 'Test User',
        passwordHash: 'hash',
        bio: null,
        avatarUrl: '',
        isVerified: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPostRepository.create.mockResolvedValue(mockPost);
      mockUserRepository.findById.mockResolvedValue(mockUser);

      const result = await feedService.createPost(userId, payload);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockPost.id);
      expect(result.caption).toBe(payload.caption);
      expect(mockPostRepository.create).toHaveBeenCalled();
    });

    it('debe devolver post con usuario desconocido si el usuario no existe', async () => {
      const userId = 'nonexistent';
      const payload = {
        caption: 'Test post',
        media: []
      };

      const mockPost: PostEntity = {
        id: 'post123',
        authorId: userId,
        caption: payload.caption,
        media: payload.media,
        hashtags: [],
        isArchived: false,
        stats: {
          likes: 0,
          comments: 0,
          saves: 0,
          shares: 0,
          views: 0
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPostRepository.create.mockResolvedValue(mockPost);
      mockUserRepository.findById.mockResolvedValue(null);

      const result = await feedService.createPost(userId, payload);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockPost.id);
      expect(result.author.handle).toBe('usuario');
      expect(result.author.displayName).toBe('Usuario desconocido');
    });
  });

  describe('getPostById', () => {
    it('debe retornar null si el post no existe', async () => {
      const postId = 'nonexistent';
      const userId = 'user123';

      mockPostRepository.findById.mockResolvedValue(null);

      const result = await feedService.getPostById(postId, userId);

      expect(result).toBeNull();
    });

    it('debe retornar el post si existe', async () => {
      const postId = 'post123';
      const userId = 'user123';

      const mockPost: PostEntity = {
        id: postId,
        authorId: userId,
        caption: 'Test post',
        media: [],
        hashtags: [],
        isArchived: false,
        stats: {
        likes: 0,
        comments: 0,
        saves: 0,
          shares: 0,
        views: 0
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockUser: UserDomain = {
        id: userId,
        email: 'test@example.com',
        handle: 'testuser',
        displayName: 'Test User',
        passwordHash: 'hash',
        bio: null,
        avatarUrl: '',
        isVerified: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPostRepository.findById.mockResolvedValue(mockPost);
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.findManyByIds.mockResolvedValue([mockUser]);

      const result = await feedService.getPostById(postId, userId);

      expect(result).toBeDefined();
      expect(result?.id).toBe(postId);
    });
  });
});


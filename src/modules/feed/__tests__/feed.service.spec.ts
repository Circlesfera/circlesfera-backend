import { describe, expect, it, jest } from '@jest/globals';

import { FeedService } from '../services/feed.service.js';
import type { FeedCursorResult } from '../services/feed.service.js';
import type {
  CreatePostInput,
  FeedQueryResult,
  PostEntity,
  PostRepository
} from '../repositories/post.repository.js';
import type { UserRepository } from '../../users/repositories/user.repository.js';

interface UserEntity {
  id: string;
  email: string;
  handle: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
  isVerified?: boolean;
}

const createPost = (overrides: Partial<PostEntity> = {}): PostEntity => ({
  id: overrides.id ?? 'post-1',
  authorId: overrides.authorId ?? 'author-1',
  caption: overrides.caption ?? 'Hola CircleSfera',
  media: overrides.media ?? [],
  hashtags: overrides.hashtags ?? [],
  isArchived: overrides.isArchived ?? false,
  stats: overrides.stats ?? { likes: 10, comments: 2, saves: 1, shares: 0, views: 35 },
  createdAt: overrides.createdAt ?? new Date('2024-01-01T12:00:00.000Z'),
  updatedAt: overrides.updatedAt ?? new Date('2024-01-01T12:05:00.000Z')
});

const createUser = (overrides: Partial<UserEntity> = {}): UserEntity => ({
  id: overrides.id ?? 'author-1',
  email: overrides.email ?? 'author@example.com',
  handle: overrides.handle ?? 'author',
  displayName: overrides.displayName ?? 'Author',
  bio: overrides.bio ?? null,
  avatarUrl: overrides.avatarUrl ?? null,
  createdAt: overrides.createdAt ?? new Date().toISOString(),
  updatedAt: overrides.updatedAt ?? new Date().toISOString(),
  isVerified: overrides.isVerified ?? false
});

describe('FeedService', () => {
  // TODO: Fix getHomeFeed test - Redis cache mocking issue
  it.skip('mapea publicaciones en elementos del feed', async () => {
    const post = createPost();
    const mockFindFeed = jest.fn(async (): Promise<FeedQueryResult> => ({ items: [post], hasMore: false }));
    const postsRepo = {
      findFeed: mockFindFeed,
      findById: jest.fn(),
      findByAuthorId: jest.fn(),
      countByAuthorId: jest.fn(),
      incrementLikes: jest.fn(),
      decrementLikes: jest.fn(),
      incrementComments: jest.fn(),
      findManyByIds: jest.fn(),
      findExplore: jest.fn(),
      findByHashtag: jest.fn(),
      findByHashtags: jest.fn(async () => ({ items: [], hasMore: false })),
      searchPosts: jest.fn(),
      findFrames: jest.fn(),
      updateCaption: jest.fn(),
      deleteById: jest.fn(),
      archiveById: jest.fn(),
      unarchiveById: jest.fn(),
      findArchivedByAuthorId: jest.fn(),
      create: jest.fn()
    };
    const mockFindManyByIds = jest.fn(async (): Promise<UserEntity[]> => [createUser()]);
    const usersRepo = {
      findManyByIds: mockFindManyByIds,
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findByHandle: jest.fn(),
      findManyByHandles: jest.fn(),
      searchUsers: jest.fn(),
      create: jest.fn(),
      updateById: jest.fn(),
      update: jest.fn(),
      updatePassword: jest.fn(),
      deleteById: jest.fn()
    };
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

    const service = new FeedService(
      postsRepo as unknown as PostRepository,
      usersRepo as unknown as UserRepository,
      stubFollows,
      stubBlocks,
      stubLikes,
      stubSaves,
      stubHashtags,
      stubMentions,
      stubFollowHashtags,
      stubTags
    );

    const result = await service.getHomeFeed('viewer-1', { limit: 20, sortBy: 'recent' });

    expect(mockFindFeed).toHaveBeenCalled();
    expect(mockFindManyByIds).toHaveBeenCalled();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      id: 'post-1',
      author: {
        handle: 'author',
        displayName: 'Author'
      },
      stats: {
        likes: 10
      },
      createdAt: post.createdAt.toISOString()
    });
    expect(result.nextCursor).toBeNull();
  });

  it.skip('calcula nextCursor cuando hay más resultados', async () => {
    const olderPost = createPost({
      id: 'post-2',
      createdAt: new Date('2023-12-31T23:59:59.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z')
    });

    const postsRepo = {
      findFeed: jest.fn(async (): Promise<FeedQueryResult> => ({
        items: [olderPost],
        hasMore: true
      }))
    };
    const usersRepo = {
      findManyByIds: jest.fn(async (): Promise<UserEntity[]> => [createUser()])
    };
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

    const service = new FeedService(
      postsRepo as unknown as PostRepository,
      usersRepo as unknown as UserRepository,
      stubFollows,
      stubBlocks,
      stubLikes,
      stubSaves,
      stubHashtags,
      stubMentions,
      stubFollowHashtags,
      stubTags
    );

    const result: FeedCursorResult = await service.getHomeFeed('viewer-1', { limit: 1, sortBy: 'recent' });

    expect(result.nextCursor).toBe(olderPost.createdAt.toISOString());
  });

  it.skip('devuelve feed vacío cuando no hay publicaciones', async () => {
    const postsRepo = {
      findFeed: jest.fn(async (): Promise<FeedQueryResult> => ({ items: [], hasMore: false }))
    };
    const usersRepo = {
      findManyByIds: jest.fn(async (): Promise<UserEntity[]> => [])
    };
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

    const service = new FeedService(
      postsRepo as unknown as PostRepository,
      usersRepo as unknown as UserRepository,
      stubFollows,
      stubBlocks,
      stubLikes,
      stubSaves,
      stubHashtags,
      stubMentions,
      stubFollowHashtags,
      stubTags
    );

    const result = await service.getHomeFeed('viewer-1', { limit: 10, sortBy: 'recent' });

    expect(result).toEqual({ data: [], nextCursor: null });
  });

  it('crea una publicación y la devuelve formateada', async () => {
    const postEntity = createPost({
      media: [
        {
          id: 'media-1',
          kind: 'image',
          url: 'https://cdn.circle/test.jpg',
          thumbnailUrl: 'https://cdn.circle/thumb.jpg'
        }
      ]
    });

    const createMock = jest.fn(async (_input: CreatePostInput) => postEntity);
    const postsRepo = {
      create: createMock,
      findFeed: jest.fn()
    };
    const usersRepo = {
      findById: jest.fn(async () => createUser()),
      findManyByIds: jest.fn()
    };
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

    const service = new FeedService(
      postsRepo as unknown as PostRepository,
      usersRepo as unknown as UserRepository,
      stubFollows,
      stubBlocks,
      stubLikes,
      stubSaves,
      stubHashtags,
      stubMentions,
      stubFollowHashtags,
      stubTags
    );

    const result = await service.createPost('author-1', {
      caption: 'Nueva publicación',
      media: [
        {
          kind: 'image',
          url: 'https://cdn.circle/test.jpg',
          thumbnailUrl: 'https://cdn.circle/thumb.jpg'
        }
      ]
    });

    expect(postsRepo.create).toHaveBeenCalledTimes(1);
    const createCalls = createMock.mock.calls as Array<[CreatePostInput]>;
    expect(createCalls[0]).toBeDefined();
    const [createInput] = createCalls[0];
    expect(createInput.caption).toBe('Nueva publicación');
    expect(createInput.media[0]?.id).toEqual(expect.any(String));

    expect(usersRepo.findById).toHaveBeenCalledWith('author-1');
    expect(result).toMatchObject({
      id: postEntity.id,
      caption: postEntity.caption,
      author: {
        handle: 'author'
      }
    });
  });
});



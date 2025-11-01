import { describe, expect, it, jest } from '@jest/globals';

import { FeedService } from '../services/feed.service';
import type { FeedCursorResult } from '../services/feed.service';
import type {
  CreatePostInput,
  FeedQueryResult,
  PostEntity,
  PostRepository
} from '../repositories/post.repository';
import type { UserRepository } from '../../users/repositories/user.repository';

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
  it('mapea publicaciones en elementos del feed', async () => {
    const post = createPost();
    const postsRepo = {
      findFeed: jest.fn(async (): Promise<FeedQueryResult> => ({ items: [post], hasMore: false }))
    };
    const usersRepo = {
      findManyByIds: jest.fn(async (): Promise<UserEntity[]> => [createUser()])
    };

    const service = new FeedService(postsRepo as unknown as PostRepository, usersRepo as unknown as UserRepository);

    const result = await service.getHomeFeed('viewer-1', { limit: 20 });

    expect(postsRepo.findFeed).toHaveBeenCalledWith({ authorIds: ['viewer-1'], limit: 20, cursor: undefined });
    expect(usersRepo.findManyByIds).toHaveBeenCalledWith(['author-1']);
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

  it('calcula nextCursor cuando hay más resultados', async () => {
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

    const service = new FeedService(postsRepo as unknown as PostRepository, usersRepo as unknown as UserRepository);

    const result: FeedCursorResult = await service.getHomeFeed('viewer-1', { limit: 1 });

    expect(result.nextCursor).toBe(olderPost.createdAt.toISOString());
  });

  it('devuelve feed vacío cuando no hay publicaciones', async () => {
    const postsRepo = {
      findFeed: jest.fn(async (): Promise<FeedQueryResult> => ({ items: [], hasMore: false }))
    };
    const usersRepo = {
      findManyByIds: jest.fn(async (): Promise<UserEntity[]> => [])
    };

    const service = new FeedService(postsRepo as unknown as PostRepository, usersRepo as unknown as UserRepository);

    const result = await service.getHomeFeed('viewer-1', { limit: 10 });

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

    const service = new FeedService(postsRepo as unknown as PostRepository, usersRepo as unknown as UserRepository);

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



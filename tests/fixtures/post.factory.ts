import { faker } from '@faker-js/faker';
import type { PostEntity, PostStats } from '../../src/modules/feed/repositories/post.repository.js';
import type { PostMedia } from '../../src/modules/feed/models/post.model.js';

/**
 * Factory para crear posts de prueba
 */
export function createMockPost(overrides?: Partial<PostEntity>): PostEntity {
  const basePost: PostEntity = {
    id: faker.string.uuid(),
    authorId: faker.string.uuid(),
    caption: faker.lorem.paragraph({ min: 1, max: 3 }),
    media: createMockMediaArray(faker.number.int({ min: 0, max: 10 })),
    hashtags: faker.lorem.words(faker.number.int({ min: 0, max: 5 })).split(' '),
    stats: createMockPostStats(),
    isArchived: false,
    createdAt: faker.date.recent({ days: 30 }),
    updatedAt: faker.date.recent()
  };

  return { ...basePost, ...overrides };
}

/**
 * Crea un array de posts de prueba
 */
export function createMockPosts(count: number, overrides?: Partial<PostEntity>): PostEntity[] {
  return Array.from({ length: count }, () => createMockPost(overrides));
}

/**
 * Factory para crear estadísticas de post
 */
export function createMockPostStats(overrides?: Partial<PostStats>): PostStats {
  return {
    likes: faker.number.int({ min: 0, max: 50000 }),
    comments: faker.number.int({ min: 0, max: 5000 }),
    saves: faker.number.int({ min: 0, max: 5000 }),
    shares: faker.number.int({ min: 0, max: 1000 }),
    views: faker.number.int({ min: 0, max: 1000000 }),
    ...overrides
  };
}

/**
 * Factory para crear media (imágenes o videos)
 */
export function createMockMedia(overrides?: Partial<PostMedia>): PostMedia {
  const kind = overrides?.kind || faker.helpers.arrayElement(['image', 'video'] as const);
  
  const baseMedia: PostMedia = {
    id: faker.string.uuid(),
    kind,
    url: faker.image.url(),
    thumbnailUrl: faker.image.url(),
    ...(kind === 'video' && { durationMs: faker.number.int({ min: 5000, max: 300000 }) }),
    width: faker.number.int({ min: 800, max: 1920 }),
    height: faker.number.int({ min: 600, max: 1080 })
  };

  return { ...baseMedia, ...overrides };
}

/**
 * Crea un array de media
 */
export function createMockMediaArray(count: number): PostMedia[] {
  return Array.from({ length: count }, () => createMockMedia());
}

/**
 * Factory para crear un post con solo imagen
 */
export function createImagePost(overrides?: Partial<PostEntity>): PostEntity {
  return createMockPost({
    media: [createMockMedia({ kind: 'image' })],
    ...overrides
  });
}

/**
 * Factory para crear un post con video
 */
export function createVideoPost(overrides?: Partial<PostEntity>): PostEntity {
  return createMockPost({
    media: [createMockMedia({ kind: 'video' })],
    ...overrides
  });
}

/**
 * Factory para crear post con múltiples imágenes
 */
export function createCarouselPost(count: number = 5, overrides?: Partial<PostEntity>): PostEntity {
  return createMockPost({
    media: createMockMediaArray(count).map(m => ({ ...m, kind: 'image' as const })),
    ...overrides
  });
}


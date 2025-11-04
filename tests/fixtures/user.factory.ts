import { faker } from '@faker-js/faker';
import type { UserDomain } from '../../src/modules/users/models/user.model.js';

/**
 * Factory para crear usuarios de prueba
 * Genera datos realistas con valores aleatorios por defecto
 */
export function createMockUser(overrides?: Partial<UserDomain>): UserDomain {
  const baseUser: UserDomain = {
    id: faker.string.uuid(),
    email: faker.internet.email().toLowerCase(),
    handle: faker.string.alphanumeric({ length: 10, casing: 'lower' }),
    displayName: faker.person.fullName(),
    passwordHash: faker.string.alphanumeric(60), // Longitud típica de Argon2
    bio: faker.lorem.sentence(),
    avatarUrl: faker.image.avatar(),
    isVerified: faker.datatype.boolean({ probability: 0.1 }), // 10% son verificados
    createdAt: faker.date.past({ years: 2 }),
    updatedAt: faker.date.recent()
  };

  return { ...baseUser, ...overrides };
}

/**
 * Crea un array de usuarios de prueba
 */
export function createMockUsers(count: number, overrides?: Partial<UserDomain>): UserDomain[] {
  return Array.from({ length: count }, () => createMockUser(overrides));
}

/**
 * Factory especializado para usuarios verificados
 */
export function createVerifiedUser(overrides?: Partial<UserDomain>): UserDomain {
  return createMockUser({ ...overrides, isVerified: true });
}

/**
 * Factory especializado para usuarios con datos mínimos
 */
export function createMinimalUser(overrides?: Partial<UserDomain>): UserDomain {
  return createMockUser({
    bio: null,
    avatarUrl: null,
    isVerified: false,
    ...overrides
  });
}


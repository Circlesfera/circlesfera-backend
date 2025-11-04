import { describe, it, expect } from '@jest/globals';
import { createMockUser, createMockUsers, createVerifiedUser, createMinimalUser } from './user.factory.js';

describe('User Factory', () => {
  it('debe crear un usuario con datos válidos', () => {
    const user = createMockUser();
    
    expect(user).toBeDefined();
    expect(user.id).toBeDefined();
    expect(user.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    expect(user.handle).toBeDefined();
    expect(user.displayName).toBeDefined();
    expect(user.passwordHash).toBeDefined();
  });

  it('debe aplicar overrides correctamente', () => {
    const customEmail = 'custom@example.com';
    const user = createMockUser({ email: customEmail });
    
    expect(user.email).toBe(customEmail);
  });

  it('debe crear múltiples usuarios únicos', () => {
    const users = createMockUsers(5);
    
    expect(users).toHaveLength(5);
    const emails = users.map(u => u.email);
    const uniqueEmails = new Set(emails);
    // Debe crear emails únicos (probabilísticamente)
    expect(uniqueEmails.size).toBeGreaterThan(1);
  });

  it('debe crear usuario verificado', () => {
    const user = createVerifiedUser();
    
    expect(user.isVerified).toBe(true);
  });

  it('debe crear usuario minimalista', () => {
    const user = createMinimalUser();
    
    expect(user.bio).toBeNull();
    expect(user.avatarUrl).toBeNull();
    expect(user.isVerified).toBe(false);
  });
});


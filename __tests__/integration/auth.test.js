const request = require('supertest');
const express = require('express');
const User = require('../../src/models/User');

// Mock del logger para evitar logs en tests
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

// Crear app de prueba
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', require('../../src/routes/auth'));
  return app;
};

describe('Auth Endpoints', () => {
  let app;

  // Helper functions to generate unique test data
  const generateUniqueUsername = () => `testuser_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const generateUniqueEmail = () => `test_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`;
  const generateTestUser = (overrides = {}) => ({
    username: generateUniqueUsername(),
    email: generateUniqueEmail(),
    password: 'TestPassword123',
    fullName: `Test User ${Math.random().toString(36).substring(7)}`,
    ...overrides,
  });

  beforeEach(() => {
    app = createTestApp();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = generateTestUser();

      const res = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user).toBeDefined();
      expect(res.body.user.username).toBe(userData.username);
      expect(res.body.user.password).toBeUndefined();
    });

    it('should reject duplicate username', async () => {
      const duplicateUsername = generateUniqueUsername();
      const firstUser = generateTestUser({ username: duplicateUsername });
      
      await User.create(firstUser);

      const secondUser = generateTestUser({ 
        username: duplicateUsername,
        email: generateUniqueEmail()
      });

      const res = await request(app)
        .post('/api/auth/register')
        .send(secondUser);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject duplicate email', async () => {
      const duplicateEmail = generateUniqueEmail();
      const firstUser = generateTestUser({ email: duplicateEmail });
      
      await User.create(firstUser);

      const secondUser = generateTestUser({ 
        email: duplicateEmail,
        username: generateUniqueUsername()
      });

      const res = await request(app)
        .post('/api/auth/register')
        .send(secondUser);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should validate required fields', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: generateUniqueUsername(),
          // missing email and password
        });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    let loginUserData;

    beforeEach(async () => {
      loginUserData = generateTestUser();
      await User.create(loginUserData);
    });

    it('should login with correct credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: loginUserData.email,
          password: loginUserData.password,
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe(loginUserData.email);
    });

    it('should reject incorrect password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: loginUserData.email,
          password: 'WrongPassword123',
        });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject non-existent user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: generateUniqueEmail(),
          password: loginUserData.password,
        });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should login with username instead of email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: loginUserData.username, // username as email field
          password: loginUserData.password,
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/auth/check-username/:username', () => {
    let takenUsername;

    beforeEach(async () => {
      takenUsername = generateUniqueUsername();
      const userData = generateTestUser({ username: takenUsername });
      await User.create(userData);
    });

    it('should return false for taken username', async () => {
      const res = await request(app)
        .get(`/api/auth/check-username/${takenUsername}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.available).toBe(false);
    });

    it('should return true for available username', async () => {
      const availableUsername = generateUniqueUsername();
      const res = await request(app)
        .get(`/api/auth/check-username/${availableUsername}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.available).toBe(true);
    });
  });
});
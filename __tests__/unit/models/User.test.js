const User = require('../../../src/models/User');

describe('User Model', () => {
  // Helper function to generate unique test data
  const generateTestUser = (overrides = {}) => {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    return {
      username: `testuser_${timestamp}_${randomId}`,
      email: `test_${timestamp}_${randomId}@test.com`,
      password: 'TestPassword123',
      fullName: `Test User ${randomId}`,
      ...overrides,
    };
  };

  // Helper function to generate unique usernames for tests
  const generateUniqueUsername = () => `testuser_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  // Helper function to generate unique emails for tests
  const generateUniqueEmail = () => `test_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`;

  describe('Password hashing', () => {
    it('should hash password before saving', async () => {
      const userData = generateTestUser();
      const user = new User(userData);

      await user.save();

      expect(user.password).not.toBe(userData.password);
      expect(user.password.length).toBeGreaterThan(50);
      expect(user.password).toMatch(/^\$2[aby]\$/); // bcrypt format
    });

    it('should not rehash password if not modified', async () => {
      const userData = generateTestUser();
      const user = new User(userData);

      await user.save();
      const originalHash = user.password;

      user.fullName = `Updated Name ${Date.now()}`;
      await user.save();

      expect(user.password).toBe(originalHash);
    });

    it('should compare password correctly', async () => {
      const userData = generateTestUser({ password: 'MySecurePassword123' });
      const user = new User(userData);

      await user.save();

      const isValid = await user.comparePassword(userData.password);
      expect(isValid).toBe(true);

      const isInvalid = await user.comparePassword('WrongPassword456');
      expect(isInvalid).toBe(false);
    });
  });

  describe('Validation', () => {
    it('should require username', async () => {
      const user = new User({
        email: generateUniqueEmail(),
        password: 'TestPassword123',
      });

      await expect(user.save()).rejects.toThrow();
    });

    it('should require email', async () => {
      const user = new User({
        username: generateUniqueUsername(),
        password: 'TestPassword123',
      });

      await expect(user.save()).rejects.toThrow();
    });

    it('should require password', async () => {
      const user = new User({
        username: generateUniqueUsername(),
        email: generateUniqueEmail(),
      });

      await expect(user.save()).rejects.toThrow();
    });

    it('should enforce unique username', async () => {
      const duplicateUsername = generateUniqueUsername();
      const user1Data = generateTestUser({ username: duplicateUsername });
      const user1 = new User(user1Data);
      await user1.save();

      const user2Data = generateTestUser({ 
        username: duplicateUsername,
        email: generateUniqueEmail()
      });
      const user2 = new User(user2Data);

      await expect(user2.save()).rejects.toThrow();
    });

    it('should enforce unique email', async () => {
      const duplicateEmail = generateUniqueEmail();
      const user1Data = generateTestUser({ email: duplicateEmail });
      const user1 = new User(user1Data);
      await user1.save();

      const user2Data = generateTestUser({ 
        email: duplicateEmail,
        username: generateUniqueUsername()
      });
      const user2 = new User(user2Data);

      await expect(user2.save()).rejects.toThrow();
    });

    it('should lowercase username and email', async () => {
      const userData = generateTestUser({
        username: 'TestUser',
        email: 'Test@Test.COM',
      });
      const user = new User(userData);

      await user.save();

      expect(user.username).toBe('testuser');
      expect(user.email).toBe('test@test.com');
    });
  });

  describe('Methods', () => {
    it('should convert to public JSON', () => {
      const user = new User({
        username: generateUniqueUsername(),
        email: generateUniqueEmail(),
        password: 'hashedpassword',
        blockedUsers: [Math.random().toString(36).substring(7)],
        preferences: { theme: 'dark' },
      });

      const publicJSON = user.toPublicJSON();

      expect(publicJSON.password).toBeUndefined();
      expect(publicJSON.email).toBeUndefined();
      expect(publicJSON.blockedUsers).toBeUndefined();
      expect(publicJSON.preferences).toBeUndefined();
      expect(publicJSON.username).toBe(user.username);
    });

    it('should find by username', async () => {
      const userData = generateTestUser();
      const user = new User(userData);
      await user.save();

      const found = await User.findByUsername(userData.username);
      expect(found).toBeTruthy();
      expect(found.username).toBe(userData.username);

      const nonExistentUsername = generateUniqueUsername();
      const notFound = await User.findByUsername(nonExistentUsername);
      expect(notFound).toBeNull();
    });
  });

  describe('Virtuals', () => {
    it('should calculate followers count', async () => {
      const mongoose = require('mongoose');
      const user = new User({
        username: generateUniqueUsername(),
        email: generateUniqueEmail(),
        password: 'TestPassword123',
        followers: [
          new mongoose.Types.ObjectId(),
          new mongoose.Types.ObjectId(),
          new mongoose.Types.ObjectId(),
        ],
      });

      expect(user.followersCount).toBe(3);
    });

    it('should calculate following count', async () => {
      const mongoose = require('mongoose');
      const user = new User({
        username: generateUniqueUsername(),
        email: generateUniqueEmail(),
        password: 'TestPassword123',
        following: [
          new mongoose.Types.ObjectId(),
          new mongoose.Types.ObjectId(),
        ],
      });

      expect(user.followingCount).toBe(2);
    });
  });
});
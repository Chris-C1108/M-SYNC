/**
 * TokenManager 单元测试
 */

const TokenManager = require('../../src/services/TokenManager');
const ConfigManager = require('../../src/core/ConfigManager');

// Mock ConfigManager
jest.mock('../../src/core/ConfigManager');

describe('TokenManager', () => {
  let tokenManager;
  let mockConfigManager;

  beforeEach(() => {
    mockConfigManager = new ConfigManager();
    mockConfigManager.get = jest.fn();
    mockConfigManager.set = jest.fn();
    
    tokenManager = new TokenManager(mockConfigManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize()', () => {
    test('should initialize successfully', async () => {
      mockConfigManager.get.mockReturnValue('http://localhost:3000');
      
      await expect(tokenManager.initialize()).resolves.not.toThrow();
    });

    test('should handle missing server URL', async () => {
      mockConfigManager.get.mockReturnValue(undefined);
      
      await expect(tokenManager.initialize()).rejects.toThrow();
    });
  });

  describe('getValidToken()', () => {
    beforeEach(async () => {
      mockConfigManager.get.mockReturnValue('http://localhost:3000');
      await tokenManager.initialize();
    });

    test('should return null when no token exists', async () => {
      // Mock no stored token
      jest.spyOn(tokenManager, 'loadStoredToken').mockReturnValue(null);
      
      const token = await tokenManager.getValidToken();
      expect(token).toBeNull();
    });

    test('should return valid token when exists', async () => {
      const mockToken = 'valid-token-123';
      
      // Mock stored token
      jest.spyOn(tokenManager, 'loadStoredToken').mockReturnValue({
        token: mockToken,
        expiresAt: Date.now() + 3600000 // 1 hour from now
      });
      
      // Mock token validation
      jest.spyOn(tokenManager, 'validateToken').mockResolvedValue(true);
      
      const token = await tokenManager.getValidToken();
      expect(token).toBe(mockToken);
    });

    test('should return null for expired token', async () => {
      const mockToken = 'expired-token-123';
      
      // Mock expired token
      jest.spyOn(tokenManager, 'loadStoredToken').mockReturnValue({
        token: mockToken,
        expiresAt: Date.now() - 3600000 // 1 hour ago
      });
      
      const token = await tokenManager.getValidToken();
      expect(token).toBeNull();
    });
  });

  describe('validateToken()', () => {
    beforeEach(async () => {
      mockConfigManager.get.mockReturnValue('http://localhost:3000');
      await tokenManager.initialize();
    });

    test('should validate token successfully', async () => {
      const mockToken = 'valid-token-123';
      
      // Mock successful HTTP response
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ valid: true })
      });
      
      const isValid = await tokenManager.validateToken(mockToken);
      expect(isValid).toBe(true);
    });

    test('should handle invalid token', async () => {
      const mockToken = 'invalid-token-123';
      
      // Mock failed HTTP response
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401
      });
      
      const isValid = await tokenManager.validateToken(mockToken);
      expect(isValid).toBe(false);
    });

    test('should handle network errors', async () => {
      const mockToken = 'token-123';
      
      // Mock network error
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
      
      const isValid = await tokenManager.validateToken(mockToken);
      expect(isValid).toBe(false);
    });
  });

  describe('clearToken()', () => {
    test('should clear stored token', () => {
      const clearSpy = jest.spyOn(tokenManager, 'clearStoredToken').mockImplementation();
      
      tokenManager.clearToken();
      
      expect(clearSpy).toHaveBeenCalled();
    });
  });

  describe('isTokenExpired()', () => {
    test('should return true for expired token', () => {
      const expiredTime = Date.now() - 3600000; // 1 hour ago
      expect(tokenManager.isTokenExpired(expiredTime)).toBe(true);
    });

    test('should return false for valid token', () => {
      const validTime = Date.now() + 3600000; // 1 hour from now
      expect(tokenManager.isTokenExpired(validTime)).toBe(false);
    });

    test('should handle edge case of exactly expired token', () => {
      const exactTime = Date.now();
      expect(tokenManager.isTokenExpired(exactTime)).toBe(true);
    });
  });
});

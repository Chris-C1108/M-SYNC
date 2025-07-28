/**
 * 统一认证服务
 * 处理用户认证、注册、令牌管理等业务逻辑
 */

const config = require('config');
const User = require('../models/User');
const AccessToken = require('../models/AccessToken');
const logger = require('../utils/logger').components.auth;

class AuthenticationService {
  constructor() {
    this.defaultTokenExpiryDays = config.get('auth.tokenExpiryDays') || 30;
  }

  /**
   * 用户注册
   */
  async register({ username, email, password, deviceType = 'web', deviceInfo = {}, tokenName = null }) {
    try {
      logger.info('User registration started', { username, email, deviceType });

      // 输入验证
      this.validateRegistrationInput({ username, email, password });

      // 创建用户
      const user = await User.create({ username, email, password });

      // 创建默认访问令牌
      const { token, accessToken } = await AccessToken.create({
        userId: user.id,
        tokenName: tokenName || `${deviceType} - 注册时创建`,
        deviceType,
        deviceInfo,
        clientInfo: {
          createdDuring: 'registration',
          userAgent: deviceInfo.userAgent || 'Unknown'
        }
      });

      logger.info('User registration completed', {
        userId: user.id,
        username: user.username,
        tokenId: accessToken.id
      });

      return {
        user: user.toSafeJSON(),
        token,
        tokenInfo: accessToken.toJSON()
      };

    } catch (error) {
      logger.error('User registration failed:', {
        username,
        email,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 用户登录
   */
  async login({ username, password, deviceType = 'web', deviceInfo = {}, tokenName = null }) {
    try {
      logger.info('User login attempt', { username, deviceType });

      // 查找用户
      const user = await User.findByUsernameOrEmail(username);
      if (!user) {
        throw new Error('Invalid credentials');
      }

      // 验证密码
      const isValidPassword = await user.validatePassword(password);
      if (!isValidPassword) {
        throw new Error('Invalid credentials');
      }

      // 更新最后登录时间
      await user.updateLastLogin();

      // 创建新的访问令牌
      const { token, accessToken } = await AccessToken.create({
        userId: user.id,
        tokenName: tokenName || `${deviceType} - ${new Date().toLocaleDateString()}`,
        deviceType,
        deviceInfo,
        clientInfo: {
          createdDuring: 'login',
          userAgent: deviceInfo.userAgent || 'Unknown',
          loginTime: new Date().toISOString()
        }
      });

      logger.info('User login successful', {
        userId: user.id,
        username: user.username,
        tokenId: accessToken.id
      });

      return {
        user: user.toSafeJSON(),
        token,
        tokenInfo: accessToken.toJSON()
      };

    } catch (error) {
      logger.error('User login failed:', {
        username,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 获取用户信息
   */
  async getUserProfile(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      return user.toSafeJSON();

    } catch (error) {
      logger.error('Failed to get user profile:', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 创建新的访问令牌
   */
  async createToken({ userId, tokenName, deviceType, permissions = ['message:publish', 'message:read'], deviceInfo = {}, expiryDays = null }) {
    try {
      logger.info('Creating new access token', { userId, deviceType, tokenName });

      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const { token, accessToken } = await AccessToken.create({
        userId,
        tokenName,
        deviceType,
        permissions,
        deviceInfo,
        expiryDays
      });

      logger.info('Access token created successfully', {
        userId,
        tokenId: accessToken.id
      });

      return { token, tokenInfo: accessToken.toJSON() };

    } catch (error) {
      logger.error('Token creation failed:', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 获取用户的所有Token
   */
  async getUserTokens(userId, includeInactive = false) {
    try {
      const tokens = await AccessToken.findByUserId(userId, includeInactive);
      return tokens.map(token => token.toJSON());

    } catch (error) {
      logger.error('Failed to get user tokens:', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 撤销指定Token
   */
  async revokeToken(userId, tokenId) {
    try {
      logger.info('Revoking token', { userId, tokenId });

      const tokens = await AccessToken.findByUserId(userId);
      const token = tokens.find(t => t.id === tokenId);

      if (!token) {
        throw new Error('Token not found or does not belong to user');
      }

      await token.revoke();

      logger.info('Token revoked successfully', { userId, tokenId });

    } catch (error) {
      logger.error('Token revocation failed:', {
        userId,
        tokenId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 撤销用户的所有Token
   */
  async revokeAllTokens(userId, excludeTokenId = null) {
    try {
      logger.info('Revoking all user tokens', { userId, excludeTokenId });

      const revokedCount = await AccessToken.revokeAllByUserId(userId, excludeTokenId);

      logger.info('All user tokens revoked', { userId, revokedCount });

      return revokedCount;

    } catch (error) {
      logger.error('Failed to revoke all tokens:', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 验证访问令牌
   */
  async verifyToken(token) {
    try {
      const accessToken = await AccessToken.findByToken(token);
      if (!accessToken) {
        throw new Error('Invalid or expired token');
      }

      // 获取用户信息
      const user = await User.findById(accessToken.userId);
      if (!user) {
        throw new Error('User not found');
      }

      return { user, accessToken };

    } catch (error) {
      logger.warn('Token verification failed:', error.message);
      throw error;
    }
  }

  /**
   * 用户登出（可选实现）
   */
  async logout(userId) {
    try {
      logger.info('User logout', { userId });
      
      // 在实际实现中，可以考虑：
      // 1. 将JWT加入黑名单（需要Redis支持）
      // 2. 刷新API Token使旧token失效
      // 3. 记录登出时间
      
      // 这里简单记录登出事件
      logger.info('User logged out successfully', { userId });

    } catch (error) {
      logger.error('Logout failed:', {
        userId,
        error: error.message
      });
      throw error;
    }
  }



  /**
   * 验证注册输入
   */
  validateRegistrationInput({ username, email, password }) {
    // 用户名验证
    if (!username || username.length < 3 || username.length > 30) {
      throw new Error('Username must be between 3 and 30 characters');
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      throw new Error('Username can only contain letters, numbers, and underscores');
    }

    // 邮箱验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }

    // 密码验证
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    // 密码强度验证
    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (!(hasLower && hasUpper && hasNumber && hasSpecial)) {
      throw new Error('Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character');
    }
  }

  /**
   * 更新Token信息
   */
  async updateToken(userId, tokenId, updates) {
    try {
      const tokens = await AccessToken.findByUserId(userId);
      const token = tokens.find(t => t.id === tokenId);

      if (!token) {
        throw new Error('Token not found or does not belong to user');
      }

      await token.update(updates);

      logger.info('Token updated successfully', { userId, tokenId });

      return token.toJSON();

    } catch (error) {
      logger.error('Token update failed:', {
        userId,
        tokenId,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = AuthenticationService;

/**
 * 认证控制器
 * 处理用户认证相关的HTTP请求
 */

const AuthenticationService = require('../services/AuthenticationService');
const logger = require('../utils/logger').components.auth;

class AuthController {
  constructor() {
    this.authService = new AuthenticationService();
  }

  /**
   * 用户注册
   * POST /api/v1/auth/register
   */
  async register(req, res) {
    try {
      const { username, email, password } = req.body;

      logger.info('User registration attempt', {
        username,
        email
      });

      const result = await this.authService.register({
        username,
        email,
        password,
        deviceType: 'web',
        deviceInfo: {
          userAgent: req.get('User-Agent'),
          ip: req.ip
        },
        tokenName: '注册时创建'
      });

      logger.info('User registered successfully', {
        userId: result.user.id,
        username: result.user.username
      });

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: result.user,
          token: result.token,
          tokenInfo: result.tokenInfo
        }
      });

    } catch (error) {
      logger.error('Registration failed', {
        error: error.message,
        username: req.body?.username
      });

      if (error.message.includes('already exists')) {
        res.status(409).json({
          success: false,
          error: 'Conflict',
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal Server Error',
          message: 'Registration failed'
        });
      }
    }
  }

  /**
   * 用户登录
   * POST /api/v1/auth/login
   */
  async login(req, res) {
    try {
      const { username, password } = req.body;

      logger.info('User login attempt', {
        username
      });

      const result = await this.authService.login({
        username,
        password,
        deviceType: 'web',
        deviceInfo: {
          userAgent: req.get('User-Agent'),
          ip: req.ip
        },
        tokenName: '登录创建'
      });

      logger.info('User logged in successfully', {
        userId: result.user.id,
        username: result.user.username
      });

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          user: result.user,
          token: result.token,
          tokenInfo: result.tokenInfo
        }
      });

    } catch (error) {
      logger.error('Login failed', {
        error: error.message,
        username: req.body?.username
      });

      if (error.message.includes('Invalid credentials')) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'Invalid username or password'
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal Server Error',
          message: 'Login failed'
        });
      }
    }
  }

  /**
   * 获取用户信息
   * GET /api/v1/auth/profile
   */
  async getProfile(req, res) {
    try {
      const userId = req.user.id;

      const user = await this.authService.getUserProfile(userId);

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
          }
        }
      });

    } catch (error) {
      logger.error('Failed to get user profile', {
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to get user profile'
      });
    }
  }



  /**
   * 用户登出
   * POST /api/v1/auth/logout
   */
  async logout(req, res) {
    try {
      const userId = req.user.id;

      logger.info('User logout', {
        userId
      });

      await this.authService.logout(userId);

      res.status(200).json({
        success: true,
        message: 'Logout successful'
      });

    } catch (error) {
      logger.error('Logout failed', {
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Logout failed'
      });
    }
  }
}

module.exports = AuthController;

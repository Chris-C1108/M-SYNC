/**
 * Token管理控制器
 * 处理Token的创建、查看、撤销等操作
 */

const AuthenticationService = require('../services/AuthenticationService');
const logger = require('../utils/logger').createLogger('TokenController');

class TokenController {
  constructor() {
    this.authService = new AuthenticationService();
  }

  /**
   * 获取用户的所有Token
   * GET /api/v1/tokens
   */
  async getTokens(req, res) {
    try {
      const userId = req.user.id;
      const { includeInactive = false } = req.query;

      logger.info('Fetching user tokens', {
        userId,
        includeInactive
      });

      const tokens = await this.authService.getUserTokens(
        userId, 
        includeInactive === 'true'
      );

      res.status(200).json({
        success: true,
        data: {
          tokens,
          total: tokens.length,
          active: tokens.filter(t => t.isActive && !t.isExpired).length
        }
      });

    } catch (error) {
      logger.error('Failed to fetch tokens', {
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to fetch tokens'
      });
    }
  }

  /**
   * 创建新的Token
   * POST /api/v1/tokens
   */
  async createToken(req, res) {
    try {
      console.log('TokenController.createToken called');
      console.log('Request path:', req.path);
      console.log('Request body:', req.body);
      console.log('Request user:', req.user);

      const userId = req.user.id;
      const {
        tokenName,
        deviceType,
        permissions = ['message:publish', 'message:read'],
        deviceInfo = {},
        expiryDays = null
      } = req.body;

      logger.info('Creating new token', {
        userId,
        tokenName,
        deviceType
      });

      // 验证输入
      if (!tokenName || !deviceType) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'tokenName and deviceType are required'
        });
      }

      const validDeviceTypes = ['desktop', 'ios_shortcuts', 'web', 'mobile', 'api'];
      if (!validDeviceTypes.includes(deviceType)) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: `deviceType must be one of: ${validDeviceTypes.join(', ')}`
        });
      }

      // 验证权限
      const validPermissions = ['message:publish', 'message:read'];
      if (permissions && !Array.isArray(permissions)) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'permissions must be an array'
        });
      }

      if (permissions && permissions.some(p => !validPermissions.includes(p))) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: `permissions must be one of: ${validPermissions.join(', ')}`
        });
      }

      // 添加客户端信息
      const enrichedDeviceInfo = {
        ...deviceInfo,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        createdVia: 'api'
      };

      const result = await this.authService.createToken({
        userId,
        tokenName,
        deviceType,
        permissions,
        deviceInfo: enrichedDeviceInfo,
        expiryDays
      });

      logger.info('Token created successfully', {
        userId,
        tokenId: result.tokenInfo.id,
        tokenName
      });

      res.status(201).json({
        success: true,
        message: 'Token created successfully',
        data: {
          token: result.token, // 只在创建时返回完整token
          tokenInfo: result.tokenInfo
        }
      });

    } catch (error) {
      logger.error('Failed to create token', {
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to create token'
      });
    }
  }

  /**
   * 更新Token信息
   * PUT /api/v1/tokens/:tokenId
   */
  async updateToken(req, res) {
    try {
      const userId = req.user.id;
      const { tokenId } = req.params;
      const { tokenName, deviceInfo } = req.body;

      logger.info('Updating token', {
        userId,
        tokenId,
        tokenName
      });

      const updates = {};
      if (tokenName !== undefined) updates.tokenName = tokenName;
      if (deviceInfo !== undefined) updates.deviceInfo = deviceInfo;

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'No valid fields to update'
        });
      }

      const updatedToken = await this.authService.updateToken(
        userId, 
        tokenId, 
        updates
      );

      logger.info('Token updated successfully', {
        userId,
        tokenId
      });

      res.status(200).json({
        success: true,
        message: 'Token updated successfully',
        data: {
          tokenInfo: updatedToken
        }
      });

    } catch (error) {
      logger.error('Failed to update token', {
        error: error.message,
        userId: req.user?.id,
        tokenId: req.params?.tokenId
      });

      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'Token not found'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to update token'
      });
    }
  }

  /**
   * 撤销指定Token
   * DELETE /api/v1/tokens/:tokenId
   */
  async revokeToken(req, res) {
    try {
      const userId = req.user.id;
      const { tokenId } = req.params;

      logger.info('Revoking token', {
        userId,
        tokenId
      });

      await this.authService.revokeToken(userId, tokenId);

      logger.info('Token revoked successfully', {
        userId,
        tokenId
      });

      res.status(200).json({
        success: true,
        message: 'Token revoked successfully'
      });

    } catch (error) {
      logger.error('Failed to revoke token', {
        error: error.message,
        userId: req.user?.id,
        tokenId: req.params?.tokenId
      });

      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'Token not found'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to revoke token'
      });
    }
  }

  /**
   * 撤销所有Token
   * DELETE /api/v1/tokens
   */
  async revokeAllTokens(req, res) {
    try {
      const userId = req.user.id;
      const { excludeCurrent = false } = req.query;

      logger.info('Revoking all tokens', {
        userId,
        excludeCurrent
      });

      // 如果要排除当前Token，需要获取当前Token ID
      let excludeTokenId = null;
      if (excludeCurrent === 'true' && req.accessToken) {
        excludeTokenId = req.accessToken.id;
      }

      const revokedCount = await this.authService.revokeAllTokens(
        userId, 
        excludeTokenId
      );

      logger.info('All tokens revoked successfully', {
        userId,
        revokedCount,
        excludeTokenId
      });

      res.status(200).json({
        success: true,
        message: 'All tokens revoked successfully',
        data: {
          revokedCount,
          excludedCurrentToken: !!excludeTokenId
        }
      });

    } catch (error) {
      logger.error('Failed to revoke all tokens', {
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to revoke all tokens'
      });
    }
  }

  /**
   * 获取当前Token信息
   * GET /api/v1/tokens/current
   */
  async getCurrentToken(req, res) {
    try {
      if (!req.accessToken) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'No current token information available'
        });
      }

      // 获取完整的Token信息
      const tokens = await this.authService.getUserTokens(req.user.id);
      const currentToken = tokens.find(t => t.id === req.accessToken.id);

      if (!currentToken) {
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'Current token not found'
        });
      }

      res.status(200).json({
        success: true,
        data: {
          tokenInfo: currentToken
        }
      });

    } catch (error) {
      logger.error('Failed to get current token', {
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to get current token information'
      });
    }
  }
}

module.exports = TokenController;

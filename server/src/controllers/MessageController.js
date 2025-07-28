/**
 * 消息控制器
 * 处理消息相关的HTTP请求
 */

const serviceRegistry = require('../utils/ServiceRegistry');
const logger = require('../utils/logger').components.gateway;

class MessageController {
  constructor() {
    // 服务将在运行时从注册表获取
  }

  /**
   * 获取消息代理服务
   */
  getMessageBrokerService() {
    return serviceRegistry.get('messageBroker');
  }

  /**
   * 发布消息
   * POST /api/v1/messages/publish
   */
  async publishMessage(req, res) {
    try {
      const { messageType, content, timestamp } = req.body;
      const userId = req.user.id; // 从认证中间件获取

      logger.info('Publishing message', {
        userId,
        messageType,
        contentLength: content.length
      });

      // 调用消息代理服务发布消息
      const messageBrokerService = this.getMessageBrokerService();
      const result = await messageBrokerService.publishMessage({
        userId,
        tokenId: req.accessToken.id,
        messageType,
        content,
        timestamp: timestamp || new Date().toISOString()
      });

      logger.info('Message published successfully', {
        messageId: result.messageId,
        userId
      });

      res.status(200).json({
        success: true,
        messageId: result.messageId,
        timestamp: result.timestamp,
        deliveredTo: result.deliveredTo
      });

    } catch (error) {
      logger.error('Failed to publish message', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to publish message'
      });
    }
  }

  /**
   * 获取消息历史记录
   * GET /api/v1/messages/history
   */
  async getMessageHistory(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 50, messageType } = req.query;

      logger.info('Fetching message history', {
        userId,
        page,
        limit,
        messageType
      });

      const messageBrokerService = this.getMessageBrokerService();
      const history = await messageBrokerService.getMessageHistory({
        userId,
        page: parseInt(page),
        limit: parseInt(limit),
        messageType
      });

      res.status(200).json({
        success: true,
        data: history.messages,
        pagination: {
          page: history.page,
          limit: history.limit,
          total: history.total,
          pages: history.pages
        }
      });

    } catch (error) {
      logger.error('Failed to fetch message history', {
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to fetch message history'
      });
    }
  }

  /**
   * 获取消息统计信息
   * GET /api/v1/messages/stats
   */
  async getMessageStats(req, res) {
    try {
      const userId = req.user.id;
      const { period = '7d' } = req.query;

      logger.info('Fetching message stats', {
        userId,
        period
      });

      const messageBrokerService = this.getMessageBrokerService();
      const stats = await messageBrokerService.getMessageStats({
        userId,
        period
      });

      res.status(200).json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('Failed to fetch message stats', {
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to fetch message stats'
      });
    }
  }
}

module.exports = MessageController;

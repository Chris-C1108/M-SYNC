/**
 * 消息代理服务
 * 核心业务逻辑处理类
 */

const { v4: uuidv4 } = require('uuid');
const Message = require('../models/Message');
const logger = require('../utils/logger').components.broker;

class MessageBrokerService {
  constructor(webSocketService = null) {
    this.webSocketService = webSocketService;
  }

  /**
   * 设置WebSocket服务
   */
  setWebSocketService(webSocketService) {
    this.webSocketService = webSocketService;
  }

  /**
   * 发布消息到指定用户的所有连接
   */
  async publishMessage({ userId, tokenId, messageType, content, timestamp }) {
    try {
      logger.info('Publishing message', {
        userId,
        tokenId,
        messageType,
        contentLength: content.length
      });

      // 1. 验证消息格式
      this.validateMessage({ messageType, content });

      // 2. 检查重复消息
      const contentHash = Message.hashContent(content);
      const isDuplicate = await Message.isDuplicate(userId, contentHash);

      if (isDuplicate) {
        logger.warn('Duplicate message detected', { userId, contentHash });
        throw new Error('Duplicate message detected within time window');
      }

      // 3. 存储消息到数据库
      const message = await Message.create({
        userId,
        tokenId,
        messageType,
        content,
        publishedAt: timestamp
      });

      // 4. 广播消息到所有活跃连接
      const deliveredTo = await this.broadcastMessage(userId, message);

      logger.info('Message published successfully', {
        messageId: message.id,
        userId,
        deliveredTo: deliveredTo.length
      });

      return {
        messageId: message.id,
        timestamp: message.publishedAt,
        deliveredTo: deliveredTo.length
      };

    } catch (error) {
      logger.error('Failed to publish message:', error);
      throw error;
    }
  }

  /**
   * 获取用户消息历史
   */
  async getMessageHistory({ userId, page, limit, messageType }) {
    try {
      logger.info('Fetching message history', {
        userId,
        page,
        limit,
        messageType
      });

      const result = await Message.findByUserId(userId, {
        page,
        limit,
        messageType
      });

      return result;

    } catch (error) {
      logger.error('Failed to get message history:', error);
      throw error;
    }
  }

  /**
   * 获取消息统计信息
   */
  async getMessageStats({ userId, period }) {
    try {
      logger.info('Fetching message stats', {
        userId,
        period
      });

      const stats = await Message.getStatsByUserId(userId, period);
      return stats;

    } catch (error) {
      logger.error('Failed to get message stats:', error);
      throw error;
    }
  }

  /**
   * 验证消息格式
   */
  validateMessage({ messageType, content }) {
    const validTypes = ['TEXT', 'URL', 'CODE'];

    if (!validTypes.includes(messageType)) {
      throw new Error(`Invalid message type: ${messageType}`);
    }

    if (!content || content.length === 0) {
      throw new Error('Message content cannot be empty');
    }

    if (content.length > 1048576) { // 1MB
      throw new Error('Message content too large');
    }
  }

  /**
   * 广播消息到用户的所有活跃连接
   */
  async broadcastMessage(userId, message) {
    try {
      logger.info('Broadcasting message', {
        userId,
        messageId: message.id
      });

      if (!this.webSocketService) {
        logger.warn('WebSocket service not available for broadcasting');
        return [];
      }

      // 构造广播消息
      const broadcastMessage = {
        type: 'message',
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        data: {
          messageId: message.id,
          messageType: message.messageType,
          content: message.content,
          publishedAt: message.publishedAt,
          metadata: message.metadata
        }
      };

      // 广播到用户的所有连接
      const sentCount = this.webSocketService.broadcastToUser(userId, broadcastMessage);

      logger.info('Message broadcasted successfully', {
        userId,
        messageId: message.id,
        sentCount
      });

      return Array(sentCount).fill({ connectionId: 'websocket' });

    } catch (error) {
      logger.error('Failed to broadcast message:', error);
      return [];
    }
  }
}

module.exports = MessageBrokerService;

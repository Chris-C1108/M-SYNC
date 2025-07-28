/**
 * 消息数据模型
 * 处理消息相关的数据库操作
 */

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const serviceRegistry = require('../utils/ServiceRegistry');
const logger = require('../utils/logger').components.database;

class Message {
  constructor(messageData = {}) {
    this.id = messageData.id;
    this.userId = messageData.user_id;
    this.tokenId = messageData.token_id;
    this.messageType = messageData.message_type;
    this.content = messageData.content;
    this.contentHash = messageData.content_hash;
    this.metadata = typeof messageData.metadata === 'string'
      ? JSON.parse(messageData.metadata || '{}')
      : messageData.metadata || {};
    this.publishedAt = messageData.published_at;
    this.createdAt = messageData.created_at;
  }

  /**
   * 获取数据库连接
   */
  static getDatabase() {
    return serviceRegistry.get('database').getDatabase();
  }

  /**
   * 创建新消息
   */
  static async create({
    userId,
    tokenId,
    messageType,
    content,
    metadata = {},
    publishedAt = null
  }) {
    try {
      logger.info('Creating new message', { userId, messageType, contentLength: content.length });

      const messageData = {
        id: uuidv4(),
        user_id: userId,
        token_id: tokenId,
        message_type: messageType,
        content,
        content_hash: Message.hashContent(content),
        metadata: JSON.stringify(metadata),
        published_at: publishedAt || new Date().toISOString(),
        created_at: new Date().toISOString()
      };

      // 保存到数据库
      const db = Message.getDatabase();
      await db.run(`
        INSERT INTO messages (
          id, user_id, token_id, message_type, content,
          content_hash, metadata, published_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        messageData.id, messageData.user_id, messageData.token_id,
        messageData.message_type, messageData.content, messageData.content_hash,
        messageData.metadata, messageData.published_at, messageData.created_at
      ]);

      logger.info('Message created successfully', {
        messageId: messageData.id,
        userId,
        messageType
      });

      return new Message(messageData);

    } catch (error) {
      logger.error('Failed to create message:', error);
      throw error;
    }
  }

  /**
   * 根据用户ID获取消息历史
   */
  static async findByUserId(userId, { page = 1, limit = 50, messageType = null } = {}) {
    try {
      const offset = (page - 1) * limit;
      const db = Message.getDatabase();

      let sql = `
        SELECT m.*, at.token_name, at.device_type
        FROM messages m
        LEFT JOIN access_tokens at ON m.token_id = at.id
        WHERE m.user_id = ?
      `;
      const params = [userId];

      if (messageType) {
        sql += ` AND m.message_type = ?`;
        params.push(messageType);
      }

      sql += ` ORDER BY m.published_at DESC LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      const rows = await db.all(sql, params);

      // 获取总数
      let countSql = `SELECT COUNT(*) as total FROM messages WHERE user_id = ?`;
      const countParams = [userId];
      
      if (messageType) {
        countSql += ` AND message_type = ?`;
        countParams.push(messageType);
      }

      const countResult = await db.get(countSql, countParams);
      const total = countResult.total;

      return {
        messages: rows.map(row => ({
          ...new Message(row).toJSON(),
          tokenName: row.token_name,
          deviceType: row.device_type
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };

    } catch (error) {
      logger.error('Failed to find messages by user ID:', error);
      throw error;
    }
  }

  /**
   * 获取用户消息统计
   */
  static async getStatsByUserId(userId, period = '7d') {
    try {
      const db = Message.getDatabase();
      
      // 解析时间段
      const days = parseInt(period.replace('d', ''));
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // 总消息数统计
      const totalResult = await db.get(`
        SELECT COUNT(*) as total FROM messages 
        WHERE user_id = ? AND published_at >= ?
      `, [userId, startDate.toISOString()]);

      // 按类型统计
      const typeStats = await db.all(`
        SELECT message_type, COUNT(*) as count 
        FROM messages 
        WHERE user_id = ? AND published_at >= ?
        GROUP BY message_type
      `, [userId, startDate.toISOString()]);

      // 按日期统计
      const dailyStats = await db.all(`
        SELECT 
          DATE(published_at) as date,
          COUNT(*) as count
        FROM messages 
        WHERE user_id = ? AND published_at >= ?
        GROUP BY DATE(published_at)
        ORDER BY date DESC
      `, [userId, startDate.toISOString()]);

      return {
        period,
        totalMessages: totalResult.total,
        messagesByType: typeStats.reduce((acc, stat) => {
          acc[stat.message_type] = stat.count;
          return acc;
        }, {}),
        dailyStats: dailyStats.map(stat => ({
          date: stat.date,
          count: stat.count
        }))
      };

    } catch (error) {
      logger.error('Failed to get message stats:', error);
      throw error;
    }
  }

  /**
   * 计算内容哈希
   */
  static hashContent(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * 检查重复消息
   */
  static async isDuplicate(userId, contentHash, timeWindow = 300) {
    try {
      const db = Message.getDatabase();
      const cutoffTime = new Date(Date.now() - timeWindow * 1000).toISOString();

      const result = await db.get(`
        SELECT id FROM messages 
        WHERE user_id = ? AND content_hash = ? AND published_at > ?
        LIMIT 1
      `, [userId, contentHash, cutoffTime]);

      return !!result;

    } catch (error) {
      logger.error('Failed to check duplicate message:', error);
      return false;
    }
  }

  /**
   * 删除旧消息（清理任务）
   */
  static async cleanupOldMessages(retentionDays = 90) {
    try {
      const db = Message.getDatabase();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = await db.run(`
        DELETE FROM messages 
        WHERE published_at < ?
      `, [cutoffDate.toISOString()]);

      logger.info('Old messages cleaned up', {
        deletedCount: result.changes,
        cutoffDate: cutoffDate.toISOString()
      });

      return result.changes;

    } catch (error) {
      logger.error('Failed to cleanup old messages:', error);
      throw error;
    }
  }

  /**
   * 转换为JSON对象
   */
  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      tokenId: this.tokenId,
      messageType: this.messageType,
      content: this.content,
      contentHash: this.contentHash,
      metadata: this.metadata,
      publishedAt: this.publishedAt,
      createdAt: this.createdAt
    };
  }
}

module.exports = Message;

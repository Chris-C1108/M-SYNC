/**
 * 统一访问令牌模型
 * 管理所有客户端类型的Token
 */

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const config = require('config');
const serviceRegistry = require('../utils/ServiceRegistry');
const logger = require('../utils/logger').components.database;

class AccessToken {
  constructor(tokenData = {}) {
    this.id = tokenData.id;
    this.userId = tokenData.user_id;
    this.tokenHash = tokenData.token_hash;
    this.tokenName = tokenData.token_name;
    this.deviceType = tokenData.device_type;
    this.deviceInfo = typeof tokenData.device_info === 'string' 
      ? JSON.parse(tokenData.device_info || '{}') 
      : tokenData.device_info || {};
    this.clientInfo = typeof tokenData.client_info === 'string'
      ? JSON.parse(tokenData.client_info || '{}')
      : tokenData.client_info || {};
    this.permissions = typeof tokenData.permissions === 'string'
      ? JSON.parse(tokenData.permissions || '[]')
      : tokenData.permissions || [];
    this.expiresAt = tokenData.expires_at;
    this.lastUsedAt = tokenData.last_used_at;
    this.createdAt = tokenData.created_at;
    this.updatedAt = tokenData.updated_at;
    this.isActive = tokenData.is_active !== false;
  }

  /**
   * 获取数据库连接
   */
  static getDatabase() {
    return serviceRegistry.get('database').getDatabase();
  }

  /**
   * 创建新的访问令牌
   */
  static async create({
    userId,
    tokenName,
    deviceType,
    deviceInfo = {},
    clientInfo = {},
    permissions = ['message:publish', 'message:read'],
    expiryDays = null
  }) {
    try {
      logger.info('Creating new access token', { userId, deviceType, tokenName });

      // 生成Token
      const token = AccessToken.generateToken();
      const tokenHash = AccessToken.hashToken(token);

      // 计算过期时间
      const expiresAt = AccessToken.calculateExpiry(expiryDays);

      const tokenData = {
        id: uuidv4(),
        user_id: userId,
        token_hash: tokenHash,
        token_name: tokenName,
        device_type: deviceType,
        device_info: JSON.stringify(deviceInfo),
        client_info: JSON.stringify(clientInfo),
        permissions: JSON.stringify(permissions),
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_active: true
      };

      // 保存到数据库
      const db = AccessToken.getDatabase();
      await db.run(`
        INSERT INTO access_tokens (
          id, user_id, token_hash, token_name, device_type,
          device_info, client_info, permissions, expires_at,
          created_at, updated_at, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        tokenData.id, tokenData.user_id, tokenData.token_hash,
        tokenData.token_name, tokenData.device_type, tokenData.device_info,
        tokenData.client_info, tokenData.permissions, tokenData.expires_at,
        tokenData.created_at, tokenData.updated_at, tokenData.is_active
      ]);

      logger.info('Access token created successfully', {
        tokenId: tokenData.id,
        userId,
        deviceType
      });

      const accessToken = new AccessToken(tokenData);
      // 返回Token和实例（Token只在创建时返回）
      return { token, accessToken };

    } catch (error) {
      logger.error('Failed to create access token:', error);
      throw error;
    }
  }

  /**
   * 根据Token查找
   */
  static async findByToken(token) {
    try {
      const tokenHash = AccessToken.hashToken(token);
      const db = AccessToken.getDatabase();
      
      const row = await db.get(`
        SELECT * FROM access_tokens 
        WHERE token_hash = ? AND is_active = 1 
        AND (expires_at IS NULL OR expires_at > datetime('now'))
      `, [tokenHash]);

      if (row) {
        // 更新最后使用时间
        await db.run(`
          UPDATE access_tokens 
          SET last_used_at = ?, updated_at = ? 
          WHERE id = ?
        `, [new Date().toISOString(), new Date().toISOString(), row.id]);

        row.last_used_at = new Date().toISOString();
        return new AccessToken(row);
      }

      return null;

    } catch (error) {
      logger.error('Failed to find token:', error);
      throw error;
    }
  }

  /**
   * 获取用户的所有Token
   */
  static async findByUserId(userId, includeInactive = false) {
    try {
      const db = AccessToken.getDatabase();
      
      let sql = `
        SELECT * FROM access_tokens 
        WHERE user_id = ?
      `;
      
      if (!includeInactive) {
        sql += ` AND is_active = 1`;
      }
      
      sql += ` ORDER BY created_at DESC`;

      const rows = await db.all(sql, [userId]);
      return rows.map(row => new AccessToken(row));

    } catch (error) {
      logger.error('Failed to find tokens by user ID:', error);
      throw error;
    }
  }

  /**
   * 撤销Token
   */
  async revoke() {
    try {
      const db = AccessToken.getDatabase();
      const now = new Date().toISOString();

      await db.run(`
        UPDATE access_tokens 
        SET is_active = 0, updated_at = ? 
        WHERE id = ?
      `, [now, this.id]);

      this.isActive = false;
      this.updatedAt = now;

      logger.info('Access token revoked', {
        tokenId: this.id,
        userId: this.userId
      });

    } catch (error) {
      logger.error('Failed to revoke token:', error);
      throw error;
    }
  }

  /**
   * 撤销用户的所有Token
   */
  static async revokeAllByUserId(userId, excludeTokenId = null) {
    try {
      const db = AccessToken.getDatabase();
      const now = new Date().toISOString();

      let sql = `
        UPDATE access_tokens 
        SET is_active = 0, updated_at = ? 
        WHERE user_id = ? AND is_active = 1
      `;
      const params = [now, userId];

      if (excludeTokenId) {
        sql += ` AND id != ?`;
        params.push(excludeTokenId);
      }

      const result = await db.run(sql, params);

      logger.info('All user tokens revoked', {
        userId,
        revokedCount: result.changes,
        excludeTokenId
      });

      return result.changes;

    } catch (error) {
      logger.error('Failed to revoke all user tokens:', error);
      throw error;
    }
  }

  /**
   * 更新Token信息
   */
  async update({ tokenName, deviceInfo, clientInfo }) {
    try {
      const db = AccessToken.getDatabase();
      const now = new Date().toISOString();

      const updates = [];
      const params = [];

      if (tokenName !== undefined) {
        updates.push('token_name = ?');
        params.push(tokenName);
        this.tokenName = tokenName;
      }

      if (deviceInfo !== undefined) {
        updates.push('device_info = ?');
        params.push(JSON.stringify(deviceInfo));
        this.deviceInfo = deviceInfo;
      }

      if (clientInfo !== undefined) {
        updates.push('client_info = ?');
        params.push(JSON.stringify(clientInfo));
        this.clientInfo = clientInfo;
      }

      if (updates.length > 0) {
        updates.push('updated_at = ?');
        params.push(now);
        params.push(this.id);

        await db.run(`
          UPDATE access_tokens 
          SET ${updates.join(', ')} 
          WHERE id = ?
        `, params);

        this.updatedAt = now;
      }

      logger.info('Access token updated', { tokenId: this.id });

    } catch (error) {
      logger.error('Failed to update token:', error);
      throw error;
    }
  }

  /**
   * 生成Token
   */
  static generateToken() {
    // 生成128字符的hex字符串
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * 计算Token哈希
   */
  static hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * 计算过期时间
   */
  static calculateExpiry(days = null) {
    if (days === null) {
      days = config.get('auth.tokenExpiryDays') || 30;
    }

    if (days === 0) {
      return null; // 永不过期
    }

    const expiry = new Date();
    expiry.setDate(expiry.getDate() + days);
    return expiry.toISOString();
  }

  /**
   * 检查Token是否过期
   */
  isExpired() {
    if (!this.expiresAt) {
      return false; // 永不过期
    }
    return new Date(this.expiresAt) < new Date();
  }

  /**
   * 检查权限
   */
  hasPermission(permission) {
    return this.permissions.includes(permission);
  }

  /**
   * 转换为安全的JSON对象
   */
  toJSON() {
    return {
      id: this.id,
      tokenName: this.tokenName,
      deviceType: this.deviceType,
      deviceInfo: this.deviceInfo,
      clientInfo: this.clientInfo,
      permissions: this.permissions,
      expiresAt: this.expiresAt,
      lastUsedAt: this.lastUsedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      isActive: this.isActive,
      isExpired: this.isExpired()
    };
  }
}

module.exports = AccessToken;

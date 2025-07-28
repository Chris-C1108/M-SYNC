/**
 * 用户数据模型
 * 处理用户相关的数据库操作
 */

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const config = require('config');
const serviceRegistry = require('../utils/ServiceRegistry');
const logger = require('../utils/logger').components.database;

class User {
  constructor(userData = {}) {
    this.id = userData.id;
    this.username = userData.username;
    this.email = userData.email;
    this.passwordHash = userData.password_hash;
    this.isActive = userData.is_active !== false; // 默认激活
    this.createdAt = userData.created_at;
    this.updatedAt = userData.updated_at;
    this.lastLoginAt = userData.last_login_at;
  }

  /**
   * 获取数据库连接
   */
  static getDatabase() {
    return serviceRegistry.get('database').getDatabase();
  }

  /**
   * 创建新用户
   */
  static async create({ username, email, password }) {
    try {
      logger.info('Creating new user', { username, email });

      // 检查用户名和邮箱唯一性
      await User.validateUniqueness(username, email);

      // 密码加密
      const saltRounds = config.get('auth.bcryptRounds');
      const passwordHash = await bcrypt.hash(password, saltRounds);

      const userData = {
        id: uuidv4(),
        username,
        email,
        password_hash: passwordHash,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // 保存到数据库
      const db = User.getDatabase();
      await db.run(`
        INSERT INTO users (
          id, username, email, password_hash, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        userData.id, userData.username, userData.email, userData.password_hash,
        userData.is_active, userData.created_at, userData.updated_at
      ]);

      logger.info('User created successfully', { 
        userId: userData.id, 
        username: userData.username 
      });

      return new User(userData);

    } catch (error) {
      logger.error('Failed to create user:', error);
      throw error;
    }
  }

  /**
   * 根据用户名或邮箱查找用户
   */
  static async findByUsernameOrEmail(identifier) {
    try {
      const db = User.getDatabase();
      const row = await db.get(`
        SELECT * FROM users 
        WHERE (username = ? OR email = ?) AND is_active = 1
      `, [identifier, identifier]);

      return row ? new User(row) : null;

    } catch (error) {
      logger.error('Failed to find user by identifier:', error);
      throw error;
    }
  }

  /**
   * 根据ID查找用户
   */
  static async findById(userId) {
    try {
      const db = User.getDatabase();
      const row = await db.get(`
        SELECT * FROM users WHERE id = ? AND is_active = 1
      `, [userId]);

      return row ? new User(row) : null;

    } catch (error) {
      logger.error('Failed to find user by ID:', error);
      throw error;
    }
  }



  /**
   * 验证用户名和邮箱唯一性
   */
  static async validateUniqueness(username, email) {
    const db = User.getDatabase();

    // 检查用户名
    const existingUsername = await db.get(
      'SELECT id FROM users WHERE username = ?', [username]
    );
    if (existingUsername) {
      throw new Error(`Username '${username}' already exists`);
    }

    // 检查邮箱
    const existingEmail = await db.get(
      'SELECT id FROM users WHERE email = ?', [email]
    );
    if (existingEmail) {
      throw new Error(`Email '${email}' already exists`);
    }
  }

  /**
   * 验证密码
   */
  async validatePassword(password) {
    try {
      return await bcrypt.compare(password, this.passwordHash);
    } catch (error) {
      logger.error('Password validation failed:', error);
      return false;
    }
  }

  /**
   * 更新最后登录时间
   */
  async updateLastLogin() {
    try {
      const db = User.getDatabase();
      const now = new Date().toISOString();
      
      await db.run(`
        UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?
      `, [now, now, this.id]);

      this.lastLoginAt = now;
      this.updatedAt = now;

      logger.info('Last login updated', { userId: this.id });

    } catch (error) {
      logger.error('Failed to update last login:', error);
      throw error;
    }
  }



  /**
   * 转换为安全的JSON对象（不包含敏感信息）
   */
  toSafeJSON() {
    return {
      id: this.id,
      username: this.username,
      email: this.email,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      lastLoginAt: this.lastLoginAt
    };
  }


}

module.exports = User;

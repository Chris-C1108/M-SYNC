/**
 * 数据库连接管理
 * 支持SQLite和PostgreSQL
 */

const config = require('config');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger').components.database;

class DatabaseConnection {
  constructor() {
    this.database = null;
  }

  async connect() {
    try {
      const dbType = config.get('database.type');
      const connectionString = config.get('database.connectionString');

      logger.info('Connecting to database', {
        type: dbType,
        connectionString: connectionString.replace(/password=[^;]+/gi, 'password=***')
      });

      if (dbType === 'sqlite') {
        this.database = await this.initializeSQLite(connectionString);
      } else if (dbType === 'postgresql') {
        this.database = await this.initializePostgreSQL(connectionString);
      } else {
        throw new Error(`Unsupported database type: ${dbType}`);
      }

      logger.info('Database connected successfully');
      return this.database;

    } catch (error) {
      logger.error('Failed to connect to database:', error);
      throw error;
    }
  }

  getDatabase() {
    if (!this.database) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.database;
  }

  async close() {
    if (this.database) {
      await this.database.close();
      this.database = null;
      logger.info('Database connection closed');
    }
  }
  /**
   * 初始化SQLite连接
   */
  async initializeSQLite(connectionString) {
    const sqlite3 = require('sqlite3').verbose();
    const { open } = require('sqlite');

    // 解析SQLite连接字符串
    const dbPath = connectionString.replace('sqlite:', '');
    const fullPath = path.resolve(dbPath);

    // 确保目录存在
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info('Created database directory', { dir });
    }

    // 打开数据库连接
    const db = await open({
      filename: fullPath,
      driver: sqlite3.Database
    });

    // 启用外键约束
    await db.exec('PRAGMA foreign_keys = ON');

    // 设置WAL模式以提高并发性能
    await db.exec('PRAGMA journal_mode = WAL');

    logger.info('SQLite database connected', { path: fullPath });
    return db;
  }

  /**
   * 初始化PostgreSQL连接
   */
  async initializePostgreSQL(connectionString) {
    const { Pool } = require('pg');

    const pool = new Pool({
      connectionString: connectionString
    });

    // 测试连接
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();

    logger.info('PostgreSQL database connected');
    return pool;
  }
}

module.exports = DatabaseConnection;

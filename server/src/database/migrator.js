/**
 * 数据库迁移管理器
 * 负责执行数据库迁移脚本和版本管理
 */

const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger').components.database;

class DatabaseMigrator {
  constructor(database) {
    this.db = database;
    this.migrationsPath = path.join(__dirname, 'migrations');
  }

  /**
   * 初始化迁移系统
   */
  async initialize() {
    try {
      // 创建迁移记录表
      await this.db.run(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version VARCHAR(255) PRIMARY KEY,
          executed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      logger.info('Migration system initialized');
    } catch (error) {
      logger.error('Failed to initialize migration system:', error);
      throw error;
    }
  }

  /**
   * 获取所有迁移文件
   */
  async getMigrationFiles() {
    try {
      const files = await fs.readdir(this.migrationsPath);
      return files
        .filter(file => file.endsWith('.sql'))
        .sort(); // 按文件名排序确保执行顺序
    } catch (error) {
      logger.error('Failed to read migration files:', error);
      throw error;
    }
  }

  /**
   * 获取已执行的迁移版本
   */
  async getExecutedMigrations() {
    try {
      // 先检查表是否存在
      const tableExists = await this.db.get(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='schema_migrations'
      `);

      if (!tableExists) {
        return [];
      }

      const rows = await this.db.all('SELECT version FROM schema_migrations ORDER BY version');
      return rows.map(row => row.version);
    } catch (error) {
      logger.error('Failed to get executed migrations:', error);
      return [];
    }
  }

  /**
   * 执行单个迁移文件
   */
  async executeMigration(filename) {
    try {
      const filePath = path.join(this.migrationsPath, filename);
      const sql = await fs.readFile(filePath, 'utf8');
      
      // 提取版本号（文件名前缀）
      const version = filename.replace('.sql', '');
      
      logger.info(`Executing migration: ${filename}`);
      
      // 开始事务
      await this.db.run('BEGIN TRANSACTION');
      
      try {
        // 执行迁移SQL
        await this.db.exec(sql);
        
        // 记录迁移版本
        await this.db.run(
          'INSERT INTO schema_migrations (version) VALUES (?)',
          [version]
        );
        
        // 提交事务
        await this.db.run('COMMIT');
        
        logger.info(`Migration completed: ${filename}`);
      } catch (error) {
        // 回滚事务
        await this.db.run('ROLLBACK');
        throw error;
      }
    } catch (error) {
      logger.error(`Failed to execute migration ${filename}:`, error);
      throw error;
    }
  }

  /**
   * 运行所有待执行的迁移
   */
  async runMigrations() {
    try {
      await this.initialize();
      
      const migrationFiles = await this.getMigrationFiles();
      const executedMigrations = await this.getExecutedMigrations();
      
      const pendingMigrations = migrationFiles.filter(
        file => !executedMigrations.includes(file.replace('.sql', ''))
      );
      
      if (pendingMigrations.length === 0) {
        logger.info('No pending migrations');
        return;
      }
      
      logger.info(`Found ${pendingMigrations.length} pending migrations`);
      
      for (const migration of pendingMigrations) {
        await this.executeMigration(migration);
      }
      
      logger.info('All migrations completed successfully');
    } catch (error) {
      logger.error('Migration failed:', error);
      throw error;
    }
  }

  /**
   * 获取当前数据库版本
   */
  async getCurrentVersion() {
    try {
      // 先检查表是否存在
      const tableExists = await this.db.get(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='schema_migrations'
      `);

      if (!tableExists) {
        return null;
      }

      const result = await this.db.get(`
        SELECT version FROM schema_migrations
        ORDER BY version DESC
        LIMIT 1
      `);

      return result ? result.version : null;
    } catch (error) {
      logger.error('Failed to get current version:', error);
      return null;
    }
  }

  /**
   * 检查数据库状态
   */
  async checkDatabaseStatus() {
    try {
      const currentVersion = await this.getCurrentVersion();
      const migrationFiles = await this.getMigrationFiles();
      const executedMigrations = await this.getExecutedMigrations();
      
      const pendingMigrations = migrationFiles.filter(
        file => !executedMigrations.includes(file.replace('.sql', ''))
      );
      
      return {
        currentVersion,
        totalMigrations: migrationFiles.length,
        executedMigrations: executedMigrations.length,
        pendingMigrations: pendingMigrations.length,
        isUpToDate: pendingMigrations.length === 0
      };
    } catch (error) {
      logger.error('Failed to check database status:', error);
      throw error;
    }
  }

  /**
   * 验证数据库表结构
   */
  async validateSchema() {
    try {
      const requiredTables = ['users', 'access_tokens', 'messages'];
      const existingTables = [];
      
      for (const table of requiredTables) {
        const result = await this.db.get(`
          SELECT name FROM sqlite_master 
          WHERE type='table' AND name=?
        `, [table]);
        
        if (result) {
          existingTables.push(table);
        }
      }
      
      const missingTables = requiredTables.filter(
        table => !existingTables.includes(table)
      );
      
      if (missingTables.length > 0) {
        logger.warn('Missing tables:', missingTables);
        return false;
      }
      
      logger.info('Database schema validation passed');
      return true;
    } catch (error) {
      logger.error('Schema validation failed:', error);
      return false;
    }
  }
}

module.exports = DatabaseMigrator;

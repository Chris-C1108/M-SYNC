#!/usr/bin/env node

/**
 * 数据库初始化脚本
 * 运行数据库迁移并验证表结构
 */

const path = require('path');
const config = require('config');

// 设置项目根目录
process.chdir(path.join(__dirname, '..'));

const DatabaseConnection = require('../src/database/connection');
const DatabaseMigrator = require('../src/database/migrator');
const logger = require('../src/utils/logger').components.database;

async function initializeDatabase() {
  let connection = null;
  
  try {
    logger.info('Starting database initialization...');
    
    // 1. 建立数据库连接
    connection = new DatabaseConnection();
    await connection.connect();
    
    const db = connection.getDatabase();
    logger.info('Database connection established');
    
    // 2. 创建迁移器实例
    const migrator = new DatabaseMigrator(db);
    
    // 3. 检查当前数据库状态
    logger.info('Checking database status...');
    const status = await migrator.checkDatabaseStatus();
    
    console.log('\n=== Database Status ===');
    console.log(`Current Version: ${status.currentVersion || 'None'}`);
    console.log(`Total Migrations: ${status.totalMigrations}`);
    console.log(`Executed Migrations: ${status.executedMigrations}`);
    console.log(`Pending Migrations: ${status.pendingMigrations}`);
    console.log(`Up to Date: ${status.isUpToDate ? 'Yes' : 'No'}`);
    console.log('========================\n');
    
    // 4. 运行待执行的迁移
    if (!status.isUpToDate) {
      logger.info('Running pending migrations...');
      await migrator.runMigrations();
      logger.info('Migrations completed successfully');
    } else {
      logger.info('Database is up to date');
    }
    
    // 5. 验证数据库表结构
    logger.info('Validating database schema...');
    const isValid = await migrator.validateSchema();
    
    if (!isValid) {
      throw new Error('Database schema validation failed');
    }
    
    // 6. 显示最终状态
    const finalStatus = await migrator.checkDatabaseStatus();
    
    console.log('\n=== Final Database Status ===');
    console.log(`Current Version: ${finalStatus.currentVersion}`);
    console.log(`Total Migrations: ${finalStatus.totalMigrations}`);
    console.log(`Executed Migrations: ${finalStatus.executedMigrations}`);
    console.log(`Database Ready: ${finalStatus.isUpToDate ? 'Yes' : 'No'}`);
    console.log('==============================\n');
    
    logger.info('Database initialization completed successfully');
    
  } catch (error) {
    logger.error('Database initialization failed:', error);
    process.exit(1);
  } finally {
    // 关闭数据库连接
    if (connection) {
      await connection.close();
      logger.info('Database connection closed');
    }
  }
}

// 处理未捕获的异常
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// 运行初始化
if (require.main === module) {
  initializeDatabase();
}

module.exports = initializeDatabase;

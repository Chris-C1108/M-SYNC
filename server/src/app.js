/**
 * M-SYNC Message Broker Service
 * 主应用入口文件
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const config = require('config');

const logger = require('./utils/logger');
const routes = require('./routes');
const DatabaseConnection = require('./database/connection');
const WebSocketService = require('./services/WebSocketService');
const MessageBrokerService = require('./services/MessageBrokerService');
const serviceRegistry = require('./utils/ServiceRegistry');
const errorHandler = require('./middleware/errorHandler');

class MessageBrokerApp {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.dbConnection = null;
    this.webSocketService = null;
    this.messageBrokerService = null;
  }

  async initialize() {
    try {
      // 初始化数据库连接
      this.dbConnection = new DatabaseConnection();
      await this.dbConnection.connect();
      logger.info('Database connected successfully');

      // 初始化服务
      this.setupServices();

      // 配置中间件
      this.setupMiddleware();

      // 配置路由
      this.setupRoutes();

      // 初始化WebSocket服务
      this.setupWebSocket();

      // 错误处理
      this.setupErrorHandling();

      logger.info('Application initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize application:', error);
      throw error;
    }
  }

  /**
   * 初始化服务
   */
  setupServices() {
    // 初始化WebSocket服务
    this.webSocketService = new WebSocketService();

    // 初始化消息代理服务
    this.messageBrokerService = new MessageBrokerService(this.webSocketService);

    // 注册服务到全局注册表
    serviceRegistry.register('database', this.dbConnection);
    serviceRegistry.register('webSocket', this.webSocketService);
    serviceRegistry.register('messageBroker', this.messageBrokerService);

    logger.info('Services initialized and registered successfully');
  }

  setupMiddleware() {
    // 安全中间件
    this.app.use(helmet());

    // CORS配置
    this.app.use(cors(config.get('security.cors')));

    // 请求解析
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // 静态文件服务
    this.app.use(express.static(path.join(__dirname, '../public')));

    // 请求日志
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });
  }

  setupRoutes() {
    // API路由
    this.app.use('/api', routes);

    // 健康检查
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0'
      });
    });

    // 根路径
    this.app.get('/', (req, res) => {
      res.json({
        name: config.get('server.name'),
        version: process.env.npm_package_version || '1.0.0',
        status: 'running'
      });
    });
  }

  setupWebSocket() {
    try {
      this.webSocketService.initialize(this.server);
      logger.info('WebSocket service initialized');
    } catch (error) {
      logger.error('Failed to initialize WebSocket service:', error);
      throw error;
    }
  }

  setupErrorHandling() {
    // 404处理
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.originalUrl} not found`
      });
    });

    // 全局错误处理
    this.app.use(errorHandler);

    // 未捕获异常处理
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });
  }

  async start() {
    const port = config.get('server.port');
    const host = config.get('server.host');

    return new Promise((resolve, reject) => {
      this.server.listen(port, host, (error) => {
        if (error) {
          logger.error('Failed to start server:', error);
          reject(error);
        } else {
          logger.info(`Server started on ${host}:${port}`);
          resolve();
        }
      });
    });
  }

  async stop() {
    try {
      // 关闭WebSocket服务
      if (this.webSocketService) {
        await this.webSocketService.close();
      }

      // 关闭数据库连接
      if (this.dbConnection) {
        await this.dbConnection.close();
      }

      // 关闭HTTP服务器
      return new Promise((resolve) => {
        this.server.close(() => {
          logger.info('Server stopped');
          resolve();
        });
      });
    } catch (error) {
      logger.error('Error during server shutdown:', error);
      throw error;
    }
  }
}

// 启动应用
async function main() {
  console.log('Starting M-SYNC Message Broker Service...');
  const app = new MessageBrokerApp();

  try {
    console.log('Initializing application...');
    await app.initialize();
    console.log('Starting server...');
    await app.start();

    // 优雅关闭
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      await app.stop();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully');
      await app.stop();
      process.exit(0);
    });

  } catch (error) {
    console.error('Failed to start application:', error);
    logger.error('Failed to start application:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = MessageBrokerApp;

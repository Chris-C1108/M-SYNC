/**
 * 消息订阅客户端
 * 负责与消息代理服务建立连接并处理消息
 */

const EventEmitter = require('events');
const WebSocketConnectionManager = require('./WebSocketConnectionManager');
const MessageHandlerRegistry = require('../handlers/MessageHandlerRegistry');
const ConfigManager = require('./ConfigManager');
const TokenManager = require('../services/TokenManager');
const logger = require('../utils/logger').createLogger('MessageSubscriberClient');

class MessageSubscriberClient extends EventEmitter {
  constructor(config) {
    super();

    this.config = config;
    this.configManager = new ConfigManager();
    this.tokenManager = new TokenManager(this.configManager);
    this.connectionManager = null;
    this.messageHandlers = null;
    this.isRunning = false;
    this.messageQueue = [];
    this.processingMessage = false;

    // Token管理相关
    this.currentToken = null;
    this.tokenCheckInterval = null;
    this.tokenCheckIntervalMs = 5 * 60 * 1000; // 5分钟检查一次
    this.lastTokenCheck = null;

    // 重连管理
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 5000;
    this.isReconnecting = false;
  }

  async start() {
    try {
      logger.info('Starting message subscriber client');

      // 初始化Token管理器
      await this.tokenManager.initialize();

      // 获取有效的访问Token
      logger.info('Checking authentication token...');
      const token = await this.ensureValidToken();

      if (!token) {
        throw new Error('Failed to obtain valid authentication token');
      }

      // 初始化消息处理器注册表
      this.messageHandlers = new MessageHandlerRegistry(this.config);
      await this.messageHandlers.initialize();

      // 初始化WebSocket连接管理器
      this.connectionManager = new WebSocketConnectionManager(this.configManager);
      this.setupConnectionEvents();

      // 建立连接
      await this.connectWithRetry();

      // 启动Token定期检查
      this.startTokenMonitoring();

      this.isRunning = true;
      logger.info('Message subscriber client started successfully');

    } catch (error) {
      logger.error('Failed to start message subscriber client:', error);
      throw error;
    }
  }

  async stop() {
    try {
      logger.info('Stopping message subscriber client');

      this.isRunning = false;
      this.isReconnecting = false;

      // 停止Token监控
      this.stopTokenMonitoring();

      // 停止连接管理器
      if (this.connectionManager) {
        await this.connectionManager.disconnect();
      }

      // 清理消息处理器
      if (this.messageHandlers) {
        await this.messageHandlers.cleanup();
      }

      // 清空消息队列
      this.messageQueue = [];

      // 重置状态
      this.currentToken = null;
      this.reconnectAttempts = 0;

      logger.info('Message subscriber client stopped successfully');

    } catch (error) {
      logger.error('Error stopping message subscriber client:', error);
      throw error;
    }
  }

  setupConnectionEvents() {
    // 连接建立事件
    this.connectionManager.on('connected', () => {
      logger.info('WebSocket connection established');
      this.emit('connected');
    });

    // 连接断开事件
    this.connectionManager.on('disconnected', () => {
      logger.warn('WebSocket connection lost');
      this.emit('disconnected');

      // 如果客户端仍在运行，尝试重连
      if (this.isRunning && !this.isReconnecting) {
        this.handleConnectionLoss();
      }
    });

    // 重连事件
    this.connectionManager.on('reconnecting', (attempt) => {
      logger.info(`Attempting to reconnect (${attempt})`);
      this.emit('reconnecting', attempt);
    });

    // 消息接收事件
    this.connectionManager.on('message', (message) => {
      this.handleIncomingMessage(message);
    });

    // 认证错误事件
    this.connectionManager.on('authError', async (error) => {
      logger.error('Authentication error:', error);
      await this.handleAuthenticationError(error);
    });

    // 错误事件
    this.connectionManager.on('error', (error) => {
      logger.error('WebSocket connection error:', error);
      this.emit('error', error);
    });
  }

  async handleIncomingMessage(rawMessage) {
    try {
      logger.debug('Received raw message', { 
        messageLength: rawMessage.length 
      });

      // 解析消息
      const message = this.parseMessage(rawMessage);
      if (!message) {
        return;
      }

      // 验证消息
      if (!this.validateMessage(message)) {
        return;
      }

      // 添加到消息队列
      this.messageQueue.push(message);
      
      // 处理消息队列
      await this.processMessageQueue();

      // 发出消息事件
      this.emit('message', message);

    } catch (error) {
      logger.error('Error handling incoming message:', error);
      this.emit('error', error);
    }
  }

  parseMessage(rawMessage) {
    try {
      const message = JSON.parse(rawMessage);
      
      // 检查消息类型
      if (message.type === 'pong') {
        logger.debug('Received pong message');
        return null;
      }

      if (message.type !== 'message') {
        logger.debug('Received non-message type:', message.type);
        return null;
      }

      return message.data;

    } catch (error) {
      logger.error('Failed to parse message:', error);
      return null;
    }
  }

  validateMessage(message) {
    // 检查必要字段
    if (!message.messageId || !message.messageType || !message.content) {
      logger.warn('Invalid message format:', message);
      return false;
    }

    // 检查消息类型
    const supportedTypes = ['TEXT', 'URL', 'CODE'];
    if (!supportedTypes.includes(message.messageType)) {
      logger.warn('Unsupported message type:', message.messageType);
      return false;
    }

    // 检查消息大小
    const maxSize = this.config.get('security.maxMessageSize');
    if (message.content.length > maxSize) {
      logger.warn('Message too large:', {
        messageId: message.messageId,
        size: message.content.length,
        maxSize
      });
      return false;
    }

    return true;
  }

  async processMessageQueue() {
    if (this.processingMessage || this.messageQueue.length === 0) {
      return;
    }

    this.processingMessage = true;

    try {
      const maxConcurrent = this.config.get('performance.maxConcurrentHandlers');
      const batch = this.messageQueue.splice(0, maxConcurrent);

      const promises = batch.map(message => this.processMessage(message));
      await Promise.allSettled(promises);

    } catch (error) {
      logger.error('Error processing message queue:', error);
    } finally {
      this.processingMessage = false;

      // 如果还有消息，继续处理
      if (this.messageQueue.length > 0) {
        setImmediate(() => this.processMessageQueue());
      }
    }
  }

  async processMessage(message) {
    try {
      logger.info('Processing message', {
        messageId: message.messageId,
        messageType: message.messageType,
        contentLength: message.content.length
      });

      // 获取消息处理器
      const handler = this.messageHandlers.getHandler(message.messageType);
      if (!handler) {
        logger.warn('No handler found for message type:', message.messageType);
        return;
      }

      // 处理消息
      await handler.process(message);

      logger.info('Message processed successfully', {
        messageId: message.messageId,
        messageType: message.messageType
      });

    } catch (error) {
      logger.error('Error processing message:', {
        messageId: message.messageId,
        error: error.message
      });
    }
  }

  // 获取客户端状态
  getStatus() {
    return {
      isRunning: this.isRunning,
      isConnected: this.connectionManager?.isConnected() || false,
      messageQueueLength: this.messageQueue.length,
      processingMessage: this.processingMessage
    };
  }

  // 获取统计信息
  getStats() {
    return {
      ...this.getStatus(),
      connectionStats: this.connectionManager?.getStats() || {},
      handlerStats: this.messageHandlers?.getStats() || {}
    };
  }

  // 发送消息 (用于托盘功能)
  async sendMessage(messageData) {
    try {
      if (!this.connectionManager || !this.connectionManager.isConnected()) {
        throw new Error('Not connected to message broker service');
      }

      const message = {
        type: 'publish',
        data: {
          messageType: messageData.messageType || 'TEXT',
          content: messageData.content,
          timestamp: new Date().toISOString()
        }
      };

      await this.connectionManager.send(message);
      logger.info('Message sent successfully', {
        messageType: message.data.messageType,
        contentLength: message.data.content.length
      });

      return true;
    } catch (error) {
      logger.error('Failed to send message:', error);
      throw error;
    }
  }

  // 获取最新消息 (用于托盘功能)
  async getLatestMessages(limit = 10) {
    try {
      if (!this.connectionManager || !this.connectionManager.isConnected()) {
        throw new Error('Not connected to message broker service');
      }

      const message = {
        type: 'getHistory',
        data: {
          page: 1,
          limit: limit
        }
      };

      const response = await this.connectionManager.sendAndWaitForResponse(message);

      if (response && response.data && response.data.messages) {
        return response.data.messages;
      }

      return [];
    } catch (error) {
      logger.error('Failed to get latest messages:', error);
      throw error;
    }
  }

  // 获取当前Token信息 (用于托盘功能)
  async getCurrentTokenInfo() {
    try {
      if (!this.connectionManager || !this.connectionManager.isConnected()) {
        throw new Error('Not connected to message broker service');
      }

      const message = {
        type: 'getTokenInfo',
        data: {}
      };

      const response = await this.connectionManager.sendAndWaitForResponse(message);

      if (response && response.data) {
        return response.data;
      }

      return null;
    } catch (error) {
      logger.error('Failed to get token info:', error);
      throw error;
    }
  }

  // ========== 新增的Token管理和重连方法 ==========

  /**
   * 确保获取有效Token
   */
  async ensureValidToken() {
    try {
      // 首先尝试获取现有Token
      let token = await this.tokenManager.getValidToken();

      if (token) {
        this.currentToken = token;
        this.configManager.set('brokerService.authToken', token);
        this.lastTokenCheck = Date.now();
        logger.info('Valid token obtained successfully');
        return token;
      }

      // 如果没有有效Token，强制重新认证
      logger.warn('No valid token found, forcing re-authentication');
      token = await this.tokenManager.forceReauthentication();

      if (token) {
        this.currentToken = token;
        this.configManager.set('brokerService.authToken', token);
        this.lastTokenCheck = Date.now();
        logger.info('Token re-authentication successful');
        return token;
      }

      throw new Error('Failed to obtain valid token after re-authentication');
    } catch (error) {
      logger.error('Failed to ensure valid token:', error);
      throw error;
    }
  }

  /**
   * 启动Token监控
   */
  startTokenMonitoring() {
    if (this.tokenCheckInterval) {
      clearInterval(this.tokenCheckInterval);
    }

    this.tokenCheckInterval = setInterval(async () => {
      try {
        await this.checkTokenExpiration();
      } catch (error) {
        logger.error('Token check failed:', error);
      }
    }, this.tokenCheckIntervalMs);

    logger.info('Token monitoring started', {
      intervalMs: this.tokenCheckIntervalMs
    });
  }

  /**
   * 停止Token监控
   */
  stopTokenMonitoring() {
    if (this.tokenCheckInterval) {
      clearInterval(this.tokenCheckInterval);
      this.tokenCheckInterval = null;
      logger.info('Token monitoring stopped');
    }
  }

  /**
   * 检查Token过期
   */
  async checkTokenExpiration() {
    try {
      if (!this.isRunning || !this.currentToken) {
        return;
      }

      // 检查Token是否即将过期（提前30分钟刷新）
      const tokenInfo = await this.tokenManager.getTokenInfo();
      if (!tokenInfo || !tokenInfo.expiresAt) {
        logger.warn('Token info not available, skipping expiration check');
        return;
      }

      const expiresAt = new Date(tokenInfo.expiresAt);
      const now = new Date();
      const timeUntilExpiry = expiresAt.getTime() - now.getTime();
      const thirtyMinutes = 30 * 60 * 1000;

      if (timeUntilExpiry <= thirtyMinutes) {
        logger.info('Token expiring soon, refreshing...', {
          expiresAt: expiresAt.toISOString(),
          timeUntilExpiry: Math.round(timeUntilExpiry / 1000 / 60) + ' minutes'
        });

        await this.refreshToken();
      }

      this.lastTokenCheck = Date.now();
    } catch (error) {
      logger.error('Token expiration check failed:', error);
    }
  }

  /**
   * 刷新Token
   */
  async refreshToken() {
    try {
      logger.info('Refreshing authentication token...');

      const newToken = await this.tokenManager.getValidToken();
      if (!newToken) {
        throw new Error('Failed to refresh token');
      }

      // 更新当前Token
      this.currentToken = newToken;
      this.configManager.set('brokerService.authToken', newToken);

      // 如果连接存在，重新认证
      if (this.connectionManager && this.connectionManager.isConnected()) {
        await this.connectionManager.authenticate(newToken);
        logger.info('Token refreshed and re-authenticated successfully');
      } else {
        logger.info('Token refreshed, will be used on next connection');
      }

      this.emit('tokenRefreshed', newToken);
    } catch (error) {
      logger.error('Token refresh failed:', error);
      throw error;
    }
  }

  /**
   * 带重试的连接方法
   */
  async connectWithRetry() {
    let lastError = null;

    for (let attempt = 1; attempt <= this.maxReconnectAttempts; attempt++) {
      try {
        logger.info(`Connection attempt ${attempt}/${this.maxReconnectAttempts}`);

        await this.connectionManager.connect();
        this.reconnectAttempts = 0;
        logger.info('Connection established successfully');
        return;

      } catch (error) {
        lastError = error;
        logger.warn(`Connection attempt ${attempt} failed:`, error.message);

        if (attempt < this.maxReconnectAttempts) {
          const delay = this.reconnectDelay * Math.pow(2, attempt - 1); // 指数退避
          logger.info(`Waiting ${delay}ms before next attempt...`);
          await this.sleep(delay);
        }
      }
    }

    throw new Error(`Failed to connect after ${this.maxReconnectAttempts} attempts. Last error: ${lastError?.message}`);
  }

  /**
   * 处理连接丢失
   */
  async handleConnectionLoss() {
    if (this.isReconnecting || !this.isRunning) {
      return;
    }

    this.isReconnecting = true;
    logger.info('Handling connection loss, starting reconnection process...');

    try {
      // 首先检查Token是否仍然有效
      const tokenValid = await this.tokenManager.validateToken(this.currentToken);

      if (!tokenValid) {
        logger.info('Current token is invalid, refreshing before reconnection...');
        await this.refreshToken();
      }

      // 尝试重新连接
      await this.connectWithRetry();

      logger.info('Reconnection successful');
      this.emit('reconnected');

    } catch (error) {
      logger.error('Reconnection failed:', error);
      this.emit('reconnectionFailed', error);
    } finally {
      this.isReconnecting = false;
    }
  }

  /**
   * 处理认证错误
   */
  async handleAuthenticationError(error) {
    try {
      logger.info('Handling authentication error, attempting token refresh...');

      // 清除当前Token
      this.currentToken = null;

      // 尝试获取新Token
      const newToken = await this.ensureValidToken();

      if (newToken) {
        logger.info('New token obtained, attempting to reconnect...');

        // 重新连接
        if (this.connectionManager) {
          await this.connectionManager.reconnect();
        }

        logger.info('Authentication error resolved successfully');
        this.emit('authenticationRecovered');
      } else {
        logger.error('Failed to obtain new token');
        this.emit('authenticationFailed', error);
      }

    } catch (refreshError) {
      logger.error('Authentication error handling failed:', refreshError);
      this.emit('authenticationFailed', refreshError);
    }
  }

  /**
   * 工具方法：睡眠
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = MessageSubscriberClient;

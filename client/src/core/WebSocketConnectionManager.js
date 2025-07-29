/**
 * WebSocket连接管理器
 * 负责管理与消息代理服务的WebSocket连接
 */

const EventEmitter = require('events');
const WebSocket = require('ws');
const logger = require('../utils/logger').createLogger('WebSocketConnectionManager');

class WebSocketConnectionManager extends EventEmitter {
  constructor(config) {
    super();

    this.config = config;
    this.ws = null;
    this._isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = config.get('brokerService.maxReconnectAttempts') || 10;
    this.reconnectInterval = config.get('brokerService.reconnectInterval') || 5000;
    this.heartbeatInterval = config.get('brokerService.heartbeatInterval') || 30000;
    this.heartbeatTimer = null;
    this.responseHandlers = new Map();
    this.messageId = 0;
  }

  async connect(authToken = null) {
    try {
      const wsEndpoint = this.config.get('brokerService.wsEndpoint');

      // 优先使用传入的Token，否则从配置获取
      const token = authToken || this.config.get('brokerService.authToken');

      if (!token) {
        throw new Error('No authentication token available');
      }

      // 在URL中包含Token进行认证
      const wsUrl = `${wsEndpoint}?token=${encodeURIComponent(token)}`;

      logger.info('Connecting to WebSocket endpoint', { endpoint: wsEndpoint });

      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => {
        logger.info('WebSocket connection established');
        this._isConnected = true;
        this.reconnectAttempts = 0;

        // 启动心跳
        this.startHeartbeat();

        this.emit('connected');
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error) {
          logger.error('Failed to parse WebSocket message:', {
            error: error.message,
            rawData: data.toString(),
            dataLength: data.length
          });
        }
      });

      this.ws.on('close', (code, reason) => {
        logger.warn('WebSocket connection closed', { code, reason: reason.toString() });
        this._isConnected = false;
        this.stopHeartbeat();
        this.emit('disconnected');

        // 尝试重连
        this.scheduleReconnect();
      });

      this.ws.on('error', (error) => {
        logger.error('WebSocket error:', error);
        this.emit('error', error);
      });

    } catch (error) {
      logger.error('Failed to connect to WebSocket:', error);
      throw error;
    }
  }

  async authenticate(token) {
    // 认证现在在连接时通过URL参数完成
    // 这个方法保留用于兼容性，但不再发送认证消息
    logger.info('Authentication completed during connection');
  }

  handleMessage(message) {
    logger.debug('Received WebSocket message', { type: message.type });

    // 处理响应消息
    if (message.id && this.responseHandlers.has(message.id)) {
      const handler = this.responseHandlers.get(message.id);
      this.responseHandlers.delete(message.id);
      handler.resolve(message);
      return;
    }

    // 处理不同类型的消息
    switch (message.type) {
      case 'connection_established':
        logger.info('Connection established confirmation received');
        this.emit('authenticated');
        break;

      case 'message':
        this.emit('message', message.data);
        break;

      case 'pong':
        logger.debug('Received pong');
        break;

      case 'error':
        logger.error('Server error:', message.data);
        this.emit('error', new Error(message.data.message || 'Server error'));
        break;

      default:
        logger.warn('Unknown message type:', message.type);
    }
  }

  async send(message) {
    return new Promise((resolve, reject) => {
      if (!this._isConnected || !this.ws) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      try {
        const messageStr = JSON.stringify(message);
        this.ws.send(messageStr, (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async sendAndWaitForResponse(message, timeout = 10000) {
    return new Promise((resolve, reject) => {
      if (!this._isConnected || !this.ws) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      // 生成消息ID
      const messageId = ++this.messageId;
      message.id = messageId;

      // 设置响应处理器
      const timeoutId = setTimeout(() => {
        this.responseHandlers.delete(messageId);
        reject(new Error('Request timeout'));
      }, timeout);

      this.responseHandlers.set(messageId, {
        resolve: (response) => {
          clearTimeout(timeoutId);
          resolve(response);
        },
        reject: (error) => {
          clearTimeout(timeoutId);
          reject(error);
        }
      });

      // 发送消息
      this.send(message).catch((error) => {
        this.responseHandlers.delete(messageId);
        clearTimeout(timeoutId);
        reject(error);
      });
    });
  }

  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      if (this._isConnected && this.ws) {
        this.send({ type: 'ping' }).catch((error) => {
          logger.error('Failed to send heartbeat:', error);
        });
      }
    }, this.heartbeatInterval);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnect attempts reached, giving up');
      this.emit('maxReconnectAttemptsReached');
      return;
    }

    this.reconnectAttempts++;
    logger.info(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${this.reconnectInterval}ms`);
    
    setTimeout(() => {
      this.emit('reconnecting', this.reconnectAttempts);
      this.connect().catch((error) => {
        logger.error('Reconnect attempt failed:', error);
      });
    }, this.reconnectInterval);
  }

  async disconnect() {
    try {
      this.stopHeartbeat();
      
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }

      this._isConnected = false;
      logger.info('WebSocket disconnected');
    } catch (error) {
      logger.error('Error during disconnect:', error);
    }
  }

  isConnected() {
    return this._isConnected && this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  getStats() {
    return {
      isConnected: this._isConnected,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      pendingResponses: this.responseHandlers.size
    };
  }
}

module.exports = WebSocketConnectionManager;

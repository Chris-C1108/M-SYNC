/**
 * WebSocket服务管理器
 * 处理WebSocket连接、认证、消息广播等功能
 */

const WebSocket = require('ws');
const url = require('url');
const AuthenticationService = require('./AuthenticationService');
const logger = require('../utils/logger').components.websocket;

class WebSocketService {
  constructor() {
    this.wss = null;
    this.connections = new Map(); // userId -> Set of connections
    this.authService = new AuthenticationService();
    this.heartbeatInterval = 30000; // 30秒心跳间隔
    this.connectionTimeout = 60000; // 60秒连接超时
  }

  /**
   * 初始化WebSocket服务器
   */
  initialize(server) {
    try {
      this.wss = new WebSocket.Server({
        server,
        path: '/ws/subscribe',
        verifyClient: this.verifyClient.bind(this)
      });

      this.wss.on('connection', this.handleConnection.bind(this));
      this.wss.on('error', this.handleServerError.bind(this));

      // 启动心跳检测
      this.startHeartbeat();

      logger.info('WebSocket server initialized', {
        path: '/ws/subscribe',
        heartbeatInterval: this.heartbeatInterval
      });

    } catch (error) {
      logger.error('Failed to initialize WebSocket server:', error);
      throw error;
    }
  }

  /**
   * 验证客户端连接
   */
  async verifyClient(info) {
    try {
      console.log('🔍 DEBUG: verifyClient called');
      console.log('🔍 DEBUG: URL:', info.req.url);

      const query = url.parse(info.req.url, true).query;
      const authHeader = info.req.headers.authorization;

      console.log('🔍 DEBUG: query:', query);
      console.log('🔍 DEBUG: authHeader:', authHeader);

      let token = null;

      // 1. 尝试从Authorization头获取token
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }

      // 2. 尝试从查询参数获取token
      if (!token && query.token) {
        token = query.token;
      }

      if (!token) {
        logger.warn('WebSocket connection rejected: No token provided', {
          origin: info.origin,
          userAgent: info.req.headers['user-agent']
        });
        return false;
      }

      // 验证token
      const { user, accessToken } = await this.authService.verifyToken(token);

      // 将用户信息附加到请求对象
      info.req.user = user;
      info.req.accessToken = accessToken;

      logger.info('WebSocket connection authorized', {
        userId: user.id,
        username: user.username,
        tokenId: accessToken.id,
        deviceType: accessToken.deviceType
      });

      return true;

    } catch (error) {
      logger.warn('WebSocket connection rejected: Token verification failed', {
        error: error.message,
        origin: info.origin
      });
      return false;
    }
  }

  /**
   * 处理新的WebSocket连接
   */
  handleConnection(ws, req) {
    try {
      console.log('🔍 DEBUG: handleConnection called');
      console.log('🔍 DEBUG: req.user:', req.user);
      console.log('🔍 DEBUG: req.accessToken:', req.accessToken);

      const user = req.user;
      const accessToken = req.accessToken;

      if (!user || !accessToken) {
        throw new Error(`Missing user or accessToken: user=${!!user}, accessToken=${!!accessToken}`);
      }

      // 设置连接属性
      ws.userId = user.id;
      ws.username = user.username;
      ws.tokenId = accessToken.id;
      ws.deviceType = accessToken.deviceType;
      ws.connectedAt = new Date();
      ws.lastPong = Date.now();
      ws.isAlive = true;

      // 添加到连接池
      this.addConnection(user.id, ws);

      // 设置事件监听器
      ws.on('message', (data) => this.handleMessage(ws, data));
      ws.on('close', (code, reason) => this.handleDisconnection(ws, code, reason));
      ws.on('error', (error) => this.handleConnectionError(ws, error));
      ws.on('pong', () => this.handlePong(ws));

      // 发送连接确认消息
      this.sendMessage(ws, {
        type: 'connection_established',
        data: {
          userId: user.id,
          username: user.username,
          deviceType: accessToken.deviceType,
          connectedAt: ws.connectedAt.toISOString()
        }
      });

      logger.info('WebSocket connection established', {
        userId: user.id,
        username: user.username,
        tokenId: accessToken.id,
        deviceType: accessToken.deviceType,
        totalConnections: this.getTotalConnections()
      });

    } catch (error) {
      logger.error('Failed to handle WebSocket connection:', error);
      ws.close(1011, 'Internal server error');
    }
  }

  /**
   * 处理WebSocket消息
   */
  handleMessage(ws, data) {
    try {
      const message = JSON.parse(data);

      logger.debug('WebSocket message received', {
        userId: ws.userId,
        type: message.type,
        messageId: message.id
      });

      switch (message.type) {
        case 'ping':
          this.handlePing(ws, message);
          break;
        case 'subscribe':
          this.handleSubscribe(ws, message);
          break;
        case 'unsubscribe':
          this.handleUnsubscribe(ws, message);
          break;
        default:
          logger.warn('Unknown message type received', {
            userId: ws.userId,
            type: message.type
          });
          this.sendError(ws, 'Unknown message type', message.id);
      }

    } catch (error) {
      logger.error('Failed to handle WebSocket message:', {
        userId: ws.userId,
        error: error.message
      });
      this.sendError(ws, 'Invalid message format');
    }
  }

  /**
   * 处理ping消息
   */
  handlePing(ws, message) {
    this.sendMessage(ws, {
      type: 'pong',
      id: message.id,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 处理pong响应
   */
  handlePong(ws) {
    ws.lastPong = Date.now();
    ws.isAlive = true;
  }

  /**
   * 处理订阅请求
   */
  handleSubscribe(ws, message) {
    // 目前所有连接都自动订阅用户的消息
    this.sendMessage(ws, {
      type: 'subscribed',
      id: message.id,
      data: {
        userId: ws.userId,
        subscriptions: ['messages']
      }
    });
  }

  /**
   * 处理取消订阅请求
   */
  handleUnsubscribe(ws, message) {
    this.sendMessage(ws, {
      type: 'unsubscribed',
      id: message.id,
      data: {
        userId: ws.userId
      }
    });
  }

  /**
   * 处理连接断开
   */
  handleDisconnection(ws, code, reason) {
    this.removeConnection(ws.userId, ws);

    logger.info('WebSocket connection closed', {
      userId: ws.userId,
      username: ws.username,
      code,
      reason: reason.toString(),
      duration: Date.now() - ws.connectedAt.getTime(),
      totalConnections: this.getTotalConnections()
    });
  }

  /**
   * 处理连接错误
   */
  handleConnectionError(ws, error) {
    logger.error('WebSocket connection error:', {
      userId: ws.userId,
      username: ws.username,
      error: error.message
    });
  }

  /**
   * 处理服务器错误
   */
  handleServerError(error) {
    logger.error('WebSocket server error:', error);
  }

  /**
   * 添加连接到连接池
   */
  addConnection(userId, ws) {
    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set());
    }
    this.connections.get(userId).add(ws);
  }

  /**
   * 从连接池移除连接
   */
  removeConnection(userId, ws) {
    if (this.connections.has(userId)) {
      this.connections.get(userId).delete(ws);
      
      // 如果用户没有其他连接，删除用户记录
      if (this.connections.get(userId).size === 0) {
        this.connections.delete(userId);
      }
    }
  }

  /**
   * 发送消息到指定连接
   */
  sendMessage(ws, message) {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Failed to send WebSocket message:', {
        userId: ws.userId,
        error: error.message
      });
      return false;
    }
  }

  /**
   * 发送错误消息
   */
  sendError(ws, errorMessage, messageId = null) {
    this.sendMessage(ws, {
      type: 'error',
      id: messageId,
      error: errorMessage,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 广播消息到用户的所有连接
   */
  broadcastToUser(userId, message) {
    const userConnections = this.connections.get(userId);
    if (!userConnections) {
      return 0;
    }

    let sentCount = 0;
    for (const ws of userConnections) {
      if (this.sendMessage(ws, message)) {
        sentCount++;
      }
    }

    logger.debug('Message broadcasted to user', {
      userId,
      sentCount,
      totalConnections: userConnections.size
    });

    return sentCount;
  }

  /**
   * 启动心跳检测
   */
  startHeartbeat() {
    setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (!ws.isAlive) {
          logger.warn('WebSocket connection timeout, terminating', {
            userId: ws.userId,
            username: ws.username
          });
          return ws.terminate();
        }

        ws.isAlive = false;
        ws.ping();
      });
    }, this.heartbeatInterval);

    logger.info('WebSocket heartbeat started', {
      interval: this.heartbeatInterval
    });
  }

  /**
   * 获取连接统计信息
   */
  getConnectionStats() {
    const totalConnections = this.getTotalConnections();
    const totalUsers = this.connections.size;
    
    const deviceTypes = {};
    this.wss.clients.forEach((ws) => {
      deviceTypes[ws.deviceType] = (deviceTypes[ws.deviceType] || 0) + 1;
    });

    return {
      totalConnections,
      totalUsers,
      deviceTypes,
      uptime: process.uptime()
    };
  }

  /**
   * 获取总连接数
   */
  getTotalConnections() {
    return this.wss ? this.wss.clients.size : 0;
  }

  /**
   * 关闭WebSocket服务器
   */
  async close() {
    if (this.wss) {
      return new Promise((resolve) => {
        this.wss.close(() => {
          logger.info('WebSocket server closed');
          resolve();
        });
      });
    }
  }
}

module.exports = WebSocketService;

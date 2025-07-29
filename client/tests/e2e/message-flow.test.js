/**
 * 端到端消息流测试
 */

const MessageSubscriberClient = require('../../src/core/MessageSubscriberClient');
const ConfigManager = require('../../src/core/ConfigManager');
const WebSocket = require('ws');

describe('End-to-End Message Flow', () => {
  let mockServer;
  let client;
  let configManager;
  const TEST_PORT = 8081;
  const TEST_WS_URL = `ws://localhost:${TEST_PORT}`;

  beforeAll((done) => {
    // 创建模拟服务器
    mockServer = new WebSocket.Server({ port: TEST_PORT });
    
    mockServer.on('connection', (ws, req) => {
      const url = new URL(req.url, `http://localhost:${TEST_PORT}`);
      const token = url.searchParams.get('token');
      
      if (!token || token !== 'valid-test-token') {
        ws.close(1008, 'Invalid token');
        return;
      }
      
      // 发送连接确认
      ws.send(JSON.stringify({
        type: 'connection_established',
        data: {
          userId: 'test-user-id',
          username: 'test-user',
          deviceType: 'desktop'
        }
      }));
      
      // 模拟消息发送
      setTimeout(() => {
        // 发送TEXT消息
        ws.send(JSON.stringify({
          type: 'message',
          data: {
            messageId: 'msg-001',
            messageType: 'TEXT',
            content: 'Hello from server!',
            publishedAt: new Date().toISOString(),
            metadata: { source: 'test' }
          }
        }));
      }, 1000);
      
      setTimeout(() => {
        // 发送URL消息
        ws.send(JSON.stringify({
          type: 'message',
          data: {
            messageId: 'msg-002',
            messageType: 'URL',
            content: 'https://example.com',
            publishedAt: new Date().toISOString(),
            metadata: { source: 'test' }
          }
        }));
      }, 2000);
      
      // 处理心跳
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong' }));
          }
        } catch (error) {
          console.error('Mock server message error:', error);
        }
      });
    });
    
    mockServer.on('listening', done);
  });

  afterAll((done) => {
    if (mockServer) {
      mockServer.close(done);
    } else {
      done();
    }
  });

  beforeEach(() => {
    configManager = new ConfigManager();
    
    // Mock配置
    configManager.get = jest.fn((key) => {
      switch (key) {
        case 'brokerService.wsEndpoint':
          return TEST_WS_URL;
        case 'brokerService.reconnectInterval':
          return 1000;
        case 'brokerService.heartbeatInterval':
          return 5000;
        case 'brokerService.maxReconnectAttempts':
          return 3;
        case 'tokenManager.serverUrl':
          return 'http://localhost:3000';
        case 'tokenManager.username':
          return 'testuser';
        case 'tokenManager.password':
          return 'testpass';
        default:
          return undefined;
      }
    });
    
    client = new MessageSubscriberClient(configManager);
  });

  afterEach(async () => {
    if (client) {
      await client.stop();
    }
  });

  describe('Complete Message Flow', () => {
    test('should start client and receive messages', (done) => {
      const receivedMessages = [];
      
      // Mock TokenManager to return valid token
      client.tokenManager = {
        initialize: jest.fn().mockResolvedValue(),
        getValidToken: jest.fn().mockResolvedValue('valid-test-token')
      };
      
      client.on('message', (message) => {
        receivedMessages.push(message);
        
        if (receivedMessages.length === 2) {
          // 验证收到的消息
          expect(receivedMessages[0].messageType).toBe('TEXT');
          expect(receivedMessages[0].content).toBe('Hello from server!');
          expect(receivedMessages[0].messageId).toBe('msg-001');
          
          expect(receivedMessages[1].messageType).toBe('URL');
          expect(receivedMessages[1].content).toBe('https://example.com');
          expect(receivedMessages[1].messageId).toBe('msg-002');
          
          done();
        }
      });
      
      client.on('error', (error) => {
        done(error);
      });
      
      client.start().catch(done);
    }, 15000);

    test('should handle connection and reconnection', (done) => {
      let connectionCount = 0;
      let disconnectionCount = 0;
      
      // Mock TokenManager
      client.tokenManager = {
        initialize: jest.fn().mockResolvedValue(),
        getValidToken: jest.fn().mockResolvedValue('valid-test-token')
      };
      
      client.on('connected', () => {
        connectionCount++;
        
        if (connectionCount === 1) {
          // 第一次连接后，模拟服务器断开
          setTimeout(() => {
            mockServer.clients.forEach(ws => {
              ws.close(1000, 'Test disconnection');
            });
          }, 1000);
        } else if (connectionCount === 2) {
          // 重连成功
          expect(disconnectionCount).toBe(1);
          done();
        }
      });
      
      client.on('disconnected', () => {
        disconnectionCount++;
      });
      
      client.on('error', (error) => {
        done(error);
      });
      
      client.start().catch(done);
    }, 20000);
  });

  describe('Message Processing', () => {
    beforeEach(() => {
      // Mock TokenManager
      client.tokenManager = {
        initialize: jest.fn().mockResolvedValue(),
        getValidToken: jest.fn().mockResolvedValue('valid-test-token')
      };
    });

    test('should process TEXT messages correctly', (done) => {
      // Mock message handlers
      const mockTextHandler = {
        initialize: jest.fn().mockResolvedValue(),
        process: jest.fn().mockResolvedValue({
          success: true,
          action: 'copied-to-clipboard'
        })
      };
      
      client.messageHandlerRegistry = {
        initialize: jest.fn().mockResolvedValue(),
        processMessage: jest.fn().mockResolvedValue({
          success: true,
          action: 'copied-to-clipboard'
        }),
        getRegisteredHandlers: jest.fn().mockReturnValue(['TEXT'])
      };
      
      client.on('message', async (message) => {
        if (message.messageType === 'TEXT') {
          expect(message.content).toBe('Hello from server!');
          
          // 验证消息处理被调用
          expect(client.messageHandlerRegistry.processMessage).toHaveBeenCalledWith(message);
          
          done();
        }
      });
      
      client.on('error', (error) => {
        done(error);
      });
      
      client.start().catch(done);
    }, 15000);

    test('should handle message processing errors gracefully', (done) => {
      // Mock TokenManager
      client.tokenManager = {
        initialize: jest.fn().mockResolvedValue(),
        getValidToken: jest.fn().mockResolvedValue('valid-test-token')
      };
      
      // Mock failing message handler
      client.messageHandlerRegistry = {
        initialize: jest.fn().mockResolvedValue(),
        processMessage: jest.fn().mockRejectedValue(new Error('Processing failed')),
        getRegisteredHandlers: jest.fn().mockReturnValue(['TEXT'])
      };
      
      let messageReceived = false;
      
      client.on('message', async (message) => {
        messageReceived = true;
        
        // 等待一段时间确保错误被处理但不会导致崩溃
        setTimeout(() => {
          expect(messageReceived).toBe(true);
          done();
        }, 1000);
      });
      
      client.on('error', (error) => {
        // 消息处理错误不应该导致客户端停止
        if (error.message.includes('Processing failed')) {
          // 这是预期的错误，继续测试
          return;
        }
        done(error);
      });
      
      client.start().catch(done);
    }, 15000);
  });

  describe('Client Lifecycle', () => {
    test('should start and stop gracefully', async () => {
      // Mock TokenManager
      client.tokenManager = {
        initialize: jest.fn().mockResolvedValue(),
        getValidToken: jest.fn().mockResolvedValue('valid-test-token')
      };
      
      // 启动客户端
      await client.start();
      
      // 等待连接建立
      await new Promise((resolve) => {
        client.on('connected', resolve);
      });
      
      expect(client.getStatus().isRunning).toBe(true);
      expect(client.getStatus().isConnected).toBe(true);
      
      // 停止客户端
      await client.stop();
      
      expect(client.getStatus().isRunning).toBe(false);
      expect(client.getStatus().isConnected).toBe(false);
    }, 15000);
  });
});

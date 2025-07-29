/**
 * WebSocket连接集成测试
 */

const WebSocketConnectionManager = require('../../src/core/WebSocketConnectionManager');
const ConfigManager = require('../../src/core/ConfigManager');
const WebSocket = require('ws');

describe('WebSocket Connection Integration', () => {
  let mockServer;
  let connectionManager;
  let configManager;
  const TEST_PORT = 8080;
  const TEST_WS_URL = `ws://localhost:${TEST_PORT}`;

  beforeAll((done) => {
    // 创建模拟WebSocket服务器
    mockServer = new WebSocket.Server({ port: TEST_PORT });
    
    mockServer.on('connection', (ws, req) => {
      // 模拟服务器认证逻辑
      const url = new URL(req.url, `http://localhost:${TEST_PORT}`);
      const token = url.searchParams.get('token');
      
      if (!token || token !== 'valid-test-token') {
        ws.close(1008, 'Invalid token');
        return;
      }
      
      // 发送连接确认消息
      ws.send(JSON.stringify({
        type: 'connection_established',
        data: {
          userId: 'test-user-id',
          username: 'test-user',
          deviceType: 'desktop'
        }
      }));
      
      // 处理消息
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
        default:
          return undefined;
      }
    });
    
    connectionManager = new WebSocketConnectionManager(configManager);
  });

  afterEach(async () => {
    if (connectionManager) {
      await connectionManager.disconnect();
    }
  });

  describe('Connection Establishment', () => {
    test('should connect successfully with valid token', (done) => {
      connectionManager.on('connected', () => {
        expect(connectionManager.isConnected()).toBe(true);
        done();
      });
      
      connectionManager.on('error', (error) => {
        done(error);
      });
      
      connectionManager.connect('valid-test-token');
    }, 10000);

    test('should fail to connect with invalid token', (done) => {
      connectionManager.on('disconnected', () => {
        expect(connectionManager.isConnected()).toBe(false);
        done();
      });
      
      connectionManager.on('connected', () => {
        done(new Error('Should not connect with invalid token'));
      });
      
      connectionManager.connect('invalid-token');
    }, 10000);

    test('should receive connection confirmation message', (done) => {
      connectionManager.on('message', (message) => {
        if (message.type === 'connection_established') {
          expect(message.data.userId).toBe('test-user-id');
          expect(message.data.username).toBe('test-user');
          expect(message.data.deviceType).toBe('desktop');
          done();
        }
      });
      
      connectionManager.on('error', (error) => {
        done(error);
      });
      
      connectionManager.connect('valid-test-token');
    }, 10000);
  });

  describe('Message Exchange', () => {
    beforeEach((done) => {
      connectionManager.on('connected', () => {
        done();
      });
      
      connectionManager.on('error', (error) => {
        done(error);
      });
      
      connectionManager.connect('valid-test-token');
    });

    test('should send and receive ping/pong messages', (done) => {
      connectionManager.on('message', (message) => {
        if (message.type === 'pong') {
          done();
        }
      });
      
      connectionManager.send({ type: 'ping' }).catch(done);
    }, 10000);

    test('should handle message sending when connected', async () => {
      const testMessage = { type: 'test', data: 'hello' };
      
      await expect(connectionManager.send(testMessage)).resolves.not.toThrow();
    });

    test('should reject message sending when disconnected', async () => {
      await connectionManager.disconnect();
      
      const testMessage = { type: 'test', data: 'hello' };
      
      await expect(connectionManager.send(testMessage)).rejects.toThrow('WebSocket not connected');
    });
  });

  describe('Connection Management', () => {
    test('should disconnect gracefully', async () => {
      // 先连接
      await new Promise((resolve, reject) => {
        connectionManager.on('connected', resolve);
        connectionManager.on('error', reject);
        connectionManager.connect('valid-test-token');
      });
      
      expect(connectionManager.isConnected()).toBe(true);
      
      // 断开连接
      await connectionManager.disconnect();
      
      expect(connectionManager.isConnected()).toBe(false);
    });

    test('should handle server-initiated disconnection', (done) => {
      connectionManager.on('connected', () => {
        // 模拟服务器主动断开连接
        setTimeout(() => {
          mockServer.clients.forEach(client => {
            client.close(1000, 'Server shutdown');
          });
        }, 100);
      });
      
      connectionManager.on('disconnected', () => {
        expect(connectionManager.isConnected()).toBe(false);
        done();
      });
      
      connectionManager.on('error', (error) => {
        done(error);
      });
      
      connectionManager.connect('valid-test-token');
    }, 10000);
  });

  describe('Error Handling', () => {
    test('should handle connection errors gracefully', (done) => {
      // 使用无效的端口
      configManager.get = jest.fn((key) => {
        if (key === 'brokerService.wsEndpoint') {
          return 'ws://localhost:9999'; // 不存在的端口
        }
        return configManager.get(key);
      });
      
      const badConnectionManager = new WebSocketConnectionManager(configManager);
      
      badConnectionManager.on('error', (error) => {
        expect(error).toBeDefined();
        done();
      });
      
      badConnectionManager.on('connected', () => {
        done(new Error('Should not connect to invalid endpoint'));
      });
      
      badConnectionManager.connect('valid-test-token');
    }, 10000);

    test('should handle malformed messages gracefully', (done) => {
      connectionManager.on('connected', () => {
        // 发送格式错误的消息到服务器
        connectionManager.ws.send('invalid-json');
        
        // 等待一段时间确保没有崩溃
        setTimeout(() => {
          expect(connectionManager.isConnected()).toBe(true);
          done();
        }, 1000);
      });
      
      connectionManager.on('error', (error) => {
        done(error);
      });
      
      connectionManager.connect('valid-test-token');
    }, 10000);
  });
});

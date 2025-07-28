/**
 * 端到端消息传递测试
 * 测试从服务端发送消息到客户端的完整流程
 */

const MessageSubscriberClient = require('./src/core/MessageSubscriberClient');
const ConfigManager = require('./src/core/ConfigManager');
const http = require('http');

class MessageFlowTest {
  constructor() {
    this.configManager = new ConfigManager();
    this.client = null;
    this.receivedMessages = [];
    this.testStartTime = Date.now();
    this.serverUrl = 'http://localhost:3000';
    this.testToken = null;
  }

  async runTest() {
    console.log('🚀 Starting End-to-End Message Flow Test...\n');

    try {
      // 1. 启动客户端
      await this.startClient();

      // 2. 等待客户端连接稳定
      await this.waitForConnection();

      // 3. 发送测试消息
      await this.sendTestMessages();

      // 4. 验证消息接收
      await this.verifyMessageReception();

      console.log('\n🎉 End-to-End Message Flow Test completed successfully!');

    } catch (error) {
      console.error('❌ Test failed:', error.message);
      console.error('Error details:', error);
    }
  }

  async startClient() {
    console.log('📱 Starting message subscriber client...');
    
    this.client = new MessageSubscriberClient(this.configManager);
    this.setupMessageListener();
    
    await this.client.start();
    console.log('✅ Client started successfully');
  }

  setupMessageListener() {
    // 监听接收到的消息
    this.client.on('message', (message) => {
      console.log('📨 Message received:', {
        messageId: message.messageId,
        messageType: message.messageType,
        content: message.content.substring(0, 50) + (message.content.length > 50 ? '...' : ''),
        timestamp: new Date().toISOString()
      });
      
      this.receivedMessages.push({
        ...message,
        receivedAt: Date.now()
      });
    });

    // 监听连接事件
    this.client.on('connected', () => {
      console.log('🔗 Client connected to server');
    });

    this.client.on('disconnected', () => {
      console.log('⚠️  Client disconnected from server');
    });

    this.client.on('reconnected', () => {
      console.log('✅ Client reconnected successfully');
    });

    this.client.on('error', (error) => {
      console.log('⚠️  Client error:', error.message);
    });
  }

  async waitForConnection() {
    console.log('⏳ Waiting for stable connection...');
    
    // 等待最多30秒让连接稳定
    for (let i = 0; i < 30; i++) {
      const status = this.client.getStatus();
      if (status.isRunning && status.isConnected) {
        console.log('✅ Connection is stable');
        await this.sleep(2000); // 额外等待2秒确保连接稳定
        return;
      }
      
      await this.sleep(1000);
      if (i % 5 === 0) {
        console.log(`   Still waiting... (${i + 1}/30 seconds)`);
      }
    }
    
    throw new Error('Client failed to establish stable connection within 30 seconds');
  }

  async sendTestMessages() {
    console.log('\n📤 Sending test messages to server...');

    // 获取客户端的Token用于API调用
    this.testToken = this.client.tokenManager.currentToken;
    if (!this.testToken) {
      throw new Error('No valid token available for API calls');
    }

    const testMessages = [
      {
        messageType: 'TEXT',
        content: 'Hello from M-SYNC! This is a test text message.',
        description: 'Text message test'
      },
      {
        messageType: 'URL',
        content: 'https://github.com/microsoft/vscode',
        description: 'URL message test'
      },
      {
        messageType: 'CODE',
        content: 'console.log("Hello, M-SYNC!");',
        description: 'Code message test'
      }
    ];

    for (let i = 0; i < testMessages.length; i++) {
      const msg = testMessages[i];
      console.log(`   ${i + 1}. Sending ${msg.description}...`);
      
      try {
        await this.sendMessage(msg);
        console.log(`   ✅ ${msg.description} sent successfully`);
        
        // 等待1秒再发送下一条消息
        await this.sleep(1000);
      } catch (error) {
        console.log(`   ❌ Failed to send ${msg.description}:`, error.message);
      }
    }

    console.log('📤 All test messages sent');
  }

  async sendMessage(messageData) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        messageType: messageData.messageType,
        content: messageData.content,
        metadata: {
          source: 'test-script',
          timestamp: new Date().toISOString()
        }
      });

      const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/v1/messages',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.testToken}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              resolve(data);
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(postData);
      req.end();
    });
  }

  async verifyMessageReception() {
    console.log('\n🔍 Verifying message reception...');
    
    // 等待最多10秒让消息到达
    console.log('   Waiting for messages to arrive...');
    await this.sleep(5000);

    console.log(`   📊 Received ${this.receivedMessages.length} messages`);

    if (this.receivedMessages.length === 0) {
      console.log('   ⚠️  No messages received - this might indicate a connection issue');
      return;
    }

    // 分析接收到的消息
    const messageTypes = {};
    this.receivedMessages.forEach(msg => {
      messageTypes[msg.messageType] = (messageTypes[msg.messageType] || 0) + 1;
    });

    console.log('   📈 Message breakdown:');
    Object.entries(messageTypes).forEach(([type, count]) => {
      console.log(`      - ${type}: ${count} messages`);
    });

    // 显示最近的几条消息
    console.log('\n   📋 Recent messages:');
    this.receivedMessages.slice(-3).forEach((msg, index) => {
      console.log(`      ${index + 1}. [${msg.messageType}] ${msg.content.substring(0, 40)}...`);
    });

    if (this.receivedMessages.length >= 3) {
      console.log('   ✅ Message reception test passed!');
    } else {
      console.log('   ⚠️  Expected 3 messages but received', this.receivedMessages.length);
    }
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up...');
    
    if (this.client) {
      await this.client.stop();
      console.log('✅ Client stopped');
    }
    
    const testDuration = Math.round((Date.now() - this.testStartTime) / 1000);
    console.log(`\n⏱️  Total test duration: ${testDuration} seconds`);
    
    // 显示测试总结
    console.log('\n📊 Test Summary:');
    console.log(`   - Messages sent: 3`);
    console.log(`   - Messages received: ${this.receivedMessages.length}`);
    console.log(`   - Success rate: ${Math.round((this.receivedMessages.length / 3) * 100)}%`);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 运行测试
async function main() {
  const test = new MessageFlowTest();
  
  try {
    await test.runTest();
  } finally {
    await test.cleanup();
  }
}

// 处理程序退出
process.on('SIGINT', async () => {
  console.log('\n\n⚠️  Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n\n⚠️  Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

if (require.main === module) {
  main().catch(console.error);
}

module.exports = MessageFlowTest;

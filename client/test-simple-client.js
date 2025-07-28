/**
 * 简单的客户端测试
 * 启动客户端并等待接收消息
 */

const MessageSubscriberClient = require('./src/core/MessageSubscriberClient');
const ConfigManager = require('./src/core/ConfigManager');

class SimpleClientTest {
  constructor() {
    this.configManager = new ConfigManager();
    this.client = null;
    this.receivedMessages = [];
    this.startTime = Date.now();
  }

  async start() {
    console.log('🚀 Starting Simple Message Client Test...\n');

    try {
      // 创建客户端
      this.client = new MessageSubscriberClient(this.configManager);
      this.setupEventListeners();

      // 启动客户端
      console.log('📱 Starting message subscriber client...');
      await this.client.start();
      console.log('✅ Client started successfully!\n');

      // 显示客户端状态
      this.showStatus();

      // 保持运行并监听消息
      console.log('👂 Listening for messages... (Press Ctrl+C to stop)\n');
      console.log('💡 You can now send messages through the web interface or API');
      console.log('   Web interface: http://localhost:3000');
      console.log('   API endpoint: POST http://localhost:3000/api/v1/messages\n');

      // 定期显示状态
      this.statusInterval = setInterval(() => {
        this.showStatus();
      }, 30000); // 每30秒显示一次状态

    } catch (error) {
      console.error('❌ Failed to start client:', error.message);
      console.error('Error details:', error);
    }
  }

  setupEventListeners() {
    // 连接事件
    this.client.on('connected', () => {
      console.log('🔗 ✅ Client connected to server');
    });

    this.client.on('disconnected', () => {
      console.log('⚠️  🔌 Client disconnected from server');
    });

    this.client.on('reconnecting', (attempt) => {
      console.log(`🔄 Reconnecting... (attempt ${attempt})`);
    });

    this.client.on('reconnected', () => {
      console.log('✅ 🔄 Client reconnected successfully');
    });

    // 认证事件
    this.client.on('tokenRefreshed', () => {
      console.log('🔑 Token refreshed successfully');
    });

    this.client.on('authenticationRecovered', () => {
      console.log('✅ Authentication recovered');
    });

    this.client.on('authenticationFailed', (error) => {
      console.log('❌ Authentication failed:', error.message);
    });

    // 消息事件 - 这是最重要的！
    this.client.on('message', (message) => {
      const timestamp = new Date().toLocaleTimeString();
      console.log(`\n📨 [${timestamp}] MESSAGE RECEIVED:`);
      console.log(`   📋 Message ID: ${message.messageId}`);
      console.log(`   📝 Type: ${message.messageType}`);
      console.log(`   💬 Content: ${message.content}`);
      console.log(`   ⏰ Timestamp: ${message.timestamp || 'N/A'}`);
      
      // 根据消息类型显示特殊处理
      switch (message.messageType) {
        case 'TEXT':
          console.log(`   📋 Text copied to clipboard (simulated)`);
          break;
        case 'URL':
          console.log(`   🌐 URL opened in browser (simulated): ${message.content}`);
          break;
        case 'CODE':
          console.log(`   💻 Code snippet processed (simulated)`);
          break;
      }
      
      console.log('   ─────────────────────────────────────\n');
      
      this.receivedMessages.push({
        ...message,
        receivedAt: Date.now()
      });
    });

    // 错误事件
    this.client.on('error', (error) => {
      console.log('⚠️  Client error:', error.message);
    });
  }

  showStatus() {
    const status = this.client.getStatus();
    const uptime = Math.round((Date.now() - this.startTime) / 1000);
    
    console.log('📊 Client Status:');
    console.log(`   🏃 Running: ${status.isRunning ? '✅' : '❌'}`);
    console.log(`   🔗 Connected: ${status.isConnected ? '✅' : '❌'}`);
    console.log(`   📨 Messages Received: ${this.receivedMessages.length}`);
    console.log(`   ⏰ Uptime: ${uptime} seconds`);
    console.log(`   📋 Queue Length: ${status.messageQueueLength}`);
    console.log('   ─────────────────────────────────────');
  }

  async stop() {
    console.log('\n🛑 Stopping client...');
    
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
    }
    
    if (this.client) {
      await this.client.stop();
      console.log('✅ Client stopped successfully');
    }
    
    // 显示最终统计
    const totalTime = Math.round((Date.now() - this.startTime) / 1000);
    console.log('\n📊 Final Statistics:');
    console.log(`   ⏰ Total runtime: ${totalTime} seconds`);
    console.log(`   📨 Total messages received: ${this.receivedMessages.length}`);
    
    if (this.receivedMessages.length > 0) {
      console.log('\n📋 Received Messages Summary:');
      const messageTypes = {};
      this.receivedMessages.forEach(msg => {
        messageTypes[msg.messageType] = (messageTypes[msg.messageType] || 0) + 1;
      });
      
      Object.entries(messageTypes).forEach(([type, count]) => {
        console.log(`   - ${type}: ${count} messages`);
      });
    }
    
    console.log('\n🎉 Test completed!');
  }
}

// 创建测试实例
const test = new SimpleClientTest();

// 处理程序退出
process.on('SIGINT', async () => {
  console.log('\n\n⚠️  Received SIGINT, shutting down gracefully...');
  await test.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n\n⚠️  Received SIGTERM, shutting down gracefully...');
  await test.stop();
  process.exit(0);
});

// 启动测试
test.start().catch(console.error);

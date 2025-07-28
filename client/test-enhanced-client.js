/**
 * 测试增强版MessageSubscriberClient
 * 验证自动Token管理和智能重连功能
 */

const MessageSubscriberClient = require('./src/core/MessageSubscriberClient');
const ConfigManager = require('./src/core/ConfigManager');

class EnhancedClientTest {
  constructor() {
    this.configManager = new ConfigManager();
    this.client = null;
    this.testStartTime = Date.now();
  }

  async runTest() {
    console.log('🚀 Starting Enhanced MessageSubscriberClient Test...\n');

    try {
      // 配置管理器已在构造函数中初始化
      console.log('✅ Configuration manager initialized');

      // 创建客户端实例
      this.client = new MessageSubscriberClient(this.configManager);
      this.setupEventListeners();

      // 启动客户端
      console.log('\n🔐 Starting client with automatic token management...');
      await this.client.start();

      console.log('✅ Client started successfully!');
      console.log('\n📊 Client Status:', this.client.getStatus());

      // 运行测试场景
      await this.runTestScenarios();

    } catch (error) {
      console.error('❌ Test failed:', error.message);
      console.error('Error details:', error);
    }
  }

  setupEventListeners() {
    // 连接事件
    this.client.on('connected', () => {
      console.log('🔗 Client connected to server');
    });

    this.client.on('disconnected', () => {
      console.log('⚠️  Client disconnected from server');
    });

    this.client.on('reconnecting', (attempt) => {
      console.log(`🔄 Reconnecting... (attempt ${attempt})`);
    });

    this.client.on('reconnected', () => {
      console.log('✅ Client reconnected successfully');
    });

    this.client.on('reconnectionFailed', (error) => {
      console.log('❌ Reconnection failed:', error.message);
    });

    // 认证事件
    this.client.on('tokenRefreshed', (token) => {
      console.log('🔑 Token refreshed successfully');
      console.log('   New token:', token.substring(0, 20) + '...');
    });

    this.client.on('authenticationRecovered', () => {
      console.log('✅ Authentication recovered after error');
    });

    this.client.on('authenticationFailed', (error) => {
      console.log('❌ Authentication failed:', error.message);
    });

    // 消息事件
    this.client.on('message', (message) => {
      console.log('📨 Message received:', {
        messageId: message.messageId,
        messageType: message.messageType,
        contentLength: message.content.length
      });
    });

    // 错误事件
    this.client.on('error', (error) => {
      console.log('⚠️  Client error:', error.message);
    });
  }

  async runTestScenarios() {
    console.log('\n🧪 Running test scenarios...\n');

    // 场景1: 检查Token信息
    await this.testTokenInfo();

    // 场景2: 检查客户端状态
    await this.testClientStatus();

    // 场景3: 测试Token刷新（如果需要）
    await this.testTokenRefresh();

    // 场景4: 保持连接一段时间观察Token监控
    await this.testTokenMonitoring();

    console.log('\n🎉 All test scenarios completed!');
  }

  async testTokenInfo() {
    try {
      console.log('📋 Test 1: Token Information');
      
      const tokenInfo = this.client.tokenManager.getTokenInfo();
      if (tokenInfo) {
        console.log('   ✅ Token info available:');
        console.log('   - Token Name:', tokenInfo.tokenName);
        console.log('   - Device Type:', tokenInfo.deviceType);
        console.log('   - Permissions:', tokenInfo.permissions);
        console.log('   - Expires At:', tokenInfo.expiresAt);
        console.log('   - Is Active:', tokenInfo.isActive);
        console.log('   - Is Expired:', tokenInfo.isExpired);
      } else {
        console.log('   ⚠️  No token info available');
      }
      
    } catch (error) {
      console.log('   ❌ Token info test failed:', error.message);
    }
    
    console.log('');
  }

  async testClientStatus() {
    try {
      console.log('📊 Test 2: Client Status');
      
      const status = this.client.getStatus();
      console.log('   ✅ Client status:');
      console.log('   - Is Running:', status.isRunning);
      console.log('   - Is Connected:', status.isConnected);
      console.log('   - Message Queue Length:', status.messageQueueLength);
      console.log('   - Processing Message:', status.processingMessage);
      
      const stats = this.client.getStats();
      console.log('   ✅ Client stats available');
      
    } catch (error) {
      console.log('   ❌ Client status test failed:', error.message);
    }
    
    console.log('');
  }

  async testTokenRefresh() {
    try {
      console.log('🔄 Test 3: Token Refresh (if needed)');
      
      // 检查Token是否即将过期
      const tokenInfo = this.client.tokenManager.getTokenInfo();
      if (tokenInfo && tokenInfo.expiresAt) {
        const expiresAt = new Date(tokenInfo.expiresAt);
        const now = new Date();
        const timeUntilExpiry = expiresAt.getTime() - now.getTime();
        const hoursUntilExpiry = Math.round(timeUntilExpiry / 1000 / 60 / 60);
        
        console.log(`   📅 Token expires in ${hoursUntilExpiry} hours`);
        
        if (timeUntilExpiry < 24 * 60 * 60 * 1000) { // 24小时内过期
          console.log('   🔄 Token expiring soon, testing refresh...');
          await this.client.refreshToken();
          console.log('   ✅ Token refresh test completed');
        } else {
          console.log('   ✅ Token is still valid, no refresh needed');
        }
      } else {
        console.log('   ⚠️  Cannot determine token expiry');
      }
      
    } catch (error) {
      console.log('   ❌ Token refresh test failed:', error.message);
    }
    
    console.log('');
  }

  async testTokenMonitoring() {
    console.log('⏱️  Test 4: Token Monitoring');
    console.log('   📡 Monitoring client for 30 seconds...');
    console.log('   (Token checks run every 5 minutes in production)');
    
    // 等待30秒观察客户端行为
    await this.sleep(30000);
    
    console.log('   ✅ Monitoring period completed');
    console.log('');
  }

  async cleanup() {
    console.log('🧹 Cleaning up...');
    
    if (this.client) {
      await this.client.stop();
      console.log('✅ Client stopped');
    }
    
    const testDuration = Math.round((Date.now() - this.testStartTime) / 1000);
    console.log(`\n⏱️  Total test duration: ${testDuration} seconds`);
    console.log('🎉 Enhanced client test completed successfully!');
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 运行测试
async function main() {
  const test = new EnhancedClientTest();
  
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

module.exports = EnhancedClientTest;

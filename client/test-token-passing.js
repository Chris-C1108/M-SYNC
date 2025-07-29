/**
 * 测试Token传递机制
 */

const TokenManager = require('./src/services/TokenManager');
const ConfigManager = require('./src/core/ConfigManager');
const WebSocketConnectionManager = require('./src/core/WebSocketConnectionManager');

async function testTokenPassing() {
  console.log('🚀 Testing Token passing mechanism...\n');

  try {
    // 1. 获取Token
    console.log('Step 1: Getting authentication token...');
    const configManager = new ConfigManager();
    const tokenManager = new TokenManager(configManager);
    await tokenManager.initialize();
    const token = await tokenManager.getValidToken();
    
    if (!token) {
      throw new Error('Failed to get valid token');
    }
    
    console.log('✅ Token obtained:', token.substring(0, 20) + '...');
    console.log('   Full token length:', token.length);

    // 2. 测试配置设置
    console.log('\nStep 2: Testing config set...');
    try {
      configManager.set('brokerService.authToken', token);
      const retrievedToken = configManager.get('brokerService.authToken');
      console.log('✅ Config set successful');
      console.log('   Retrieved token:', retrievedToken ? retrievedToken.substring(0, 20) + '...' : 'null');
    } catch (error) {
      console.log('❌ Config set failed:', error.message);
    }

    // 3. 测试WebSocket连接（直接传递Token）
    console.log('\nStep 3: Testing WebSocket connection with direct token passing...');
    const wsManager = new WebSocketConnectionManager(configManager);
    
    wsManager.on('connected', () => {
      console.log('✅ WebSocket connected successfully!');
    });

    wsManager.on('disconnected', () => {
      console.log('⚠️  WebSocket disconnected');
    });

    wsManager.on('error', (error) => {
      console.log('❌ WebSocket error:', error.message);
    });

    wsManager.on('message', (message) => {
      console.log('📨 Received message:', message);
    });

    // 直接传递Token
    await wsManager.connect(token);
    
    console.log('✅ Connection attempt completed');

    // 等待一段时间观察结果
    setTimeout(() => {
      console.log('\n⏰ Test completed, disconnecting...');
      wsManager.disconnect();
      process.exit(0);
    }, 5000);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

testTokenPassing();

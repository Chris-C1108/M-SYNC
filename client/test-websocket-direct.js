/**
 * 直接测试WebSocket连接和认证
 */

const WebSocket = require('ws');
const TokenManager = require('./src/services/TokenManager');
const ConfigManager = require('./src/core/ConfigManager');

async function testWebSocketDirect() {
  console.log('🚀 Testing WebSocket connection directly...\n');

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
    
    console.log('✅ Token obtained:', token.substring(0, 20) + '...\n');

    // 2. 测试WebSocket连接（带Token参数）
    console.log('Step 2: Testing WebSocket connection with token parameter...');
    const wsUrl = `ws://localhost:3000/ws/subscribe?token=${encodeURIComponent(token)}`;
    console.log('Connecting to:', wsUrl);

    const ws = new WebSocket(wsUrl);

    ws.on('open', () => {
      console.log('✅ WebSocket connection established!');
      console.log('🎉 Authentication successful!\n');
      
      // 发送测试消息
      console.log('Step 3: Sending test ping...');
      ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('📨 Received message:', message);
        
        if (message.type === 'connection_established') {
          console.log('🎉 Connection confirmation received!');
          console.log('   User ID:', message.data.userId);
          console.log('   Username:', message.data.username);
          console.log('   Device Type:', message.data.deviceType);
        }
      } catch (error) {
        console.log('📨 Received raw message:', data.toString());
      }
    });

    ws.on('close', (code, reason) => {
      console.log(`❌ WebSocket closed: Code ${code}, Reason: ${reason.toString()}`);
      
      if (code === 1011) {
        console.log('🔍 Error 1011 indicates internal server error during authentication');
      }
      
      process.exit(code === 1000 ? 0 : 1);
    });

    ws.on('error', (error) => {
      console.log('❌ WebSocket error:', error.message);
      process.exit(1);
    });

    // 10秒后自动关闭
    setTimeout(() => {
      console.log('\n⏰ Test timeout, closing connection...');
      ws.close(1000, 'Test completed');
    }, 10000);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

testWebSocketDirect();

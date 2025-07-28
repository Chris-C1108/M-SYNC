/**
 * 调试版客户端测试
 * 详细输出所有步骤
 */

const MessageSubscriberClient = require('./src/core/MessageSubscriberClient');
const ConfigManager = require('./src/core/ConfigManager');

async function debugTest() {
  console.log('🚀 Starting Debug Client Test...\n');

  try {
    console.log('1. Creating ConfigManager...');
    const configManager = new ConfigManager();
    console.log('✅ ConfigManager created');

    console.log('2. Creating MessageSubscriberClient...');
    const client = new MessageSubscriberClient(configManager);
    console.log('✅ MessageSubscriberClient created');

    console.log('3. Setting up event listeners...');
    
    client.on('connected', () => {
      console.log('🔗 CLIENT CONNECTED TO SERVER!');
    });

    client.on('disconnected', () => {
      console.log('⚠️  CLIENT DISCONNECTED FROM SERVER');
    });

    client.on('message', (message) => {
      console.log('\n🎉 MESSAGE RECEIVED!');
      console.log('   Message ID:', message.messageId);
      console.log('   Message Type:', message.messageType);
      console.log('   Content:', message.content);
      console.log('   Timestamp:', message.timestamp);
      console.log('');
    });

    client.on('error', (error) => {
      console.log('❌ CLIENT ERROR:', error.message);
    });

    console.log('✅ Event listeners set up');

    console.log('4. Starting client...');
    await client.start();
    console.log('✅ CLIENT STARTED SUCCESSFULLY!');

    console.log('\n📊 Client Status:');
    const status = client.getStatus();
    console.log('   Running:', status.isRunning);
    console.log('   Connected:', status.isConnected);

    console.log('\n👂 Listening for messages...');
    console.log('💡 Send a message through: http://localhost:3000');
    console.log('⏹️  Press Ctrl+C to stop\n');

    // 保持运行
    process.on('SIGINT', async () => {
      console.log('\n🛑 Stopping client...');
      await client.stop();
      console.log('✅ Client stopped');
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

debugTest();

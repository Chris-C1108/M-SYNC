/**
 * 逐步测试客户端启动过程
 */

async function stepByStepTest() {
  console.log('🚀 Starting step-by-step client test...\n');

  try {
    console.log('Step 1: Loading modules...');
    const MessageSubscriberClient = require('./src/core/MessageSubscriberClient');
    const ConfigManager = require('./src/core/ConfigManager');
    console.log('✅ Modules loaded\n');

    console.log('Step 2: Creating ConfigManager...');
    const configManager = new ConfigManager();
    console.log('✅ ConfigManager created\n');

    console.log('Step 3: Creating MessageSubscriberClient...');
    const client = new MessageSubscriberClient(configManager);
    console.log('✅ MessageSubscriberClient created\n');

    console.log('Step 4: Setting up basic event listeners...');
    client.on('connected', () => {
      console.log('🔗 CLIENT CONNECTED!');
    });

    client.on('disconnected', () => {
      console.log('⚠️  CLIENT DISCONNECTED!');
    });

    client.on('error', (error) => {
      console.log('❌ CLIENT ERROR:', error.message);
    });

    client.on('message', (message) => {
      console.log('📨 MESSAGE RECEIVED:', message);
    });
    console.log('✅ Event listeners set up\n');

    console.log('Step 5: Starting client...');
    console.log('This may take a moment for Token authentication...\n');
    
    await client.start();
    
    console.log('✅ CLIENT STARTED SUCCESSFULLY!\n');

    console.log('Step 6: Checking client status...');
    const status = client.getStatus();
    console.log('Client Status:', {
      isRunning: status.isRunning,
      isConnected: status.isConnected,
      messageQueueLength: status.messageQueueLength
    });

    console.log('\n👂 Client is now listening for messages...');
    console.log('💡 You can send messages through: http://localhost:3000');
    console.log('⏹️  Press Ctrl+C to stop\n');

    // 保持运行
    process.on('SIGINT', async () => {
      console.log('\n🛑 Stopping client...');
      await client.stop();
      console.log('✅ Client stopped');
      process.exit(0);
    });

    // 定期显示状态
    setInterval(() => {
      const currentStatus = client.getStatus();
      console.log(`📊 Status: Running=${currentStatus.isRunning}, Connected=${currentStatus.isConnected}`);
    }, 10000);

  } catch (error) {
    console.error('❌ Test failed at step:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

stepByStepTest();

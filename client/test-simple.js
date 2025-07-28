console.log('Starting simple test...');

try {
  console.log('1. Testing ConfigManager...');
  const ConfigManager = require('./src/core/ConfigManager');
  const config = new ConfigManager();
  console.log('✅ ConfigManager loaded');

  console.log('2. Testing TokenManager...');
  const TokenManager = require('./src/services/TokenManager');
  const tokenManager = new TokenManager(config);
  console.log('✅ TokenManager loaded');

  console.log('3. Testing WebSocketConnectionManager...');
  const WebSocketConnectionManager = require('./src/core/WebSocketConnectionManager');
  const wsManager = new WebSocketConnectionManager(config);
  console.log('✅ WebSocketConnectionManager loaded');

  console.log('4. Testing MessageSubscriberClient...');
  const MessageSubscriberClient = require('./src/core/MessageSubscriberClient');
  const client = new MessageSubscriberClient(config);
  console.log('✅ MessageSubscriberClient loaded');

  console.log('\n🎉 All modules loaded successfully!');

} catch (error) {
  console.error('❌ Error loading modules:', error.message);
  console.error('Stack trace:', error.stack);
}

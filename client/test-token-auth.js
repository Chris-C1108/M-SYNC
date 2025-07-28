/**
 * Token自动获取功能测试脚本
 */

const path = require('path');
const ConfigManager = require('./src/core/ConfigManager');
const TokenManager = require('./src/services/TokenManager');
const logger = require('./src/utils/logger').createLogger('TokenAuthTest');

async function testTokenAuthentication() {
  try {
    console.log('🚀 Starting Token Authentication Test...\n');

    // 初始化配置管理器
    const configManager = new ConfigManager();

    console.log('✅ Configuration manager initialized');

    // 初始化Token管理器
    const tokenManager = new TokenManager(configManager);
    await tokenManager.initialize();

    console.log('✅ Token manager initialized');

    // 清除现有Token（用于测试）
    await tokenManager.clearToken();
    console.log('🧹 Existing tokens cleared for testing');

    // 尝试获取有效Token
    console.log('\n🔐 Attempting to get valid token...');
    console.log('This should trigger the browser authentication flow...\n');

    const token = await tokenManager.getValidToken();

    if (token) {
      console.log('✅ Token obtained successfully!');
      console.log(`Token: ${token.substring(0, 20)}...`);
      
      const tokenInfo = tokenManager.getTokenInfo();
      if (tokenInfo) {
        console.log('📋 Token Info:');
        console.log(`  - Token Name: ${tokenInfo.tokenName}`);
        console.log(`  - Device Type: ${tokenInfo.deviceType}`);
        console.log(`  - Permissions: ${tokenInfo.permissions?.join(', ')}`);
        console.log(`  - Created: ${tokenInfo.createdAt}`);
      }

      // 验证Token
      console.log('\n🔍 Validating token...');
      const isValid = await tokenManager.isTokenValid();
      console.log(`Token validation result: ${isValid ? '✅ Valid' : '❌ Invalid'}`);

    } else {
      console.log('❌ Failed to obtain token');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    logger.error('Token authentication test failed:', error);
  }
}

// 运行测试
if (require.main === module) {
  testTokenAuthentication()
    .then(() => {
      console.log('\n🎉 Token authentication test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Token authentication test failed:', error);
      process.exit(1);
    });
}

module.exports = { testTokenAuthentication };

/**
 * 客户端配置相关路由
 */

const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const router = express.Router();
const logger = require('../../utils/logger').createLogger('ClientRoutes');
const { authenticateToken } = require('../../middleware/auth');

/**
 * POST /api/v1/client/auto-config
 * 自动配置客户端
 */
router.post('/auto-config', authenticateToken, async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token is required'
      });
    }

    // 尝试创建客户端配置文件
    const configSuccess = await createClientConfig(token, req.user);
    
    if (configSuccess) {
      logger.info('Client auto-configuration successful', {
        userId: req.user.id,
        tokenLength: token.length
      });

      res.json({
        success: true,
        message: 'Client configuration created successfully',
        data: {
          configPath: configSuccess.configPath,
          instructions: configSuccess.instructions
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to create client configuration'
      });
    }

  } catch (error) {
    logger.error('Client auto-config failed:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/v1/client/download
 * 下载客户端配置文件
 */
router.get('/download/:filename', authenticateToken, async (req, res) => {
  try {
    const { filename } = req.params;
    
    // 验证文件名安全性
    if (!filename || filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid filename'
      });
    }

    const configDir = path.join(process.cwd(), 'temp', 'client-configs');
    const filePath = path.join(configDir, filename);

    // 检查文件是否存在
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: 'Configuration file not found'
      });
    }

    // 发送文件
    res.download(filePath, filename, (error) => {
      if (error) {
        logger.error('Failed to send config file:', error);
      } else {
        // 下载完成后删除临时文件
        fs.unlink(filePath).catch(err => {
          logger.warn('Failed to delete temp config file:', err);
        });
      }
    });

  } catch (error) {
    logger.error('Client config download failed:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * 创建客户端配置文件
 */
async function createClientConfig(token, user) {
  try {
    // 创建临时目录
    const tempDir = path.join(process.cwd(), 'temp', 'client-configs');
    await fs.mkdir(tempDir, { recursive: true });

    // 生成配置文件内容
    const configContent = generateClientConfig(token, user);
    
    // 生成唯一文件名
    const timestamp = Date.now();
    const filename = `msync-config-${user.id}-${timestamp}.env`;
    const filePath = path.join(tempDir, filename);

    // 写入配置文件
    await fs.writeFile(filePath, configContent, 'utf8');

    logger.info('Client config file created', {
      userId: user.id,
      filename: filename
    });

    return {
      configPath: filePath,
      filename: filename,
      instructions: [
        '1. 下载并安装M-SYNC桌面客户端',
        '2. 将此配置文件重命名为 .env',
        '3. 将 .env 文件放置在客户端根目录',
        '4. 重启客户端应用程序',
        '5. 客户端将自动连接到服务器'
      ]
    };

  } catch (error) {
    logger.error('Failed to create client config:', error);
    return null;
  }
}

/**
 * 生成客户端配置文件内容
 */
function generateClientConfig(token, user) {
  const serverHost = process.env.MSYNC_HOST || 'localhost';
  const serverPort = process.env.MSYNC_PORT || '3000';
  const wsEndpoint = `ws://${serverHost}:${serverPort}/ws/subscribe`;

  return `# M-SYNC Desktop Client Configuration
# Generated on ${new Date().toISOString()}
# User: ${user.username} (${user.email})

# 消息代理服务配置
MSYNC_SUBSCRIBER_WS_ENDPOINT=${wsEndpoint}
MSYNC_SUBSCRIBER_AUTH_TOKEN=${token}

# 连接配置
MSYNC_SUBSCRIBER_RECONNECT_INTERVAL=5000
MSYNC_SUBSCRIBER_HEARTBEAT_INTERVAL=30000
MSYNC_SUBSCRIBER_CONNECTION_TIMEOUT=10000
MSYNC_SUBSCRIBER_MAX_RECONNECT_ATTEMPTS=10

# 日志配置
MSYNC_SUBSCRIBER_LOG_LEVEL=info
MSYNC_SUBSCRIBER_LOG_FILE=./logs/subscriber.log
MSYNC_SUBSCRIBER_LOG_MAX_SIZE=20m
MSYNC_SUBSCRIBER_LOG_MAX_FILES=5

# 消息处理配置
MSYNC_SUBSCRIBER_ENABLE_CLIPBOARD=true
MSYNC_SUBSCRIBER_ENABLE_BROWSER=true
MSYNC_SUBSCRIBER_ENABLE_NOTIFICATIONS=true

# 系统集成配置
MSYNC_SUBSCRIBER_NOTIFICATION_TIMEOUT=5000
MSYNC_SUBSCRIBER_CLIPBOARD_TIMEOUT=1000
MSYNC_SUBSCRIBER_BROWSER_TIMEOUT=3000

# 安全配置
MSYNC_SUBSCRIBER_VERIFY_SSL=false
MSYNC_SUBSCRIBER_ALLOWED_ORIGINS=*

# 应用配置
MSYNC_SUBSCRIBER_APP_NAME=M-SYNC Desktop Subscriber
MSYNC_SUBSCRIBER_APP_VERSION=1.0.0
MSYNC_SUBSCRIBER_AUTO_START=true

# 托盘模式配置
MSYNC_TRAY_MODE=true
`;
}

module.exports = router;

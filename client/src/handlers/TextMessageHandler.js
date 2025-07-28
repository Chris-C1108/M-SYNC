/**
 * 文本消息处理器
 * 处理TEXT和CODE类型的消息，将内容复制到剪贴板
 */

const ClipboardManager = require('../services/ClipboardManager');
const SystemNotifier = require('../services/SystemNotifier');
const logger = require('../utils/logger').createLogger('TextMessageHandler');

class TextMessageHandler {
  constructor(config) {
    this.config = config;
    this.clipboardManager = null;
    this.systemNotifier = null;
  }

  async initialize() {
    try {
      logger.info('Initializing text message handler');

      // 初始化剪贴板管理器
      this.clipboardManager = new ClipboardManager(this.config);
      await this.clipboardManager.initialize();

      // 初始化系统通知器
      if (this.config.get('systemIntegration.notifications.enabled')) {
        this.systemNotifier = new SystemNotifier(this.config);
        await this.systemNotifier.initialize();
      }

      logger.info('Text message handler initialized');

    } catch (error) {
      logger.error('Failed to initialize text message handler:', error);
      throw error;
    }
  }

  async process(message) {
    try {
      logger.info('Processing text message', {
        messageId: message.messageId,
        messageType: message.messageType,
        contentLength: message.content.length
      });

      // 验证消息内容
      if (!this.validateContent(message.content)) {
        throw new Error('Invalid message content');
      }

      // 复制到剪贴板
      await this.clipboardManager.writeText(message.content);

      // 发送系统通知
      if (this.systemNotifier) {
        await this.sendNotification(message);
      }

      logger.info('Text message processed successfully', {
        messageId: message.messageId,
        messageType: message.messageType
      });

    } catch (error) {
      logger.error('Failed to process text message:', {
        messageId: message.messageId,
        error: error.message
      });
      throw error;
    }
  }

  validateContent(content) {
    // 检查内容长度
    if (!content || content.length === 0) {
      logger.warn('Empty message content');
      return false;
    }

    // 检查最大长度
    const maxLength = this.config.get('security.maxMessageSize');
    if (content.length > maxLength) {
      logger.warn('Message content too long', {
        length: content.length,
        maxLength
      });
      return false;
    }

    return true;
  }

  async sendNotification(message) {
    try {
      const title = message.messageType === 'CODE' ? '代码已同步' : '文本已同步';
      const body = this.truncateContent(message.content, 100);

      await this.systemNotifier.notify({
        title,
        body: `内容已复制到剪贴板：${body}`,
        icon: 'clipboard'
      });

    } catch (error) {
      logger.warn('Failed to send notification:', error);
      // 通知失败不应该影响主要功能
    }
  }

  truncateContent(content, maxLength) {
    if (content.length <= maxLength) {
      return content;
    }
    return content.substring(0, maxLength) + '...';
  }

  async cleanup() {
    try {
      if (this.clipboardManager) {
        await this.clipboardManager.cleanup();
      }
      if (this.systemNotifier) {
        await this.systemNotifier.cleanup();
      }
      logger.info('Text message handler cleaned up');
    } catch (error) {
      logger.error('Error cleaning up text message handler:', error);
    }
  }
}

module.exports = TextMessageHandler;

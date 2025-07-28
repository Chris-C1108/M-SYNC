/**
 * URL消息处理器
 * 负责处理URL类型的消息
 */

const { spawn } = require('child_process');
const SystemNotifier = require('../services/SystemNotifier');
const logger = require('../utils/logger').createLogger('UrlMessageHandler');

class UrlMessageHandler {
  constructor(config) {
    this.config = config;
    this.systemNotifier = null;
    this.browserCommand = this.getBrowserCommand();
  }

  async initialize() {
    try {
      logger.info('Initializing URL message handler');

      // 初始化系统通知器
      if (this.config.get('systemIntegration.notifications.enabled')) {
        this.systemNotifier = new SystemNotifier(this.config);
        await this.systemNotifier.initialize();
      }

      logger.info('URL message handler initialized');

    } catch (error) {
      logger.error('Failed to initialize URL message handler:', error);
      throw error;
    }
  }

  async process(message) {
    try {
      logger.info('Processing URL message', {
        messageId: message.messageId,
        url: message.content
      });

      // 验证URL格式
      if (!this.isValidUrl(message.content)) {
        logger.warn('Invalid URL format:', message.content);
        return;
      }

      // 发送通知
      if (this.systemNotifier) {
        await this.systemNotifier.notifyUrlMessage(message.content);
      }

      // 在浏览器中打开URL
      await this.openInBrowser(message.content);

      logger.info('URL message processed successfully', {
        messageId: message.messageId,
        url: message.content
      });

    } catch (error) {
      logger.error('Failed to process URL message:', {
        messageId: message.messageId,
        error: error.message
      });
      throw error;
    }
  }

  async openInBrowser(url) {
    try {
      logger.info('Opening URL in browser:', url);

      // 在控制台显示（简单实现）
      console.log(`\n🌐 Opening URL in browser: ${url}`);

      // 在实际实现中，这里会调用系统默认浏览器
      // const process = spawn(this.browserCommand, [url], { detached: true });
      // process.unref();

      return true;
    } catch (error) {
      logger.error('Failed to open URL in browser:', error);
      throw error;
    }
  }

  isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }

  getBrowserCommand() {
    const platform = process.platform;
    
    switch (platform) {
      case 'win32':
        return 'start';
      case 'darwin':
        return 'open';
      case 'linux':
        return 'xdg-open';
      default:
        return 'xdg-open';
    }
  }

  async cleanup() {
    try {
      logger.info('Cleaning up URL message handler');
      
      // 清理系统通知器
      if (this.systemNotifier) {
        // SystemNotifier 没有cleanup方法，所以只是置空
        this.systemNotifier = null;
      }

      logger.info('URL message handler cleaned up');
    } catch (error) {
      logger.error('Error cleaning up URL message handler:', error);
    }
  }

  getStats() {
    return {
      handlerType: 'UrlMessageHandler',
      browserCommand: this.browserCommand,
      notificationsEnabled: !!this.systemNotifier
    };
  }
}

module.exports = UrlMessageHandler;

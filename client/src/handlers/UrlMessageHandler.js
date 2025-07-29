/**
 * URL消息处理器
 * 负责处理URL类型的消息
 */

const BaseMessageHandler = require('../utils/BaseMessageHandler');
const ServiceManager = require('../utils/ServiceManager');
const ContentValidator = require('../utils/ContentValidator');
const SystemUtils = require('../utils/SystemUtils');

class UrlMessageHandler extends BaseMessageHandler {
  constructor(config) {
    super(config, 'UrlMessageHandler');
    this.serviceManager = ServiceManager.getInstance(config);
    this.contentValidator = new ContentValidator(config);
    this.systemUtils = new SystemUtils();
  }

  async doInitialize() {
    // 初始化服务
    const services = await this.serviceManager.initializeServices(['clipboard', 'systemNotifier']);

    // 注册服务到基类
    if (services.clipboard) {
      this.registerService('clipboard', services.clipboard);
    }

    if (services.systemNotifier) {
      this.registerService('systemNotifier', services.systemNotifier);
    }
  }

  async doProcess(message) {
    // 验证URL格式
    const validationResult = this.contentValidator.validateUrl(message.content);
    if (!validationResult.isValid) {
      throw new Error(`URL validation failed: ${validationResult.errors.join(', ')}`);
    }

    const normalizedUrl = validationResult.normalizedUrl;

    // 并行执行所有操作以提高性能
    const operations = [];

    // 1. 复制URL到剪贴板（快速操作）
    const clipboardService = this.getService('clipboard');
    if (clipboardService) {
      operations.push(
        this.callService('clipboard', 'writeText', normalizedUrl)
          .then(() => this.logger.debug('Clipboard write completed'))
          .catch(err => this.logger.error('Clipboard write failed:', err))
      );
    }

    // 2. 立即启动浏览器（不等待通知完成）
    operations.push(
      this.systemUtils.openInBrowser(normalizedUrl)
        .then(() => this.logger.debug('Browser launch completed'))
        .catch(err => this.logger.error('Browser launch failed:', err))
    );

    // 3. 异步发送通知（不阻塞其他操作）
    const systemNotifier = this.getService('systemNotifier');
    if (systemNotifier) {
      operations.push(
        this.sendNotificationAsync(normalizedUrl)
          .then(() => this.logger.debug('Notification sent completed'))
          .catch(err => this.logger.error('Notification failed:', err))
      );
    }

    // 等待所有操作完成
    await Promise.allSettled(operations);
  }

  /**
   * 异步发送通知，不阻塞其他操作
   */
  async sendNotificationAsync(url) {
    try {
      // 使用setImmediate确保通知发送不阻塞主流程
      setImmediate(() => {
        // 完全异步执行，不等待结果
        this.callService('systemNotifier', 'notify',
          'M-SYNC - URL消息',
          `收到新的URL: ${url}`,
          {
            icon: 'browser',
            url: url
          }
        ).catch(error => {
          this.logger.error('Async notification failed:', error);
        });
      });

      // 立即返回，不等待通知完成
      return Promise.resolve();
    } catch (error) {
      this.logger.error('Failed to setup async notification:', error);
      return Promise.resolve();
    }
  }

  async doCleanup() {
    // 清理服务管理器
    if (this.serviceManager) {
      await this.serviceManager.cleanup();
    }
  }
}

module.exports = UrlMessageHandler;

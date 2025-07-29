/**
 * 文本消息处理器
 * 处理TEXT和CODE类型的消息，将内容复制到剪贴板
 */

const BaseMessageHandler = require('../utils/BaseMessageHandler');
const ServiceManager = require('../utils/ServiceManager');
const ContentValidator = require('../utils/ContentValidator');

class TextMessageHandler extends BaseMessageHandler {
  constructor(config) {
    super(config, 'TextMessageHandler');
    this.serviceManager = ServiceManager.getInstance(config);
    this.contentValidator = new ContentValidator(config);
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
    // 验证消息内容
    const validationResult = this.validateContent(message.content, message.messageType);
    if (!validationResult.isValid) {
      throw new Error(`Content validation failed: ${validationResult.errors.join(', ')}`);
    }

    // 使用验证后的内容
    const processedContent = validationResult.processedContent;

    // 复制到剪贴板
    await this.callService('clipboard', 'writeText', processedContent);

    // 异步发送系统通知，不阻塞主流程
    const systemNotifier = this.getService('systemNotifier');
    if (systemNotifier) {
      this.sendNotificationAsync(message, processedContent);
    }
  }

  validateContent(content, messageType) {
    // 根据消息类型选择验证方法
    if (messageType === 'CODE') {
      return this.contentValidator.validateCode(content);
    } else {
      return this.contentValidator.validateText(content);
    }
  }

  sendNotificationAsync(message, processedContent) {
    try {
      const title = message.messageType === 'CODE' ? '代码已同步' : '文本已同步';
      const body = this.contentValidator.truncateContent(processedContent, 100);

      // 使用setImmediate确保通知发送不阻塞主流程
      setImmediate(() => {
        this.callService('systemNotifier', 'notify',
          title,
          `内容已复制到剪贴板：${body}`,
          { icon: 'clipboard' }
        ).catch(error => {
          this.logger.warn('Async notification failed:', error);
        });
      });

    } catch (error) {
      this.logger.warn('Failed to setup async notification:', error);
    }
  }

  async doCleanup() {
    // 清理服务管理器
    if (this.serviceManager) {
      await this.serviceManager.cleanup();
    }
  }
}

module.exports = TextMessageHandler;

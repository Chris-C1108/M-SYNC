/**
 * 系统通知管理器
 * 负责发送系统通知
 */

const logger = require('../utils/logger').createLogger('SystemNotifier');

class SystemNotifier {
  constructor(config = {}) {
    this.config = config;
    this.enabled = config.enabled !== false;
    this.timeout = config.timeout || 5000;
    this.sound = config.sound !== false;
    this.initialized = false;
  }

  /**
   * 初始化通知器
   */
  async initialize() {
    try {
      logger.info('Initializing system notifier');

      // 检查通知权限
      const hasPermission = await this.checkPermission();
      if (!hasPermission) {
        logger.warn('No notification permission, requesting...');
        await this.requestPermission();
      }

      this.initialized = true;
      logger.info('System notifier initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize system notifier:', error);
      throw error;
    }
  }

  /**
   * 发送通知
   */
  async notify(title, message, options = {}) {
    try {
      if (!this.enabled) {
        logger.debug('Notifications disabled, skipping notification');
        return false;
      }

      logger.info('Sending notification', { title, message });

      // 在控制台显示通知（简单实现）
      console.log(`\n🔔 ${title}`);
      console.log(`   ${message}`);
      
      if (options.url) {
        console.log(`   🔗 ${options.url}`);
      }

      // 在实际实现中，这里会调用系统通知API
      // 例如：Windows Toast通知、macOS通知中心、Linux桌面通知等
      
      return true;
    } catch (error) {
      logger.error('Failed to send notification:', error);
      return false;
    }
  }

  /**
   * 发送文本消息通知
   */
  async notifyTextMessage(content) {
    return await this.notify(
      'M-SYNC - 文本消息',
      `收到新的文本消息: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`,
      { type: 'text' }
    );
  }

  /**
   * 发送URL消息通知
   */
  async notifyUrlMessage(url) {
    return await this.notify(
      'M-SYNC - URL消息',
      `收到新的URL: ${url}`,
      { type: 'url', url }
    );
  }

  /**
   * 发送代码消息通知
   */
  async notifyCodeMessage(content) {
    return await this.notify(
      'M-SYNC - 代码消息',
      `收到新的代码片段: ${content.substring(0, 30)}${content.length > 30 ? '...' : ''}`,
      { type: 'code' }
    );
  }

  /**
   * 发送错误通知
   */
  async notifyError(title, error) {
    return await this.notify(
      `M-SYNC - ${title}`,
      `错误: ${error.message || error}`,
      { type: 'error' }
    );
  }

  /**
   * 发送成功通知
   */
  async notifySuccess(title, message) {
    return await this.notify(
      `M-SYNC - ${title}`,
      message,
      { type: 'success' }
    );
  }

  /**
   * 检查通知权限
   */
  async checkPermission() {
    // 在实际实现中，这里会检查系统通知权限
    return true;
  }

  /**
   * 请求通知权限
   */
  async requestPermission() {
    // 在实际实现中，这里会请求系统通知权限
    return true;
  }

  /**
   * 设置通知配置
   */
  setConfig(config) {
    this.config = { ...this.config, ...config };
    this.enabled = this.config.enabled !== false;
    this.timeout = this.config.timeout || 5000;
    this.sound = this.config.sound !== false;
    
    logger.info('Notification config updated', this.config);
  }

  /**
   * 获取当前配置
   */
  getConfig() {
    return {
      enabled: this.enabled,
      timeout: this.timeout,
      sound: this.sound,
      ...this.config
    };
  }
}

module.exports = SystemNotifier;

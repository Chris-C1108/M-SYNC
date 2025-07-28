/**
 * 剪贴板管理器
 * 提供跨平台的剪贴板操作功能
 */

const clipboardy = require('clipboardy');
const logger = require('../utils/logger').components.clipboard;

class ClipboardManager {
  constructor(config) {
    this.config = config;
    this.isAvailable = false;
    this.timeout = config.get('systemIntegration.clipboard.timeout') || 1000;
  }

  async initialize() {
    try {
      logger.info('Initializing clipboard manager');

      // 检查剪贴板可用性
      await this.checkAvailability();

      if (this.isAvailable) {
        logger.info('Clipboard manager initialized successfully');
      } else {
        logger.warn('Clipboard not available, manager initialized in disabled mode');
      }

    } catch (error) {
      logger.error('Failed to initialize clipboard manager:', error);
      this.isAvailable = false;
    }
  }

  async checkAvailability() {
    try {
      // 尝试读取剪贴板内容来测试可用性
      await Promise.race([
        clipboardy.read(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), this.timeout)
        )
      ]);
      
      this.isAvailable = true;
      logger.info('Clipboard access verified');

    } catch (error) {
      this.isAvailable = false;
      logger.warn('Clipboard access failed:', error.message);
      
      // 在Linux上提供额外的诊断信息
      if (process.platform === 'linux') {
        logger.info('Linux clipboard troubleshooting: ensure xclip or xsel is installed and DISPLAY is set');
      }
    }
  }

  async writeText(text) {
    if (!this.isAvailable) {
      throw new Error('Clipboard is not available');
    }

    try {
      logger.debug('Writing text to clipboard', {
        textLength: text.length
      });

      await Promise.race([
        clipboardy.write(text),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Clipboard write timeout')), this.timeout)
        )
      ]);

      logger.info('Text written to clipboard successfully', {
        textLength: text.length
      });

    } catch (error) {
      logger.error('Failed to write text to clipboard:', error);
      throw new Error(`Clipboard write failed: ${error.message}`);
    }
  }

  async readText() {
    if (!this.isAvailable) {
      throw new Error('Clipboard is not available');
    }

    try {
      logger.debug('Reading text from clipboard');

      const text = await Promise.race([
        clipboardy.read(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Clipboard read timeout')), this.timeout)
        )
      ]);

      logger.debug('Text read from clipboard successfully', {
        textLength: text.length
      });

      return text;

    } catch (error) {
      logger.error('Failed to read text from clipboard:', error);
      throw new Error(`Clipboard read failed: ${error.message}`);
    }
  }

  async clear() {
    if (!this.isAvailable) {
      throw new Error('Clipboard is not available');
    }

    try {
      logger.debug('Clearing clipboard');

      await Promise.race([
        clipboardy.write(''),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Clipboard clear timeout')), this.timeout)
        )
      ]);

      logger.info('Clipboard cleared successfully');

    } catch (error) {
      logger.error('Failed to clear clipboard:', error);
      throw new Error(`Clipboard clear failed: ${error.message}`);
    }
  }

  getStatus() {
    return {
      isAvailable: this.isAvailable,
      platform: process.platform,
      timeout: this.timeout
    };
  }

  async cleanup() {
    try {
      logger.info('Cleaning up clipboard manager');
      // 剪贴板管理器通常不需要特殊的清理操作
      logger.info('Clipboard manager cleaned up');
    } catch (error) {
      logger.error('Error cleaning up clipboard manager:', error);
    }
  }
}

module.exports = ClipboardManager;

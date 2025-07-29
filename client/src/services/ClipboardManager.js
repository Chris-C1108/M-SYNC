/**
 * 剪贴板管理器
 * 提供跨平台的剪贴板操作功能
 */

const clipboardy = require('clipboardy').default || require('clipboardy');
const logger = require('../utils/logger').components.clipboard;
const ClipboardQueue = require('../utils/ClipboardQueue');

class ClipboardManager {
  constructor(config) {
    this.config = config;
    this.isAvailable = false;
    this.timeout = config.get('systemIntegration.clipboard.timeout') || 1000;
    this.clipboardQueue = ClipboardQueue.getInstance();
  }

  async initialize() {
    try {
      logger.info('Initializing clipboard manager');

      // 检查剪贴板可用性
      await this.checkAvailability();

      if (this.isAvailable) {
        logger.info('Clipboard manager initialized successfully');
      } else {
        logger.warn('Initial clipboard check failed, attempting recovery...');

        // 尝试恢复剪贴板访问
        const recovered = await this.attemptRecovery();
        if (recovered) {
          logger.info('Clipboard access recovered successfully');
        } else {
          logger.warn('Clipboard not available, manager initialized in disabled mode');
        }
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

  /**
   * 尝试恢复剪贴板访问
   */
  async attemptRecovery() {
    logger.info('Attempting clipboard recovery...');

    const recoveryMethods = [
      () => this.recoverByWrite(),
      () => this.recoverByDelay(),
      () => this.recoverByReset()
    ];

    for (let i = 0; i < recoveryMethods.length; i++) {
      try {
        logger.debug(`Trying recovery method ${i + 1}/${recoveryMethods.length}`);
        await recoveryMethods[i]();

        // 验证恢复是否成功
        await this.checkAvailability();
        if (this.isAvailable) {
          logger.info(`Clipboard recovery successful using method ${i + 1}`);
          return true;
        }
      } catch (error) {
        logger.debug(`Recovery method ${i + 1} failed:`, error.message);
      }
    }

    logger.warn('All clipboard recovery methods failed');
    return false;
  }

  /**
   * 通过写入测试内容恢复剪贴板
   */
  async recoverByWrite() {
    logger.debug('Attempting recovery by writing test content');
    await clipboardy.write('M-SYNC clipboard test');
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * 通过延迟重试恢复剪贴板
   */
  async recoverByDelay() {
    logger.debug('Attempting recovery by delay retry');
    await new Promise(resolve => setTimeout(resolve, 500));
    await clipboardy.read();
  }

  /**
   * 通过重置状态恢复剪贴板
   */
  async recoverByReset() {
    logger.debug('Attempting recovery by state reset');
    // 在Windows上，有时需要先写入再读取来重置状态
    if (process.platform === 'win32') {
      await clipboardy.write('');
      await new Promise(resolve => setTimeout(resolve, 200));
      await clipboardy.write('M-SYNC recovery test');
      await new Promise(resolve => setTimeout(resolve, 100));
      await clipboardy.read();
    }
  }

  async writeText(text) {
    if (!this.isAvailable) {
      throw new Error('Clipboard is not available');
    }

    // 使用队列确保剪贴板操作不会冲突
    return await this.clipboardQueue.enqueue(
      async () => {
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

        return true;
      },
      {
        operation: 'writeText',
        textLength: text.length,
        timestamp: new Date().toISOString()
      }
    );
  }

  async readText() {
    if (!this.isAvailable) {
      throw new Error('Clipboard is not available');
    }

    // 使用队列确保剪贴板操作不会冲突
    return await this.clipboardQueue.enqueue(
      async () => {
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
      },
      {
        operation: 'readText',
        timestamp: new Date().toISOString()
      }
    );
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

  /**
   * 获取剪贴板队列统计信息
   */
  getQueueStats() {
    return this.clipboardQueue.getStats();
  }

  /**
   * 获取剪贴板队列状态
   */
  getQueueStatus() {
    return this.clipboardQueue.getQueueStatus();
  }

  async cleanup() {
    try {
      logger.info('Cleaning up clipboard manager');

      // 清理剪贴板队列
      const queueStats = this.clipboardQueue.getStats();
      logger.info('Clipboard queue final stats:', queueStats);

      logger.info('Clipboard manager cleaned up');
    } catch (error) {
      logger.error('Error cleaning up clipboard manager:', error);
    }
  }
}

module.exports = ClipboardManager;

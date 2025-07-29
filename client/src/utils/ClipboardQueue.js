/**
 * 剪贴板访问队列管理器
 * 解决多个消息同时访问剪贴板导致的竞争问题
 */

const logger = require('./logger').createLogger('ClipboardQueue');

class ClipboardQueue {
  // 单例实例
  static instance = null;
  
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.maxRetries = 3;
    this.retryDelay = 100; // 100ms
    this.operationTimeout = 5000; // 5秒超时
    
    // 统计信息
    this.stats = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      retriedOperations: 0,
      averageWaitTime: 0
    };
  }

  /**
   * 获取ClipboardQueue单例实例
   */
  static getInstance() {
    if (!ClipboardQueue.instance) {
      ClipboardQueue.instance = new ClipboardQueue();
      logger.info('ClipboardQueue singleton instance created');
    }
    return ClipboardQueue.instance;
  }

  /**
   * 添加剪贴板操作到队列
   * @param {Function} operation - 剪贴板操作函数
   * @param {Object} context - 操作上下文信息
   * @returns {Promise} - 操作结果
   */
  async enqueue(operation, context = {}) {
    return new Promise((resolve, reject) => {
      const queueItem = {
        id: this.generateOperationId(),
        operation,
        context,
        resolve,
        reject,
        retries: 0,
        enqueuedAt: Date.now(),
        startedAt: null,
        completedAt: null
      };

      this.queue.push(queueItem);
      this.stats.totalOperations++;

      logger.debug(`Operation enqueued`, {
        operationId: queueItem.id,
        queueLength: this.queue.length,
        context: context
      });

      // 如果队列没有在处理，立即开始处理
      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  /**
   * 处理队列中的操作
   */
  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    logger.debug(`Starting queue processing, ${this.queue.length} operations pending`);

    while (this.queue.length > 0) {
      const queueItem = this.queue.shift();
      await this.executeOperation(queueItem);
    }

    this.isProcessing = false;
    logger.debug('Queue processing completed');
  }

  /**
   * 执行单个剪贴板操作
   * @param {Object} queueItem - 队列项
   */
  async executeOperation(queueItem) {
    queueItem.startedAt = Date.now();
    const waitTime = queueItem.startedAt - queueItem.enqueuedAt;
    
    // 更新平均等待时间
    this.updateAverageWaitTime(waitTime);

    logger.debug(`Executing operation`, {
      operationId: queueItem.id,
      waitTime: waitTime,
      retries: queueItem.retries
    });

    try {
      // 设置操作超时
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Clipboard operation timeout after ${this.operationTimeout}ms`));
        }, this.operationTimeout);
      });

      // 执行操作
      const result = await Promise.race([
        queueItem.operation(),
        timeoutPromise
      ]);

      queueItem.completedAt = Date.now();
      this.stats.successfulOperations++;

      logger.debug(`Operation completed successfully`, {
        operationId: queueItem.id,
        executionTime: queueItem.completedAt - queueItem.startedAt,
        totalTime: queueItem.completedAt - queueItem.enqueuedAt
      });

      queueItem.resolve(result);

    } catch (error) {
      logger.warn(`Operation failed`, {
        operationId: queueItem.id,
        error: error.message,
        retries: queueItem.retries
      });

      // 检查是否需要重试
      if (queueItem.retries < this.maxRetries) {
        await this.retryOperation(queueItem, error);
      } else {
        // 重试次数用完，操作失败
        queueItem.completedAt = Date.now();
        this.stats.failedOperations++;

        logger.error(`Operation failed after ${queueItem.retries} retries`, {
          operationId: queueItem.id,
          finalError: error.message,
          totalTime: queueItem.completedAt - queueItem.enqueuedAt
        });

        queueItem.reject(new Error(`Clipboard operation failed after ${queueItem.retries} retries: ${error.message}`));
      }
    }
  }

  /**
   * 重试操作
   * @param {Object} queueItem - 队列项
   * @param {Error} error - 上次执行的错误
   */
  async retryOperation(queueItem, error) {
    queueItem.retries++;
    this.stats.retriedOperations++;

    logger.info(`Retrying operation`, {
      operationId: queueItem.id,
      retryCount: queueItem.retries,
      maxRetries: this.maxRetries,
      previousError: error.message
    });

    // 等待重试延迟
    await new Promise(resolve => setTimeout(resolve, this.retryDelay * queueItem.retries));

    // 重新执行操作
    await this.executeOperation(queueItem);
  }

  /**
   * 更新平均等待时间
   * @param {number} waitTime - 本次等待时间
   */
  updateAverageWaitTime(waitTime) {
    const totalOperations = this.stats.successfulOperations + this.stats.failedOperations + 1;
    this.stats.averageWaitTime = 
      (this.stats.averageWaitTime * (totalOperations - 1) + waitTime) / totalOperations;
  }

  /**
   * 生成操作ID
   * @returns {string} - 唯一操作ID
   */
  generateOperationId() {
    return `clipboard_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取队列统计信息
   * @returns {Object} - 统计信息
   */
  getStats() {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      totalOperations: this.stats.totalOperations,
      successfulOperations: this.stats.successfulOperations,
      failedOperations: this.stats.failedOperations,
      retriedOperations: this.stats.retriedOperations,
      successRate: this.stats.totalOperations > 0 ? 
        (this.stats.successfulOperations / this.stats.totalOperations * 100).toFixed(2) + '%' : '0%',
      averageWaitTime: Math.round(this.stats.averageWaitTime),
      retryRate: this.stats.totalOperations > 0 ? 
        (this.stats.retriedOperations / this.stats.totalOperations * 100).toFixed(2) + '%' : '0%'
    };
  }

  /**
   * 清空队列（紧急情况使用）
   */
  clearQueue() {
    const clearedCount = this.queue.length;
    
    // 拒绝所有待处理的操作
    this.queue.forEach(queueItem => {
      queueItem.reject(new Error('Queue cleared'));
    });
    
    this.queue = [];
    this.isProcessing = false;
    
    logger.warn(`Queue cleared, ${clearedCount} operations cancelled`);
    return clearedCount;
  }

  /**
   * 获取队列状态信息
   */
  getQueueStatus() {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      pendingOperations: this.queue.map(item => ({
        id: item.id,
        context: item.context,
        enqueuedAt: item.enqueuedAt,
        waitTime: Date.now() - item.enqueuedAt,
        retries: item.retries
      }))
    };
  }
}

module.exports = ClipboardQueue;

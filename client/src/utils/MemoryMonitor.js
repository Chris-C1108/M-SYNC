/**
 * 内存监控工具
 * 监控系统内存使用情况并提供优化建议
 */

const logger = require('./logger').createLogger('MemoryMonitor');

class MemoryMonitor {
  constructor(options = {}) {
    this.options = {
      checkInterval: options.checkInterval || 30000, // 30秒检查一次
      warningThreshold: options.warningThreshold || 100 * 1024 * 1024, // 100MB
      criticalThreshold: options.criticalThreshold || 200 * 1024 * 1024, // 200MB
      maxHistoryEntries: options.maxHistoryEntries || 100,
      enableAutoCleanup: options.enableAutoCleanup !== false, // 默认启用
      ...options
    };
    
    this.memoryHistory = [];
    this.isMonitoring = false;
    this.monitoringInterval = null;
    this.cleanupCallbacks = new Set();
    
    // 绑定进程退出事件
    process.on('exit', () => this.stop());
    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());
  }

  /**
   * 开始内存监控
   */
  start() {
    if (this.isMonitoring) {
      logger.warn('Memory monitoring is already running');
      return;
    }

    logger.info('Starting memory monitoring', {
      checkInterval: this.options.checkInterval,
      warningThreshold: Math.round(this.options.warningThreshold / 1024 / 1024) + 'MB',
      criticalThreshold: Math.round(this.options.criticalThreshold / 1024 / 1024) + 'MB'
    });

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, this.options.checkInterval);

    // 立即执行一次检查
    this.checkMemoryUsage();
  }

  /**
   * 停止内存监控
   */
  stop() {
    if (!this.isMonitoring) {
      return;
    }

    logger.info('Stopping memory monitoring');
    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * 检查内存使用情况
   */
  checkMemoryUsage() {
    try {
      const memUsage = process.memoryUsage();
      const timestamp = Date.now();
      
      // 记录内存使用历史
      this.recordMemoryUsage(memUsage, timestamp);
      
      // 检查是否超过阈值
      if (memUsage.heapUsed > this.options.criticalThreshold) {
        this.handleCriticalMemoryUsage(memUsage);
      } else if (memUsage.heapUsed > this.options.warningThreshold) {
        this.handleWarningMemoryUsage(memUsage);
      }
      
    } catch (error) {
      logger.error('Error during memory usage check:', error);
    }
  }

  /**
   * 记录内存使用历史
   */
  recordMemoryUsage(memUsage, timestamp) {
    this.memoryHistory.push({
      timestamp,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss
    });

    // 限制历史记录数量
    if (this.memoryHistory.length > this.options.maxHistoryEntries) {
      this.memoryHistory.shift();
    }
  }

  /**
   * 处理警告级别的内存使用
   */
  handleWarningMemoryUsage(memUsage) {
    logger.warn('Memory usage warning', {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
      external: Math.round(memUsage.external / 1024 / 1024) + 'MB',
      rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB'
    });
  }

  /**
   * 处理严重级别的内存使用
   */
  async handleCriticalMemoryUsage(memUsage) {
    logger.error('Critical memory usage detected', {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
      external: Math.round(memUsage.external / 1024 / 1024) + 'MB',
      rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB'
    });

    if (this.options.enableAutoCleanup) {
      await this.performAutoCleanup();
    }
  }

  /**
   * 执行自动清理
   */
  async performAutoCleanup() {
    try {
      logger.info('Performing automatic memory cleanup');
      
      // 调用所有注册的清理回调
      const cleanupPromises = Array.from(this.cleanupCallbacks).map(callback => {
        try {
          return Promise.resolve(callback());
        } catch (error) {
          logger.error('Error in cleanup callback:', error);
          return Promise.resolve();
        }
      });

      await Promise.allSettled(cleanupPromises);
      
      // 强制垃圾回收
      if (global.gc) {
        global.gc();
        logger.info('Forced garbage collection completed');
      } else {
        logger.warn('Garbage collection not available (run with --expose-gc)');
      }
      
      // 检查清理效果
      const afterMemUsage = process.memoryUsage();
      logger.info('Memory cleanup completed', {
        heapUsedAfter: Math.round(afterMemUsage.heapUsed / 1024 / 1024) + 'MB'
      });
      
    } catch (error) {
      logger.error('Error during automatic memory cleanup:', error);
    }
  }

  /**
   * 注册清理回调函数
   */
  registerCleanupCallback(callback) {
    if (typeof callback !== 'function') {
      throw new Error('Cleanup callback must be a function');
    }
    
    this.cleanupCallbacks.add(callback);
    logger.debug('Cleanup callback registered');
  }

  /**
   * 取消注册清理回调函数
   */
  unregisterCleanupCallback(callback) {
    this.cleanupCallbacks.delete(callback);
    logger.debug('Cleanup callback unregistered');
  }

  /**
   * 获取内存使用统计
   */
  getMemoryStats() {
    const currentMemUsage = process.memoryUsage();
    
    // 计算内存使用趋势
    let trend = 'stable';
    if (this.memoryHistory.length >= 2) {
      const recent = this.memoryHistory.slice(-5); // 最近5次记录
      const avgRecent = recent.reduce((sum, entry) => sum + entry.heapUsed, 0) / recent.length;
      const older = this.memoryHistory.slice(-10, -5); // 之前5次记录
      
      if (older.length > 0) {
        const avgOlder = older.reduce((sum, entry) => sum + entry.heapUsed, 0) / older.length;
        const changePercent = ((avgRecent - avgOlder) / avgOlder) * 100;
        
        if (changePercent > 10) {
          trend = 'increasing';
        } else if (changePercent < -10) {
          trend = 'decreasing';
        }
      }
    }

    return {
      current: {
        heapUsed: Math.round(currentMemUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(currentMemUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(currentMemUsage.external / 1024 / 1024), // MB
        rss: Math.round(currentMemUsage.rss / 1024 / 1024) // MB
      },
      thresholds: {
        warning: Math.round(this.options.warningThreshold / 1024 / 1024), // MB
        critical: Math.round(this.options.criticalThreshold / 1024 / 1024) // MB
      },
      trend,
      historyLength: this.memoryHistory.length,
      isMonitoring: this.isMonitoring,
      cleanupCallbacksCount: this.cleanupCallbacks.size
    };
  }

  /**
   * 获取内存使用历史
   */
  getMemoryHistory(limit = 50) {
    return this.memoryHistory.slice(-limit).map(entry => ({
      timestamp: entry.timestamp,
      heapUsed: Math.round(entry.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(entry.heapTotal / 1024 / 1024), // MB
      external: Math.round(entry.external / 1024 / 1024), // MB
      rss: Math.round(entry.rss / 1024 / 1024) // MB
    }));
  }

  /**
   * 手动触发内存清理
   */
  async triggerCleanup() {
    logger.info('Manual memory cleanup triggered');
    await this.performAutoCleanup();
  }
}

module.exports = MemoryMonitor;

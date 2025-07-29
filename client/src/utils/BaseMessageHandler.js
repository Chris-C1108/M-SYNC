/**
 * 基础消息处理器类
 * 提供所有消息处理器的通用功能和模式
 */

const logger = require('./logger');

class BaseMessageHandler {
  constructor(config, handlerName) {
    this.config = config;
    this.handlerName = handlerName;
    this.logger = logger.createLogger(handlerName);
    this.services = new Map();
    this.initialized = false;
    this.stats = {
      processed: 0,
      errors: 0,
      lastProcessed: null,
      averageProcessingTime: 0
    };

    // 内存优化：限制统计历史记录数量
    this.maxStatsHistory = 100;
    this.statsHistory = [];

    // 内存监控
    this.memoryThreshold = 100 * 1024 * 1024; // 100MB
    this.lastMemoryCheck = Date.now();
    this.memoryCheckInterval = 60000; // 1分钟检查一次
  }

  /**
   * 通用初始化方法
   * 子类应该重写 doInitialize() 方法
   */
  async initialize() {
    if (this.initialized) {
      this.logger.warn('Handler already initialized');
      return;
    }

    try {
      this.logger.info(`Initializing ${this.handlerName}`);
      
      // 调用子类的具体初始化逻辑
      await this.doInitialize();
      
      this.initialized = true;
      this.logger.info(`${this.handlerName} initialized successfully`);

    } catch (error) {
      this.logger.error(`Failed to initialize ${this.handlerName}:`, error);
      throw error;
    }
  }

  /**
   * 子类需要实现的初始化方法
   */
  async doInitialize() {
    throw new Error('doInitialize() must be implemented by subclass');
  }

  /**
   * 通用消息处理方法
   * 包含错误处理、统计信息收集和性能监控
   */
  async process(message) {
    if (!this.initialized) {
      throw new Error(`${this.handlerName} not initialized`);
    }

    const startTime = Date.now();
    
    try {
      this.logger.info('Processing message', {
        messageId: message.messageId,
        messageType: message.messageType,
        handlerName: this.handlerName
      });

      // 调用子类的具体处理逻辑
      await this.doProcess(message);

      // 更新统计信息
      this.updateStats(startTime, false);

      this.logger.info('Message processed successfully', {
        messageId: message.messageId,
        processingTime: `${Date.now() - startTime}ms`
      });

    } catch (error) {
      this.updateStats(startTime, true);
      
      this.logger.error('Failed to process message:', {
        messageId: message.messageId,
        error: error.message,
        handlerName: this.handlerName
      });
      
      throw error;
    }
  }

  /**
   * 子类需要实现的消息处理方法
   */
  async doProcess(message) {
    throw new Error('doProcess() must be implemented by subclass');
  }

  /**
   * 注册服务实例
   */
  registerService(name, serviceInstance) {
    this.services.set(name, serviceInstance);
    this.logger.debug(`Service registered: ${name}`);
  }

  /**
   * 获取服务实例
   */
  getService(name) {
    return this.services.get(name);
  }

  /**
   * 检查配置项是否启用
   */
  isConfigEnabled(configPath) {
    try {
      return this.config.get(configPath) === true;
    } catch (error) {
      this.logger.warn(`Config path not found: ${configPath}`);
      return false;
    }
  }

  /**
   * 安全地调用服务方法
   */
  async callService(serviceName, methodName, ...args) {
    const service = this.getService(serviceName);
    
    if (!service) {
      this.logger.warn(`Service not found: ${serviceName}`);
      return null;
    }

    if (typeof service[methodName] !== 'function') {
      this.logger.warn(`Method not found: ${serviceName}.${methodName}`);
      return null;
    }

    try {
      return await service[methodName](...args);
    } catch (error) {
      this.logger.error(`Service call failed: ${serviceName}.${methodName}`, error);
      throw error;
    }
  }

  /**
   * 更新统计信息
   */
  updateStats(startTime, isError = false) {
    const processingTime = Date.now() - startTime;

    if (isError) {
      this.stats.errors++;
    } else {
      this.stats.processed++;
      this.stats.lastProcessed = new Date().toISOString();

      // 计算平均处理时间
      if (this.stats.processed === 1) {
        this.stats.averageProcessingTime = processingTime;
      } else {
        this.stats.averageProcessingTime =
          (this.stats.averageProcessingTime * (this.stats.processed - 1) + processingTime) / this.stats.processed;
      }

      // 内存优化：限制历史记录数量
      this.statsHistory.push({
        timestamp: Date.now(),
        processingTime,
        isError
      });

      if (this.statsHistory.length > this.maxStatsHistory) {
        this.statsHistory.shift(); // 移除最旧的记录
      }
    }

    // 定期检查内存使用
    this.checkMemoryUsage();
  }

  /**
   * 检查内存使用情况
   */
  checkMemoryUsage() {
    const now = Date.now();
    if (now - this.lastMemoryCheck < this.memoryCheckInterval) {
      return;
    }

    this.lastMemoryCheck = now;
    const memUsage = process.memoryUsage();

    if (memUsage.heapUsed > this.memoryThreshold) {
      this.logger.warn(`High memory usage detected: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`, {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        handlerName: this.handlerName
      });

      // 触发内存清理
      this.performMemoryCleanup();
    }
  }

  /**
   * 执行内存清理
   */
  performMemoryCleanup() {
    try {
      // 清理统计历史记录（保留最近的50%）
      const keepCount = Math.floor(this.maxStatsHistory * 0.5);
      if (this.statsHistory.length > keepCount) {
        this.statsHistory = this.statsHistory.slice(-keepCount);
        this.logger.debug(`Memory cleanup: reduced stats history to ${keepCount} entries`);
      }

      // 强制垃圾回收（如果可用）
      if (global.gc) {
        global.gc();
        this.logger.debug('Memory cleanup: forced garbage collection');
      }

    } catch (error) {
      this.logger.error('Error during memory cleanup:', error);
    }
  }

  /**
   * 获取处理器统计信息
   */
  getStats() {
    const memUsage = process.memoryUsage();
    return {
      handlerName: this.handlerName,
      initialized: this.initialized,
      services: Array.from(this.services.keys()),
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memUsage.external / 1024 / 1024) // MB
      },
      statsHistoryLength: this.statsHistory.length,
      ...this.stats
    };
  }

  /**
   * 通用清理方法
   */
  async cleanup() {
    try {
      this.logger.info(`Cleaning up ${this.handlerName}`);

      // 清理所有注册的服务
      for (const [serviceName, service] of this.services) {
        try {
          if (service && typeof service.cleanup === 'function') {
            await service.cleanup();
            this.logger.debug(`Service cleaned up: ${serviceName}`);
          }
        } catch (error) {
          this.logger.error(`Error cleaning up service ${serviceName}:`, error);
        }
      }

      // 调用子类的清理逻辑
      await this.doCleanup();

      this.services.clear();
      this.initialized = false;
      
      this.logger.info(`${this.handlerName} cleaned up successfully`);

    } catch (error) {
      this.logger.error(`Error cleaning up ${this.handlerName}:`, error);
      throw error;
    }
  }

  /**
   * 子类可以重写的清理方法
   */
  async doCleanup() {
    // 默认实现为空，子类可以重写
  }

  /**
   * 验证处理器是否准备就绪
   */
  isReady() {
    return this.initialized;
  }

  /**
   * 获取处理器信息
   */
  getInfo() {
    return {
      handlerName: this.handlerName,
      initialized: this.initialized,
      servicesCount: this.services.size,
      stats: this.stats
    };
  }
}

module.exports = BaseMessageHandler;

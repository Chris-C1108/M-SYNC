/**
 * 服务管理器
 * 统一管理ClipboardManager和SystemNotifier等服务的生命周期
 */

const ClipboardManager = require('../services/ClipboardManager');
const SystemNotifier = require('../services/SystemNotifier');
const logger = require('./logger').createLogger('ServiceManager');

class ServiceManager {
  // 单例实例
  static instance = null;

  constructor(config) {
    this.config = config;
    this.services = new Map();
    this.serviceConfigs = {
      clipboard: {
        class: ClipboardManager,
        configPath: 'systemIntegration.clipboard.enabled',
        singleton: true
      },
      systemNotifier: {
        class: SystemNotifier,
        configPath: 'systemIntegration.notifications.enabled',
        singleton: true
      }
    };
  }

  /**
   * 获取ServiceManager单例实例
   */
  static getInstance(config) {
    if (!ServiceManager.instance) {
      ServiceManager.instance = new ServiceManager(config);
      logger.info('ServiceManager singleton instance created');
    }
    return ServiceManager.instance;
  }

  /**
   * 获取或创建服务实例
   */
  async getService(serviceName) {
    // 检查是否已有实例
    if (this.services.has(serviceName)) {
      return this.services.get(serviceName);
    }

    // 检查服务配置
    const serviceConfig = this.serviceConfigs[serviceName];
    if (!serviceConfig) {
      throw new Error(`Unknown service: ${serviceName}`);
    }

    // 检查是否启用
    if (!this.isServiceEnabled(serviceName)) {
      logger.info(`Service disabled: ${serviceName}`);
      return null;
    }

    // 创建服务实例
    try {
      logger.info(`Creating service instance: ${serviceName}`);
      
      const ServiceClass = serviceConfig.class;
      const serviceInstance = new ServiceClass(this.config);
      
      // 初始化服务
      if (typeof serviceInstance.initialize === 'function') {
        await serviceInstance.initialize();
      }

      // 缓存实例（如果是单例）
      if (serviceConfig.singleton) {
        this.services.set(serviceName, serviceInstance);
      }

      logger.info(`Service created successfully: ${serviceName}`);
      return serviceInstance;

    } catch (error) {
      logger.error(`Failed to create service ${serviceName}:`, error);
      throw error;
    }
  }

  /**
   * 检查服务是否启用
   */
  isServiceEnabled(serviceName) {
    const serviceConfig = this.serviceConfigs[serviceName];
    if (!serviceConfig || !serviceConfig.configPath) {
      return true; // 默认启用
    }

    try {
      return this.config.get(serviceConfig.configPath) === true;
    } catch (error) {
      logger.warn(`Config path not found: ${serviceConfig.configPath}`);
      return false;
    }
  }

  /**
   * 获取剪贴板管理器
   */
  async getClipboardManager() {
    return await this.getService('clipboard');
  }

  /**
   * 获取系统通知器
   */
  async getSystemNotifier() {
    return await this.getService('systemNotifier');
  }

  /**
   * 批量初始化服务
   */
  async initializeServices(serviceNames) {
    const results = {};
    
    for (const serviceName of serviceNames) {
      try {
        results[serviceName] = await this.getService(serviceName);
      } catch (error) {
        logger.error(`Failed to initialize service ${serviceName}:`, error);
        results[serviceName] = null;
      }
    }

    return results;
  }

  /**
   * 检查服务状态
   */
  getServiceStatus(serviceName) {
    const service = this.services.get(serviceName);
    const config = this.serviceConfigs[serviceName];
    
    return {
      name: serviceName,
      exists: !!service,
      enabled: this.isServiceEnabled(serviceName),
      configured: !!config,
      ready: service && typeof service.isReady === 'function' ? service.isReady() : !!service
    };
  }

  /**
   * 获取所有服务状态
   */
  getAllServiceStatus() {
    const status = {};
    
    for (const serviceName of Object.keys(this.serviceConfigs)) {
      status[serviceName] = this.getServiceStatus(serviceName);
    }

    return status;
  }

  /**
   * 重新加载服务
   */
  async reloadService(serviceName) {
    try {
      logger.info(`Reloading service: ${serviceName}`);

      // 清理现有实例
      if (this.services.has(serviceName)) {
        const service = this.services.get(serviceName);
        if (typeof service.cleanup === 'function') {
          await service.cleanup();
        }
        this.services.delete(serviceName);
      }

      // 重新创建
      return await this.getService(serviceName);

    } catch (error) {
      logger.error(`Failed to reload service ${serviceName}:`, error);
      throw error;
    }
  }

  /**
   * 清理所有服务
   */
  async cleanup() {
    try {
      logger.info('Cleaning up all services');

      const cleanupPromises = [];
      
      for (const [serviceName, service] of this.services) {
        if (service && typeof service.cleanup === 'function') {
          cleanupPromises.push(
            service.cleanup().catch(error => {
              logger.error(`Error cleaning up service ${serviceName}:`, error);
            })
          );
        }
      }

      await Promise.allSettled(cleanupPromises);
      this.services.clear();
      
      logger.info('All services cleaned up');

    } catch (error) {
      logger.error('Error during service cleanup:', error);
      throw error;
    }
  }

  /**
   * 获取服务统计信息
   */
  getStats() {
    const memUsage = process.memoryUsage();
    const stats = {
      totalServices: Object.keys(this.serviceConfigs).length,
      activeServices: this.services.size,
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memUsage.external / 1024 / 1024) // MB
      },
      serviceDetails: {}
    };

    for (const [serviceName, service] of this.services) {
      stats.serviceDetails[serviceName] = {
        active: true,
        hasStats: typeof service.getStats === 'function',
        stats: typeof service.getStats === 'function' ? service.getStats() : null
      };
    }

    return stats;
  }

  /**
   * 执行内存清理
   */
  async performMemoryCleanup() {
    try {
      logger.info('Performing ServiceManager memory cleanup');

      // 检查并清理未使用的服务
      const unusedServices = [];
      for (const [serviceName, service] of this.services) {
        // 如果服务有lastUsed属性且超过10分钟未使用
        if (service.lastUsed && Date.now() - service.lastUsed > 600000) {
          unusedServices.push(serviceName);
        }
      }

      // 清理未使用的服务
      for (const serviceName of unusedServices) {
        const service = this.services.get(serviceName);
        if (service && typeof service.cleanup === 'function') {
          await service.cleanup();
        }
        this.services.delete(serviceName);
        logger.debug(`Cleaned up unused service: ${serviceName}`);
      }

      // 强制垃圾回收（如果可用）
      if (global.gc) {
        global.gc();
        logger.debug('ServiceManager: forced garbage collection');
      }

      logger.info(`ServiceManager memory cleanup completed, cleaned ${unusedServices.length} services`);

    } catch (error) {
      logger.error('Error during ServiceManager memory cleanup:', error);
    }
  }

  /**
   * 注册新的服务类型
   */
  registerServiceType(serviceName, serviceConfig) {
    if (this.serviceConfigs[serviceName]) {
      logger.warn(`Service type already registered: ${serviceName}`);
      return;
    }

    this.serviceConfigs[serviceName] = {
      class: serviceConfig.class,
      configPath: serviceConfig.configPath,
      singleton: serviceConfig.singleton !== false // 默认为单例
    };

    logger.info(`Service type registered: ${serviceName}`);
  }

  /**
   * 获取服务实例（不创建）
   */
  getExistingService(serviceName) {
    return this.services.get(serviceName) || null;
  }

  /**
   * 检查服务是否存在
   */
  hasService(serviceName) {
    return this.services.has(serviceName);
  }
}

module.exports = ServiceManager;

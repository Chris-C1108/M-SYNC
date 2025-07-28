/**
 * 服务注册表
 * 提供全局服务访问机制
 */

class ServiceRegistry {
  constructor() {
    this.services = new Map();
  }

  /**
   * 注册服务
   */
  register(name, service) {
    this.services.set(name, service);
  }

  /**
   * 获取服务
   */
  get(name) {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service '${name}' not found`);
    }
    return service;
  }

  /**
   * 检查服务是否存在
   */
  has(name) {
    return this.services.has(name);
  }

  /**
   * 获取所有服务名称
   */
  getServiceNames() {
    return Array.from(this.services.keys());
  }

  /**
   * 清空所有服务
   */
  clear() {
    this.services.clear();
  }
}

// 创建全局实例
const serviceRegistry = new ServiceRegistry();

module.exports = serviceRegistry;

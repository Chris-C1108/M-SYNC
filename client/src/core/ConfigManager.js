/**
 * 配置管理器
 * 负责管理应用程序配置
 */

const config = require('config');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger').createLogger('ConfigManager');

class ConfigManager {
  constructor() {
    this.config = config;
    this.configPath = path.join(process.cwd(), 'config');
    this.userConfigPath = path.join(process.cwd(), 'config', 'local.json');
  }

  /**
   * 获取配置值
   */
  get(key, defaultValue = null) {
    try {
      return this.config.has(key) ? this.config.get(key) : defaultValue;
    } catch (error) {
      logger.warn(`Failed to get config key '${key}':`, error);
      return defaultValue;
    }
  }

  /**
   * 检查配置键是否存在
   */
  has(key) {
    try {
      return this.config.has(key);
    } catch (error) {
      logger.warn(`Failed to check config key '${key}':`, error);
      return false;
    }
  }

  /**
   * 设置配置值（仅在内存中）
   */
  set(key, value) {
    try {
      // 注意：config库不支持运行时设置，这里只是模拟
      const keys = key.split('.');
      let current = this.config;
      
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      logger.debug(`Config set: ${key} = ${JSON.stringify(value)}`);
    } catch (error) {
      logger.error(`Failed to set config key '${key}':`, error);
    }
  }

  /**
   * 获取所有配置
   */
  getAll() {
    try {
      return this.config.util.toObject();
    } catch (error) {
      logger.error('Failed to get all config:', error);
      return {};
    }
  }

  /**
   * 验证必需的配置
   */
  validateRequired(requiredKeys = []) {
    const missing = [];
    
    for (const key of requiredKeys) {
      if (!this.has(key) || !this.get(key)) {
        missing.push(key);
      }
    }
    
    if (missing.length > 0) {
      throw new Error(`Missing required configuration keys: ${missing.join(', ')}`);
    }
    
    return true;
  }

  /**
   * 获取环境特定的配置
   */
  getEnvironmentConfig() {
    const env = process.env.NODE_ENV || 'development';
    return {
      environment: env,
      isDevelopment: env === 'development',
      isProduction: env === 'production',
      isTest: env === 'test'
    };
  }

  /**
   * 保存用户配置到本地文件
   */
  async saveUserConfig(userConfig) {
    try {
      // 确保配置目录存在
      if (!fs.existsSync(this.configPath)) {
        fs.mkdirSync(this.configPath, { recursive: true });
      }

      // 读取现有的用户配置
      let existingConfig = {};
      if (fs.existsSync(this.userConfigPath)) {
        const content = fs.readFileSync(this.userConfigPath, 'utf8');
        existingConfig = JSON.parse(content);
      }

      // 合并配置
      const mergedConfig = { ...existingConfig, ...userConfig };

      // 写入文件
      fs.writeFileSync(this.userConfigPath, JSON.stringify(mergedConfig, null, 2));
      logger.info('User configuration saved successfully');

    } catch (error) {
      logger.error('Failed to save user configuration:', error);
      throw error;
    }
  }

  /**
   * 加载用户配置
   */
  loadUserConfig() {
    try {
      if (fs.existsSync(this.userConfigPath)) {
        const content = fs.readFileSync(this.userConfigPath, 'utf8');
        return JSON.parse(content);
      }
      return {};
    } catch (error) {
      logger.error('Failed to load user configuration:', error);
      return {};
    }
  }

  /**
   * 重置配置到默认值
   */
  resetToDefaults() {
    try {
      if (fs.existsSync(this.userConfigPath)) {
        fs.unlinkSync(this.userConfigPath);
        logger.info('User configuration reset to defaults');
      }
    } catch (error) {
      logger.error('Failed to reset configuration:', error);
      throw error;
    }
  }

  /**
   * 获取配置摘要（用于调试）
   */
  getConfigSummary() {
    return {
      environment: this.getEnvironmentConfig(),
      brokerService: {
        wsEndpoint: this.get('brokerService.wsEndpoint'),
        hasAuthToken: !!this.get('brokerService.authToken'),
        reconnectInterval: this.get('brokerService.reconnectInterval'),
        heartbeatInterval: this.get('brokerService.heartbeatInterval')
      },
      systemIntegration: {
        clipboard: this.get('systemIntegration.clipboard.enabled'),
        browser: this.get('systemIntegration.browser.enabled'),
        notifications: this.get('systemIntegration.notifications.enabled')
      },
      logging: {
        level: this.get('logging.level'),
        console: this.get('logging.console')
      }
    };
  }
}

module.exports = ConfigManager;

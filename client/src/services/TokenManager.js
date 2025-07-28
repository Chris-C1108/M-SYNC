/**
 * Token管理服务
 * 负责Token的验证、获取、存储和刷新
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const fetch = require('node-fetch');
const logger = require('../utils/logger').createLogger('TokenManager');

class TokenManager {
  constructor(config) {
    this.config = config;
    this.tokenFile = path.join(process.cwd(), 'config', 'token.json');
    this.currentToken = null;
    this.tokenInfo = null;
  }

  /**
   * 初始化Token管理器
   */
  async initialize() {
    try {
      await this.loadStoredToken();
      logger.info('Token manager initialized');
    } catch (error) {
      logger.error('Failed to initialize token manager:', error);
      throw error;
    }
  }

  /**
   * 获取有效的访问Token
   * 如果当前Token无效，会自动触发获取流程
   */
  async getValidToken() {
    try {
      // 检查当前Token是否有效
      if (await this.isTokenValid()) {
        return this.currentToken;
      }

      logger.info('Current token is invalid, starting authentication flow');
      
      // 触发自动认证流程
      const newToken = await this.startAuthenticationFlow();
      
      if (newToken) {
        await this.storeToken(newToken);
        return newToken;
      }

      throw new Error('Failed to obtain valid token');

    } catch (error) {
      logger.error('Failed to get valid token:', error);
      throw error;
    }
  }

  /**
   * 验证Token是否有效
   */
  async isTokenValid() {
    try {
      if (!this.currentToken) {
        logger.debug('No token available');
        return false;
      }

      // 检查Token是否过期
      if (this.tokenInfo && this.tokenInfo.expiresAt) {
        const expiryTime = new Date(this.tokenInfo.expiresAt);
        const now = new Date();
        
        if (now >= expiryTime) {
          logger.debug('Token has expired');
          return false;
        }
      }

      // 通过API验证Token
      const isValid = await this.validateTokenWithAPI();
      logger.debug(`Token validation result: ${isValid}`);
      
      return isValid;

    } catch (error) {
      logger.error('Token validation failed:', error);
      return false;
    }
  }

  /**
   * 通过API验证Token
   */
  async validateTokenWithAPI() {
    try {
      const apiEndpoint = this.config.get('brokerService.apiEndpoint') ||
                         this.config.get('brokerService.wsEndpoint').replace('ws://', 'http://').replace('/ws/subscribe', '');

      const response = await fetch(`${apiEndpoint}/api/v1/tokens/current`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.currentToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });

      if (response.status === 200) {
        const data = await response.json();
        if (data.success && data.data) {
          this.tokenInfo = data.data;
          return true;
        }
      }

      return false;

    } catch (error) {
      logger.debug('API token validation failed:', error.message);
      return false;
    }
  }

  /**
   * 启动认证流程
   */
  async startAuthenticationFlow() {
    const AuthenticationFlow = require('./AuthenticationFlow');
    const authFlow = new AuthenticationFlow(this.config);
    
    try {
      logger.info('Starting browser-based authentication flow');
      const tokenData = await authFlow.authenticate();
      
      if (tokenData && tokenData.token) {
        this.tokenInfo = tokenData.tokenInfo;
        return tokenData.token;
      }

      throw new Error('Authentication flow did not return valid token');

    } catch (error) {
      logger.error('Authentication flow failed:', error);
      throw error;
    }
  }

  /**
   * 加载存储的Token
   */
  async loadStoredToken() {
    try {
      const data = await fs.readFile(this.tokenFile, 'utf8');
      const tokenData = JSON.parse(data);
      
      if (tokenData.token && tokenData.encryptionKey) {
        // 解密Token
        this.currentToken = this.decryptToken(tokenData.token, tokenData.encryptionKey);
        this.tokenInfo = tokenData.tokenInfo;
        
        logger.debug('Stored token loaded successfully');
      }

    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.warn('Failed to load stored token:', error);
      }
      this.currentToken = null;
      this.tokenInfo = null;
    }
  }

  /**
   * 存储Token到本地文件
   */
  async storeToken(token, tokenInfo = null) {
    try {
      // 生成加密密钥
      const encryptionKey = crypto.randomBytes(32).toString('hex');
      
      // 加密Token
      const encryptedToken = this.encryptToken(token, encryptionKey);
      
      const tokenData = {
        token: encryptedToken,
        encryptionKey: encryptionKey,
        tokenInfo: tokenInfo || this.tokenInfo,
        createdAt: new Date().toISOString(),
        lastValidated: new Date().toISOString()
      };

      // 确保配置目录存在
      const configDir = path.dirname(this.tokenFile);
      await fs.mkdir(configDir, { recursive: true });

      // 写入文件
      await fs.writeFile(this.tokenFile, JSON.stringify(tokenData, null, 2));
      
      // 设置文件权限（仅所有者可读写）
      await fs.chmod(this.tokenFile, 0o600);

      this.currentToken = token;
      this.tokenInfo = tokenInfo || this.tokenInfo;

      logger.info('Token stored successfully');

    } catch (error) {
      logger.error('Failed to store token:', error);
      throw error;
    }
  }

  /**
   * 加密Token
   */
  encryptToken(token, key) {
    const algorithm = 'aes-256-cbc';
    const iv = crypto.randomBytes(16);
    const keyHash = crypto.createHash('sha256').update(key).digest();

    const cipher = crypto.createCipheriv(algorithm, keyHash, iv);
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * 解密Token
   */
  decryptToken(encryptedToken, key) {
    const algorithm = 'aes-256-cbc';
    const parts = encryptedToken.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const keyHash = crypto.createHash('sha256').update(key).digest();

    const decipher = crypto.createDecipheriv(algorithm, keyHash, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * 清除存储的Token
   */
  async clearToken() {
    try {
      await fs.unlink(this.tokenFile);
      this.currentToken = null;
      this.tokenInfo = null;
      logger.info('Token cleared successfully');
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.error('Failed to clear token:', error);
      }
    }
  }

  /**
   * 获取Token信息
   */
  getTokenInfo() {
    return this.tokenInfo;
  }

  /**
   * 检查是否有存储的Token
   */
  hasStoredToken() {
    return !!this.currentToken;
  }

  /**
   * 强制重新认证
   * 清除现有Token并启动新的认证流程
   */
  async forceReauthentication() {
    try {
      this.logger.info('Starting forced re-authentication');

      // 清除现有Token
      this.currentToken = null;
      this.tokenInfo = null;

      // 删除存储的Token文件
      if (fs.existsSync(this.tokenFilePath)) {
        fs.unlinkSync(this.tokenFilePath);
        this.logger.info('Existing token file deleted');
      }

      // 启动新的认证流程
      return await this.getValidToken();

    } catch (error) {
      this.logger.error('Forced re-authentication failed:', error);
      throw error;
    }
  }
}

module.exports = TokenManager;

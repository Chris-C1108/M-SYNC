/**
 * 浏览器认证流程服务
 * 负责打开浏览器进行用户认证并接收Token
 */

const http = require('http');
const url = require('url');
const open = require('open');
const crypto = require('crypto');
const logger = require('../utils/logger').createLogger('AuthenticationFlow');

class AuthenticationFlow {
  constructor(config) {
    this.config = config;
    this.callbackServer = null;
    this.callbackPort = 0;
    this.authState = null;
    this.authPromise = null;
    this.authResolve = null;
    this.authReject = null;
    this.timeout = 600000; // 10分钟超时
  }

  /**
   * 启动认证流程
   */
  async authenticate() {
    try {
      logger.info('Starting browser authentication flow');

      // 生成认证状态码
      this.authState = crypto.randomBytes(16).toString('hex');

      // 启动回调服务器
      await this.startCallbackServer();

      // 构建认证URL
      const authUrl = this.buildAuthUrl();

      // 打开浏览器
      await this.openBrowser(authUrl);

      // 等待认证完成
      const tokenData = await this.waitForAuthentication();

      logger.info('Browser authentication completed successfully');
      return tokenData;

    } catch (error) {
      logger.error('Browser authentication failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * 启动本地回调服务器
   */
  async startCallbackServer() {
    return new Promise((resolve, reject) => {
      this.callbackServer = http.createServer((req, res) => {
        this.handleCallback(req, res);
      });

      this.callbackServer.on('error', (error) => {
        logger.error('Callback server error:', error);
        reject(error);
      });

      // 监听随机端口
      this.callbackServer.listen(0, 'localhost', () => {
        this.callbackPort = this.callbackServer.address().port;
        logger.info(`Callback server started on port ${this.callbackPort}`);
        resolve();
      });
    });
  }

  /**
   * 构建认证URL
   */
  buildAuthUrl() {
    const baseUrl = this.getWebManagementUrl();
    const callbackUrl = `http://localhost:${this.callbackPort}/callback`;
    
    // 构建登录URL，包含回调参数
    const authUrl = `${baseUrl}/pages/login.html?` + 
      `callback=${encodeURIComponent(callbackUrl)}&` +
      `state=${this.authState}&` +
      `client_type=desktop&` +
      `auto_token=true`;

    logger.debug('Authentication URL:', authUrl);
    return authUrl;
  }

  /**
   * 获取Web管理界面URL
   */
  getWebManagementUrl() {
    const wsEndpoint = this.config.get('brokerService.wsEndpoint');
    
    if (wsEndpoint) {
      // 从WebSocket端点推导HTTP端点
      return wsEndpoint.replace('ws://', 'http://').replace('/ws/subscribe', '');
    }

    // 默认值
    return 'http://localhost:3000';
  }

  /**
   * 打开浏览器
   */
  async openBrowser(authUrl) {
    try {
      logger.info('Opening browser for authentication');
      
      const browserOptions = {
        wait: false,
        newInstance: false
      };

      // 检查系统浏览器集成是否启用
      if (this.config.get('systemIntegration.browser.enabled')) {
        await open(authUrl, browserOptions);
        logger.info('Browser opened successfully');
      } else {
        logger.warn('Browser integration disabled, please manually open:', authUrl);
        console.log('\n🌐 Please open the following URL in your browser to authenticate:');
        console.log(`   ${authUrl}\n`);
      }

    } catch (error) {
      logger.error('Failed to open browser:', error);
      console.log('\n🌐 Please manually open the following URL in your browser:');
      console.log(`   ${authUrl}\n`);
    }
  }

  /**
   * 等待认证完成
   */
  async waitForAuthentication() {
    return new Promise((resolve, reject) => {
      this.authResolve = resolve;
      this.authReject = reject;

      // 设置超时
      const timeoutId = setTimeout(() => {
        this.authReject(new Error('Authentication timeout'));
      }, this.timeout);

      // 清理超时
      this.authPromise = new Promise((res, rej) => {
        this.authResolve = (data) => {
          clearTimeout(timeoutId);
          res(data);
        };
        this.authReject = (error) => {
          clearTimeout(timeoutId);
          rej(error);
        };
      });

      this.authPromise.then(resolve).catch(reject);
    });
  }

  /**
   * 处理回调请求
   */
  handleCallback(req, res) {
    try {
      const parsedUrl = url.parse(req.url, true);
      const query = parsedUrl.query;

      logger.debug('Received callback:', query);

      // 验证状态码
      if (query.state !== this.authState) {
        this.sendErrorResponse(res, 'Invalid state parameter');
        this.authReject(new Error('Invalid authentication state'));
        return;
      }

      // 检查是否有错误
      if (query.error) {
        this.sendErrorResponse(res, `Authentication error: ${query.error}`);
        this.authReject(new Error(`Authentication error: ${query.error}`));
        return;
      }

      // 检查是否有Token
      if (query.token && query.token_info) {
        try {
          const tokenInfo = JSON.parse(decodeURIComponent(query.token_info));
          const tokenData = {
            token: query.token,
            tokenInfo: tokenInfo
          };

          this.sendSuccessResponse(res);
          this.authResolve(tokenData);
          return;

        } catch (error) {
          logger.error('Failed to parse token info:', error);
          this.sendErrorResponse(res, 'Invalid token information');
          this.authReject(new Error('Invalid token information'));
          return;
        }
      }

      // 如果没有Token，返回错误
      this.sendErrorResponse(res, 'No token received');
      this.authReject(new Error('No token received from authentication'));

    } catch (error) {
      logger.error('Callback handling error:', error);
      this.sendErrorResponse(res, 'Internal server error');
      this.authReject(error);
    }
  }

  /**
   * 发送成功响应
   */
  sendSuccessResponse(res) {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>M-SYNC Authentication</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        .success { color: #28a745; }
        .icon { font-size: 48px; margin-bottom: 20px; }
    </style>
</head>
<body>
    <div class="icon">✅</div>
    <h1 class="success">Authentication Successful!</h1>
    <p>You have successfully authenticated with M-SYNC.</p>
    <p>You can now close this browser window and return to the desktop application.</p>
    <script>
        setTimeout(() => {
            window.close();
        }, 3000);
    </script>
</body>
</html>`;

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  }

  /**
   * 发送错误响应
   */
  sendErrorResponse(res, message) {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>M-SYNC Authentication Error</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        .error { color: #dc3545; }
        .icon { font-size: 48px; margin-bottom: 20px; }
    </style>
</head>
<body>
    <div class="icon">❌</div>
    <h1 class="error">Authentication Failed</h1>
    <p>${message}</p>
    <p>Please try again or contact support if the problem persists.</p>
</body>
</html>`;

    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end(html);
  }

  /**
   * 清理资源
   */
  async cleanup() {
    if (this.callbackServer) {
      return new Promise((resolve) => {
        this.callbackServer.close(() => {
          logger.debug('Callback server closed');
          resolve();
        });
      });
    }
  }
}

module.exports = AuthenticationFlow;

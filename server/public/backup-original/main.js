/**
 * M-SYNC Web Interface Main JavaScript
 */

// API基础配置
const API_BASE = '/api/v1';

// 工具函数
const utils = {
  // 显示消息
  showMessage(elementId, message, type = 'info') {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    element.textContent = message;
    element.className = `message ${type}`;
    element.style.display = 'block';
    
    // 自动隐藏成功消息
    if (type === 'success') {
      setTimeout(() => {
        element.style.display = 'none';
      }, 5000);
    }
  },

  // 隐藏消息
  hideMessage(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
      element.style.display = 'none';
    }
  },

  // 复制到剪贴板
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      // 降级方案
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textArea);
      return success;
    }
  },

  // 格式化日期
  formatDate(dateString) {
    if (!dateString) return '未使用';
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN');
  },

  // 获取设备类型显示名称
  getDeviceTypeName(deviceType) {
    const names = {
      'desktop': '桌面客户端',
      'ios_shortcuts': 'iOS快捷指令',
      'mobile': '移动应用',
      'web': 'Web应用',
      'api': 'API调用'
    };
    return names[deviceType] || deviceType;
  },

  // API请求封装
  async apiRequest(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    // 调试日志
    console.log('API Request:', {
      url: url,
      method: config.method || 'GET',
      headers: config.headers,
      body: config.body
    });

    try {
      const response = await fetch(url, config);
      console.log('API Response:', {
        status: response.status,
        statusText: response.statusText,
        url: response.url
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('API Request failed:', error);
      throw error;
    }
  },

  // 带认证的API请求
  async authenticatedRequest(endpoint, options = {}) {
    const token = localStorage.getItem('msync_token');
    if (!token) {
      throw new Error('未登录');
    }

    return this.apiRequest(endpoint, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
      }
    });
  },

  // 检查登录状态
  isLoggedIn() {
    return !!localStorage.getItem('msync_token');
  },

  // 登出
  logout() {
    localStorage.removeItem('msync_token');
    localStorage.removeItem('msync_user');
    window.location.href = '/';
  }
};

// 页面初始化
document.addEventListener('DOMContentLoaded', function() {
  // 检查服务状态
  checkServiceStatus();

  // 根据登录状态更新主页按钮
  updateMainPageButtons();

  // 设置登出链接
  const logoutLink = document.getElementById('logout-link');
  if (logoutLink) {
    logoutLink.addEventListener('click', function(e) {
      e.preventDefault();
      utils.logout();
    });
  }
});

// 检查服务状态
async function checkServiceStatus() {
  const statusElements = {
    service: document.getElementById('service-status'),
    database: document.getElementById('database-status'),
    websocket: document.getElementById('websocket-status'),
    version: document.getElementById('version')
  };

  try {
    const response = await utils.apiRequest('/health');
    
    if (statusElements.service) {
      statusElements.service.textContent = '运行中';
      statusElements.service.className = 'status-value status-online';
    }
    
    if (statusElements.database && response.data.services) {
      const dbStatus = response.data.services.database === 'connected' ? '已连接' : '未连接';
      statusElements.database.textContent = dbStatus;
      statusElements.database.className = `status-value ${response.data.services.database === 'connected' ? 'status-online' : 'status-offline'}`;
    }
    
    if (statusElements.websocket && response.data.services) {
      const wsStatus = response.data.services.websocket === 'running' ? '运行中' : '未运行';
      statusElements.websocket.textContent = wsStatus;
      statusElements.websocket.className = `status-value ${response.data.services.websocket === 'running' ? 'status-online' : 'status-offline'}`;
    }
    
    if (statusElements.version && response.data.version) {
      statusElements.version.textContent = response.data.version;
    }
    
  } catch (error) {
    console.error('Failed to check service status:', error);
    
    if (statusElements.service) {
      statusElements.service.textContent = '连接失败';
      statusElements.service.className = 'status-value status-offline';
    }
    
    if (statusElements.database) {
      statusElements.database.textContent = '未知';
      statusElements.database.className = 'status-value status-offline';
    }
    
    if (statusElements.websocket) {
      statusElements.websocket.textContent = '未知';
      statusElements.websocket.className = 'status-value status-offline';
    }
  }
}

// 客户端Token配置功能
function setupClientTokenConfig(token) {
  const clientSection = document.getElementById('client-token-section');
  const autoConfigBtn = document.getElementById('auto-config-btn');
  const manualConfigBtn = document.getElementById('manual-config-btn');
  const manualDisplay = document.getElementById('manual-token-display');
  const tokenInput = document.getElementById('access-token');
  const copyTokenBtn = document.getElementById('copy-token-btn');

  if (!clientSection) return;

  // 显示客户端配置区域
  clientSection.style.display = 'block';
  
  if (tokenInput) {
    tokenInput.value = token;
  }

  // 自动配置按钮
  if (autoConfigBtn) {
    autoConfigBtn.addEventListener('click', async function() {
      try {
        // 尝试通过本地文件或其他方式自动配置客户端
        await autoConfigureClient(token);
        utils.showMessage('login-message', '客户端配置成功！', 'success');
      } catch (error) {
        console.error('Auto config failed:', error);
        utils.showMessage('login-message', '自动配置失败，请使用手动配置', 'error');
        // 显示手动配置选项
        if (manualDisplay) {
          manualDisplay.style.display = 'block';
        }
      }
    });
  }

  // 手动配置按钮
  if (manualConfigBtn) {
    manualConfigBtn.addEventListener('click', function() {
      if (manualDisplay) {
        manualDisplay.style.display = manualDisplay.style.display === 'none' ? 'block' : 'none';
      }
    });
  }

  // 复制Token按钮
  if (copyTokenBtn) {
    copyTokenBtn.addEventListener('click', async function() {
      const success = await utils.copyToClipboard(token);
      if (success) {
        this.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(() => {
          this.innerHTML = '<i class="fas fa-copy"></i>';
        }, 2000);
      }
    });
  }
}

// 自动配置客户端
async function autoConfigureClient(token) {
  // 尝试多种方式配置客户端
  
  // 方式1: 通过临时文件
  try {
    await utils.apiRequest('/client/auto-config', {
      method: 'POST',
      body: JSON.stringify({ token })
    });
    return;
  } catch (error) {
    console.log('File-based config failed:', error);
  }

  // 方式2: 通过URL scheme (如果支持)
  try {
    const configUrl = `msync://configure?token=${encodeURIComponent(token)}`;
    window.location.href = configUrl;
    
    // 等待一段时间看是否成功
    await new Promise(resolve => setTimeout(resolve, 2000));
    return;
  } catch (error) {
    console.log('URL scheme config failed:', error);
  }

  // 如果都失败了，抛出错误
  throw new Error('All auto-config methods failed');
}

// 更新主页按钮显示
function updateMainPageButtons() {
  const actionButtons = document.querySelector('.action-buttons');
  if (!actionButtons) return;

  if (utils.isLoggedIn()) {
    // 用户已登录，显示Token管理和登出按钮
    actionButtons.innerHTML = `
      <a href="/pages/tokens.html" class="btn btn-primary">
        <i class="fas fa-key"></i> Token管理
      </a>
      <a href="/pages/download.html" class="btn btn-secondary">
        <i class="fas fa-download"></i> 下载客户端
      </a>
      <button onclick="utils.logout()" class="btn btn-secondary">
        <i class="fas fa-sign-out-alt"></i> 退出登录
      </button>
    `;
  } else {
    // 用户未登录，显示登录和注册按钮
    actionButtons.innerHTML = `
      <a href="/pages/login.html" class="btn btn-primary">
        <i class="fas fa-sign-in-alt"></i> 登录
      </a>
      <a href="/pages/register.html" class="btn btn-secondary">
        <i class="fas fa-user-plus"></i> 注册
      </a>
      <a href="/pages/tokens.html" class="btn btn-secondary">
        <i class="fas fa-key"></i> Token管理
      </a>
    `;
  }
}

// 导出工具函数供其他脚本使用
window.MSyncUtils = utils;

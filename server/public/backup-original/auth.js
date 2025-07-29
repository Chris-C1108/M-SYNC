/**
 * M-SYNC Authentication JavaScript
 */

// 页面初始化
document.addEventListener('DOMContentLoaded', function() {
  // 检查桌面客户端认证参数
  checkDesktopAuthParams();

  // 检查是否已登录
  if (MSyncUtils.isLoggedIn() && !window.location.pathname.includes('tokens')) {
    // 如果已登录且不在token页面，重定向到token管理页面
    window.location.href = '/pages/tokens.html';
    return;
  }

  // 初始化登录表单
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    initLoginForm();
  }

  // 初始化注册表单
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    initRegisterForm();
  }
});

// 检查桌面客户端认证参数
function checkDesktopAuthParams() {
  const urlParams = new URLSearchParams(window.location.search);
  const callback = urlParams.get('callback');
  const state = urlParams.get('state');
  const clientType = urlParams.get('client_type');
  const autoToken = urlParams.get('auto_token');

  // 如果是桌面客户端认证请求
  if (callback && state && clientType === 'desktop' && autoToken === 'true') {
    console.log('Desktop client authentication detected');

    // 存储认证参数
    sessionStorage.setItem('desktop_auth_callback', callback);
    sessionStorage.setItem('desktop_auth_state', state);
    sessionStorage.setItem('desktop_auth_mode', 'true');

    // 显示桌面客户端认证提示
    showDesktopAuthNotice();
  }
}

// 显示桌面客户端认证提示
function showDesktopAuthNotice() {
  const notice = document.createElement('div');
  notice.className = 'desktop-auth-notice';
  notice.innerHTML = `
    <div class="notice-content">
      <i class="fas fa-desktop"></i>
      <h3>桌面客户端认证</h3>
      <p>检测到来自M-SYNC桌面客户端的认证请求。</p>
      <p>请登录您的账户以完成认证。</p>
    </div>
  `;

  // 添加样式
  const style = document.createElement('style');
  style.textContent = `
    .desktop-auth-notice {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      margin-bottom: 20px;
      border-radius: 8px;
      text-align: center;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .desktop-auth-notice .notice-content i {
      font-size: 24px;
      margin-bottom: 10px;
      display: block;
    }
    .desktop-auth-notice h3 {
      margin: 10px 0;
      font-size: 18px;
    }
    .desktop-auth-notice p {
      margin: 5px 0;
      opacity: 0.9;
    }
  `;
  document.head.appendChild(style);

  // 插入到页面顶部
  const container = document.querySelector('.auth-container') || document.body;
  container.insertBefore(notice, container.firstChild);
}

// 处理桌面客户端认证
async function handleDesktopClientAuth(userToken) {
  try {
    const callback = sessionStorage.getItem('desktop_auth_callback');
    const state = sessionStorage.getItem('desktop_auth_state');

    if (!callback || !state) {
      throw new Error('Missing desktop authentication parameters');
    }

    // 为桌面客户端创建专用Token
    const tokenResponse = await MSyncUtils.authenticatedRequest('/tokens', {
      method: 'POST',
      body: JSON.stringify({
        tokenName: 'Desktop Client Auto-Generated',
        deviceType: 'desktop',
        permissions: ['message:publish', 'message:read']
      })
    });

    if (!tokenResponse.success || !tokenResponse.data) {
      throw new Error('Failed to create desktop client token');
    }

    const desktopToken = tokenResponse.data.token;
    const tokenInfo = tokenResponse.data;

    // 构建回调URL
    const callbackUrl = new URL(callback);
    callbackUrl.searchParams.set('token', desktopToken);
    callbackUrl.searchParams.set('token_info', encodeURIComponent(JSON.stringify(tokenInfo)));
    callbackUrl.searchParams.set('state', state);

    // 显示成功消息
    const messageElement = 'login-message';
    MSyncUtils.showMessage(messageElement, '桌面客户端Token创建成功！正在传递给客户端...', 'success');

    // 延迟后重定向到回调URL
    setTimeout(() => {
      window.location.href = callbackUrl.toString();
    }, 2000);

    // 清理session storage
    sessionStorage.removeItem('desktop_auth_callback');
    sessionStorage.removeItem('desktop_auth_state');
    sessionStorage.removeItem('desktop_auth_mode');

  } catch (error) {
    console.error('Desktop client authentication failed:', error);
    const messageElement = 'login-message';
    MSyncUtils.showMessage(messageElement, '桌面客户端认证失败: ' + error.message, 'error');
  }
}

// 初始化登录表单
function initLoginForm() {
  const form = document.getElementById('login-form');
  const messageElement = 'login-message';

  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formData = new FormData(form);
    const loginData = {
      username: formData.get('username'),
      password: formData.get('password')
    };

    // 验证输入
    if (!loginData.username || !loginData.password) {
      MSyncUtils.showMessage(messageElement, '请填写用户名和密码', 'error');
      return;
    }

    // 显示加载状态
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    const progressIndicator = document.getElementById('login-progress');

    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 登录中...';
    submitBtn.disabled = true;

    // 显示进度指示器
    if (progressIndicator) {
      progressIndicator.style.display = 'block';
    }

    // 隐藏之前的消息
    MSyncUtils.hideMessage(messageElement);

    try {
      // 调用登录API
      const response = await MSyncUtils.apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify(loginData)
      });

      if (response.success && response.data) {
        // 保存登录信息
        localStorage.setItem('msync_token', response.data.token);
        localStorage.setItem('msync_user', JSON.stringify(response.data.user));

        // 检查是否是桌面客户端认证请求
        const isDesktopAuth = sessionStorage.getItem('desktop_auth_mode') === 'true';

        if (isDesktopAuth) {
          MSyncUtils.showMessage(messageElement, '登录成功！正在为桌面客户端创建Token...', 'success');
          // 为桌面客户端创建专用Token
          await handleDesktopClientAuth(response.data.token);
        } else {
          // 检查是否是客户端配置请求
          const urlParams = new URLSearchParams(window.location.search);
          const isClientConfig = urlParams.get('client') === 'true';

          if (isClientConfig) {
            MSyncUtils.showMessage(messageElement, '登录成功！正在配置客户端...', 'success');
            // 显示客户端配置区域
            setupClientTokenConfig(response.data.token);
          } else {
            MSyncUtils.showMessage(messageElement, '登录成功！正在跳转到Token管理页面...', 'success');
            // 正常登录，跳转到token管理页面
            setTimeout(() => {
              window.location.href = '/pages/tokens.html';
            }, 1500);
          }
        }
      } else {
        MSyncUtils.showMessage(messageElement, response.message || '登录失败', 'error');
      }

    } catch (error) {
      console.error('Login failed:', error);
      MSyncUtils.showMessage(messageElement, error.message || '登录失败，请检查网络连接', 'error');
    } finally {
      // 恢复按钮状态
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;

      // 隐藏进度指示器
      if (progressIndicator) {
        progressIndicator.style.display = 'none';
      }
    }
  });
}

// 初始化注册表单
function initRegisterForm() {
  const form = document.getElementById('register-form');
  const messageElement = 'register-message';

  // 密码确认验证
  const passwordInput = document.getElementById('password');
  const confirmPasswordInput = document.getElementById('confirm-password');

  function validatePasswordMatch() {
    if (confirmPasswordInput.value && passwordInput.value !== confirmPasswordInput.value) {
      confirmPasswordInput.setCustomValidity('密码不匹配');
    } else {
      confirmPasswordInput.setCustomValidity('');
    }
  }

  passwordInput.addEventListener('input', validatePasswordMatch);
  confirmPasswordInput.addEventListener('input', validatePasswordMatch);

  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formData = new FormData(form);
    const registerData = {
      username: formData.get('username'),
      email: formData.get('email'),
      password: formData.get('password'),
      confirmPassword: formData.get('confirmPassword')
    };

    // 验证输入
    if (!registerData.username || !registerData.email || !registerData.password) {
      MSyncUtils.showMessage(messageElement, '请填写所有必填字段', 'error');
      return;
    }

    if (registerData.password !== registerData.confirmPassword) {
      MSyncUtils.showMessage(messageElement, '密码确认不匹配', 'error');
      return;
    }

    if (registerData.password.length < 8) {
      MSyncUtils.showMessage(messageElement, '密码长度至少8个字符', 'error');
      return;
    }

    // 检查服务条款
    const agreeTerms = formData.get('agreeTerms');
    if (!agreeTerms) {
      MSyncUtils.showMessage(messageElement, '请同意服务条款和隐私政策', 'error');
      return;
    }

    // 显示加载状态
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    const progressIndicator = document.getElementById('register-progress');

    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 注册中...';
    submitBtn.disabled = true;

    // 显示进度指示器
    if (progressIndicator) {
      progressIndicator.style.display = 'block';
    }

    // 隐藏之前的消息
    MSyncUtils.hideMessage(messageElement);

    try {
      // 调用注册API
      const response = await MSyncUtils.apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          username: registerData.username,
          email: registerData.email,
          password: registerData.password
        })
      });

      if (response.success && response.data) {
        // 保存登录信息
        localStorage.setItem('msync_token', response.data.token);
        localStorage.setItem('msync_user', JSON.stringify(response.data.user));

        MSyncUtils.showMessage(messageElement, '注册成功！正在跳转到Token管理页面...', 'success');

        // 显示成功区域
        showRegistrationSuccess(response.data.token);

        // 3秒后自动跳转到Token管理页面
        setTimeout(() => {
          window.location.href = '/pages/tokens.html';
        }, 3000);

      } else {
        MSyncUtils.showMessage(messageElement, response.message || '注册失败', 'error');
      }

    } catch (error) {
      console.error('Registration failed:', error);
      MSyncUtils.showMessage(messageElement, error.message || '注册失败，请检查网络连接', 'error');
    } finally {
      // 恢复按钮状态
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;

      // 隐藏进度指示器
      if (progressIndicator) {
        progressIndicator.style.display = 'none';
      }
    }
  });
}

// 显示注册成功区域
function showRegistrationSuccess(token) {
  const successSection = document.getElementById('success-section');
  const tokenInput = document.getElementById('new-access-token');
  const copyBtn = document.getElementById('copy-new-token-btn');

  if (successSection) {
    successSection.style.display = 'block';
    
    if (tokenInput) {
      tokenInput.value = token;
    }

    if (copyBtn) {
      copyBtn.addEventListener('click', async function() {
        const success = await MSyncUtils.copyToClipboard(token);
        if (success) {
          this.innerHTML = '<i class="fas fa-check"></i>';
          setTimeout(() => {
            this.innerHTML = '<i class="fas fa-copy"></i>';
          }, 2000);
        }
      });
    }

    // 滚动到成功区域
    successSection.scrollIntoView({ behavior: 'smooth' });
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
        // 尝试通过API自动配置客户端
        await autoConfigureClient(token);
        MSyncUtils.showMessage('login-message', '客户端配置成功！请检查您的桌面客户端。', 'success');
      } catch (error) {
        console.error('Auto config failed:', error);
        MSyncUtils.showMessage('login-message', '自动配置失败，请使用手动配置', 'error');
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
      const success = await MSyncUtils.copyToClipboard(token);
      if (success) {
        this.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(() => {
          this.innerHTML = '<i class="fas fa-copy"></i>';
        }, 2000);
      }
    });
  }

  // 滚动到配置区域
  clientSection.scrollIntoView({ behavior: 'smooth' });
}

// 自动配置客户端
async function autoConfigureClient(token) {
  try {
    // 尝试通过API创建配置文件
    const response = await MSyncUtils.apiRequest('/client/auto-config', {
      method: 'POST',
      body: JSON.stringify({ token })
    });

    if (response.success) {
      return;
    }
  } catch (error) {
    console.log('API-based config failed:', error);
  }

  // 如果API方式失败，尝试其他方式
  throw new Error('Auto-configuration not available');
}

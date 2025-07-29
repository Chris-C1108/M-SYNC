/**
 * M-SYNC Token Management JavaScript
 */

let currentTokens = [];

// 页面初始化
document.addEventListener('DOMContentLoaded', function() {
  // 检查登录状态
  if (!MSyncUtils.isLoggedIn()) {
    window.location.href = '/pages/login.html';
    return;
  }

  // 初始化页面
  initTokenManagement();
});

// 初始化Token管理页面
async function initTokenManagement() {
  // 加载用户信息
  await loadUserInfo();
  
  // 加载Token列表
  await loadTokens();
  
  // 初始化创建Token表单
  initCreateTokenForm();
  
  // 初始化iOS配置
  initIOSConfig();
}

// 加载用户信息
async function loadUserInfo() {
  try {
    const user = JSON.parse(localStorage.getItem('msync_user') || '{}');
    
    const userNameElement = document.getElementById('user-name');
    const userEmailElement = document.getElementById('user-email');
    
    if (userNameElement && user.username) {
      userNameElement.textContent = user.username;
    }
    
    if (userEmailElement && user.email) {
      userEmailElement.textContent = user.email;
    }
    
  } catch (error) {
    console.error('Failed to load user info:', error);
  }
}

// 加载Token列表
async function loadTokens() {
  const loadingElement = document.getElementById('tokens-loading');
  const listElement = document.getElementById('tokens-list');
  const noTokensElement = document.getElementById('no-tokens');

  try {
    // 显示加载状态
    if (loadingElement) loadingElement.style.display = 'block';
    if (listElement) listElement.style.display = 'none';
    if (noTokensElement) noTokensElement.style.display = 'none';

    // 获取Token列表
    const response = await MSyncUtils.authenticatedRequest('/tokens');
    
    if (response.success && response.data) {
      currentTokens = response.data.tokens || [];
      
      if (currentTokens.length > 0) {
        renderTokenList(currentTokens);
        if (listElement) listElement.style.display = 'block';
      } else {
        if (noTokensElement) noTokensElement.style.display = 'block';
      }
    }

  } catch (error) {
    console.error('Failed to load tokens:', error);
    MSyncUtils.showMessage('tokens-message', '加载Token列表失败: ' + error.message, 'error');
  } finally {
    if (loadingElement) loadingElement.style.display = 'none';
  }
}

// 渲染Token列表
function renderTokenList(tokens) {
  const listElement = document.getElementById('tokens-list');
  if (!listElement) return;

  listElement.innerHTML = tokens.map(token => `
    <div class="token-item" data-token-id="${token.id}">
      <div class="token-header">
        <div class="token-name">${escapeHtml(token.tokenName)}</div>
        <div class="token-device">${MSyncUtils.getDeviceTypeName(token.deviceType)}</div>
      </div>

      <div class="token-info">
        <div class="token-info-item">
          <div class="token-info-label">创建时间</div>
          <div class="token-info-value">${MSyncUtils.formatDate(token.createdAt)}</div>
        </div>
        <div class="token-info-item">
          <div class="token-info-label">最后使用</div>
          <div class="token-info-value">${MSyncUtils.formatDate(token.lastUsedAt)}</div>
        </div>
        <div class="token-info-item">
          <div class="token-info-label">权限</div>
          <div class="token-info-value">${token.permissions ? token.permissions.join(', ') : '无'}</div>
        </div>
        <div class="token-info-item">
          <div class="token-info-label">状态</div>
          <div class="token-info-value">${token.isActive ? '活跃' : '已禁用'}</div>
        </div>
      </div>

      <div class="token-actions">
        <button class="btn btn-small btn-secondary token-details-btn" data-token-id="${token.id}">
          <i class="fas fa-eye"></i> 查看详情
        </button>
        <button class="btn btn-small btn-secondary token-copy-btn" data-token-id="${token.id}">
          <i class="fas fa-copy"></i> 复制Token
        </button>
        ${token.deviceType === 'ios_shortcuts' ? `
          <button class="btn btn-small btn-primary token-ios-config-btn" data-token-id="${token.id}">
            <i class="fas fa-mobile-alt"></i> iOS配置
          </button>
        ` : ''}
        <button class="btn btn-small token-revoke-btn" style="background-color: var(--error-color); color: white;" data-token-id="${token.id}">
          <i class="fas fa-trash"></i> 撤销
        </button>
      </div>
    </div>
  `).join('');

  // 设置Token操作按钮的事件监听器
  setupTokenActionListeners();
}

// 设置Token操作按钮的事件监听器
function setupTokenActionListeners() {
  // 查看详情按钮
  document.querySelectorAll('.token-details-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const tokenId = this.getAttribute('data-token-id');
      viewTokenDetails(tokenId);
    });
  });

  // 复制Token按钮
  document.querySelectorAll('.token-copy-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const tokenId = this.getAttribute('data-token-id');
      copyTokenValue(tokenId);
    });
  });

  // iOS配置按钮
  document.querySelectorAll('.token-ios-config-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const tokenId = this.getAttribute('data-token-id');
      generateIOSConfig(tokenId);
    });
  });

  // 撤销Token按钮
  document.querySelectorAll('.token-revoke-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const tokenId = this.getAttribute('data-token-id');
      revokeToken(tokenId);
    });
  });
}

// 初始化创建Token表单
function initCreateTokenForm() {
  const form = document.getElementById('create-token-form');
  if (!form) return;

  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formData = new FormData(form);

    // 详细调试FormData内容
    console.log('Form element:', form);
    console.log('FormData entries:');
    for (let [key, value] of formData.entries()) {
      console.log(`  ${key}: ${value}`);
    }

    const tokenData = {
      tokenName: formData.get('tokenName'),
      deviceType: formData.get('deviceType'),
      permissions: Array.from(formData.getAll('permissions'))
    };

    // 调试日志
    console.log('Token creation data:', tokenData);
    console.log('Individual values:');
    console.log('  tokenName:', formData.get('tokenName'));
    console.log('  deviceType:', formData.get('deviceType'));
    console.log('  permissions:', formData.getAll('permissions'));

    // 验证输入
    if (!tokenData.tokenName || !tokenData.deviceType) {
      alert('请填写Token名称和设备类型');
      return;
    }

    if (tokenData.permissions.length === 0) {
      alert('请至少选择一个权限');
      return;
    }

    // 显示加载状态
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 创建中...';
    submitBtn.disabled = true;

    try {
      // 调用创建Token API
      console.log('Sending request with data:', JSON.stringify(tokenData));
      const response = await MSyncUtils.authenticatedRequest('/tokens', {
        method: 'POST',
        body: JSON.stringify(tokenData)
      });

      if (response.success && response.data) {
        // 显示新创建的Token
        showNewTokenModal(response.data);
        
        // 重新加载Token列表
        await loadTokens();
        
        // 重置表单
        form.reset();
      }

    } catch (error) {
      console.error('Failed to create token:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        tokenData: tokenData
      });
      alert('创建Token失败: ' + error.message);
    } finally {
      // 恢复按钮状态
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    }
  });
}

// 显示新Token模态框
function showNewTokenModal(tokenData) {
  const modal = document.getElementById('token-modal');
  if (!modal) return;

  const modalBody = modal.querySelector('.modal-body');
  modalBody.innerHTML = `
    <div class="token-details">
      <h4><i class="fas fa-check-circle" style="color: var(--success-color);"></i> Token创建成功！</h4>
      <p>请立即复制并保存您的访问令牌，此令牌只会显示一次。</p>
      
      <div class="token-display">
        <label>访问令牌：</label>
        <div class="token-input-group">
          <input type="text" value="${tokenData.token}" readonly id="new-token-value">
          <button class="btn btn-small" id="copy-new-token-btn">
            <i class="fas fa-copy"></i>
          </button>
        </div>
      </div>
      
      <div class="token-info">
        <div class="token-info-item">
          <div class="token-info-label">Token名称</div>
          <div class="token-info-value">${escapeHtml(tokenData.tokenName)}</div>
        </div>
        <div class="token-info-item">
          <div class="token-info-label">设备类型</div>
          <div class="token-info-value">${MSyncUtils.getDeviceTypeName(tokenData.deviceType)}</div>
        </div>
        <div class="token-info-item">
          <div class="token-info-label">权限</div>
          <div class="token-info-value">${tokenData.permissions.join(', ')}</div>
        </div>
      </div>
      
      ${tokenData.deviceType === 'ios_shortcuts' ? `
        <div class="ios-config-section">
          <h5><i class="fas fa-mobile-alt"></i> iOS快捷指令配置</h5>
          <p>使用以下配置在iOS快捷指令中设置M-SYNC：</p>
          <div class="code-block">
            <pre>URL: ${window.location.origin}/api/v1/messages/publish
方法: POST
请求体: JSON
{
  "token": "${tokenData.token}",
  "messageType": "TEXT",
  "content": "您的消息内容"
}</pre>
            <button class="btn btn-small" id="copy-ios-config-btn" data-token="${tokenData.token}">
              <i class="fas fa-copy"></i> 复制配置
            </button>
          </div>
        </div>
      ` : ''}
    </div>
  `;

  // 显示模态框
  modal.style.display = 'flex';

  // 设置关闭按钮
  const closeBtn = modal.querySelector('.modal-close');
  closeBtn.onclick = () => {
    modal.style.display = 'none';
  };

  // 点击背景关闭
  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  };

  // 设置复制新Token按钮事件
  const copyNewTokenBtn = document.getElementById('copy-new-token-btn');
  if (copyNewTokenBtn) {
    copyNewTokenBtn.addEventListener('click', copyNewToken);
  }

  // 设置复制iOS配置按钮事件
  const copyIOSConfigBtn = document.getElementById('copy-ios-config-btn');
  if (copyIOSConfigBtn) {
    copyIOSConfigBtn.addEventListener('click', function() {
      const token = this.getAttribute('data-token');
      copyIOSConfig(token);
    });
  }
}

// 复制新Token
async function copyNewToken() {
  const input = document.getElementById('new-token-value');
  if (input) {
    const success = await MSyncUtils.copyToClipboard(input.value);
    if (success) {
      const btn = input.nextElementSibling;
      btn.innerHTML = '<i class="fas fa-check"></i>';
      setTimeout(() => {
        btn.innerHTML = '<i class="fas fa-copy"></i>';
      }, 2000);
    }
  }
}

// 初始化iOS配置
function initIOSConfig() {
  const copyBtn = document.getElementById('copy-ios-config');
  if (copyBtn) {
    copyBtn.addEventListener('click', function() {
      const codeBlock = document.getElementById('ios-config-code');
      if (codeBlock) {
        MSyncUtils.copyToClipboard(codeBlock.textContent);
      }
    });
  }
}

// Token操作函数
async function viewTokenDetails(tokenId) {
  const token = currentTokens.find(t => t.id === tokenId);
  if (!token) return;

  // 显示Token详情（不包含实际Token值）
  const modal = document.getElementById('token-modal');
  if (!modal) return;

  const modalBody = modal.querySelector('.modal-body');
  modalBody.innerHTML = `
    <div class="token-details">
      <h4>${escapeHtml(token.tokenName)}</h4>
      <div class="token-info">
        <div class="token-info-item">
          <div class="token-info-label">Token ID</div>
          <div class="token-info-value">${token.id}</div>
        </div>
        <div class="token-info-item">
          <div class="token-info-label">设备类型</div>
          <div class="token-info-value">${MSyncUtils.getDeviceTypeName(token.deviceType)}</div>
        </div>
        <div class="token-info-item">
          <div class="token-info-label">权限</div>
          <div class="token-info-value">${token.permissions ? token.permissions.join(', ') : '无'}</div>
        </div>
        <div class="token-info-item">
          <div class="token-info-label">创建时间</div>
          <div class="token-info-value">${MSyncUtils.formatDate(token.createdAt)}</div>
        </div>
        <div class="token-info-item">
          <div class="token-info-label">最后使用</div>
          <div class="token-info-value">${MSyncUtils.formatDate(token.lastUsedAt)}</div>
        </div>
        <div class="token-info-item">
          <div class="token-info-label">状态</div>
          <div class="token-info-value">${token.isActive ? '活跃' : '已禁用'}</div>
        </div>
      </div>
    </div>
  `;

  modal.style.display = 'flex';
}

async function copyTokenValue(tokenId) {
  // 注意：出于安全考虑，我们不能直接复制Token值
  // 需要通过API重新获取或提示用户
  alert('出于安全考虑，Token值只在创建时显示一次。如需使用，请创建新的Token。');
}

async function revokeToken(tokenId) {
  if (!confirm('确定要撤销此Token吗？此操作不可撤销。')) {
    return;
  }

  try {
    const response = await MSyncUtils.authenticatedRequest(`/tokens/${tokenId}`, {
      method: 'DELETE'
    });

    if (response.success) {
      alert('Token已成功撤销');
      await loadTokens(); // 重新加载列表
    }

  } catch (error) {
    console.error('Failed to revoke token:', error);
    alert('撤销Token失败: ' + error.message);
  }
}

function generateIOSConfig(tokenId) {
  alert('iOS配置功能开发中...');
}

function copyIOSConfig(token) {
  const config = `URL: ${window.location.origin}/api/v1/messages/publish
方法: POST
请求体: JSON
{
  "token": "${token}",
  "messageType": "TEXT",
  "content": "您的消息内容"
}`;
  
  MSyncUtils.copyToClipboard(config);
}

// 工具函数
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

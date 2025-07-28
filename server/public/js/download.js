/**
 * M-SYNC Download Page JavaScript
 */

// 页面初始化
document.addEventListener('DOMContentLoaded', function() {
  // 检测用户操作系统并高亮推荐版本
  highlightRecommendedVersion();
});

// 检测并高亮推荐版本
function highlightRecommendedVersion() {
  const userAgent = navigator.userAgent.toLowerCase();
  let recommendedPlatform = '';

  if (userAgent.includes('windows')) {
    recommendedPlatform = 'windows';
  } else if (userAgent.includes('mac')) {
    recommendedPlatform = 'macos';
  } else if (userAgent.includes('linux')) {
    recommendedPlatform = 'linux';
  }

  if (recommendedPlatform) {
    const downloadItems = document.querySelectorAll('.download-item');
    downloadItems.forEach(item => {
      const platform = item.querySelector('h3').textContent.toLowerCase();
      if (platform.includes(recommendedPlatform) || 
          (recommendedPlatform === 'macos' && platform.includes('macos'))) {
        item.classList.add('recommended');
        
        // 添加推荐标签
        const recommendedBadge = document.createElement('div');
        recommendedBadge.className = 'recommended-badge';
        recommendedBadge.innerHTML = '<i class="fas fa-star"></i> 推荐';
        item.appendChild(recommendedBadge);
      }
    });
  }
}

// 下载客户端
async function downloadClient(platform) {
  try {
    // 显示下载提示
    showDownloadModal(platform);
    
    // 这里可以添加实际的下载逻辑
    // 目前显示提示信息
    
  } catch (error) {
    console.error('Download failed:', error);
    alert('下载失败，请稍后重试');
  }
}

// 显示下载模态框
function showDownloadModal(platform) {
  const platformNames = {
    'windows': 'Windows',
    'macos': 'macOS',
    'linux': 'Linux'
  };

  const platformName = platformNames[platform] || platform;
  
  // 创建模态框
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.display = 'flex';
  
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3><i class="fas fa-download"></i> 下载 ${platformName} 客户端</h3>
        <button class="modal-close" onclick="closeDownloadModal()">&times;</button>
      </div>
      <div class="modal-body">
        <div class="download-info">
          <div class="download-status">
            <i class="fas fa-info-circle"></i>
            <h4>客户端开发中</h4>
            <p>M-SYNC ${platformName} 客户端正在开发中，敬请期待！</p>
          </div>
          
          <div class="alternative-options">
            <h5>当前可用选项：</h5>
            <ul>
              <li><strong>源码编译</strong>：您可以从GitHub获取源代码自行编译</li>
              <li><strong>Node.js运行</strong>：直接使用Node.js运行客户端代码</li>
              <li><strong>iOS快捷指令</strong>：在iOS设备上使用快捷指令接入</li>
            </ul>
          </div>
          
          <div class="setup-instructions">
            <h5>使用Node.js运行客户端：</h5>
            <div class="code-block">
              <pre># 克隆项目
git clone https://github.com/your-repo/m-sync.git
cd m-sync/client

# 安装依赖
npm install

# 配置Token
cp .env.example .env
# 编辑 .env 文件，设置您的访问令牌

# 启动客户端（托盘模式）
npm start -- --tray</pre>
              <button class="btn btn-small" onclick="copySetupInstructions()">
                <i class="fas fa-copy"></i> 复制命令
              </button>
            </div>
          </div>
          
          <div class="action-buttons">
            <a href="/pages/tokens.html" class="btn btn-primary">
              <i class="fas fa-key"></i> 获取访问令牌
            </a>
            <a href="#" class="btn btn-secondary" target="_blank">
              <i class="fab fa-github"></i> 查看源码
            </a>
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // 点击背景关闭
  modal.onclick = (e) => {
    if (e.target === modal) {
      closeDownloadModal();
    }
  };
}

// 关闭下载模态框
function closeDownloadModal() {
  const modal = document.querySelector('.modal');
  if (modal) {
    document.body.removeChild(modal);
  }
}

// 复制设置说明
async function copySetupInstructions() {
  const instructions = `# 克隆项目
git clone https://github.com/your-repo/m-sync.git
cd m-sync/client

# 安装依赖
npm install

# 配置Token
cp .env.example .env
# 编辑 .env 文件，设置您的访问令牌

# 启动客户端（托盘模式）
npm start -- --tray`;

  try {
    await navigator.clipboard.writeText(instructions);
    
    // 更新按钮状态
    const button = event.target.closest('button');
    const originalText = button.innerHTML;
    button.innerHTML = '<i class="fas fa-check"></i> 已复制';
    
    setTimeout(() => {
      button.innerHTML = originalText;
    }, 2000);
    
  } catch (error) {
    console.error('Failed to copy instructions:', error);
    alert('复制失败，请手动复制');
  }
}

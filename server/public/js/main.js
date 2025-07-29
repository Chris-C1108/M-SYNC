/**
 * M-SYNC Web Interface - 单页面应用主控制器
 */

// ======================= 应用状态管理 =======================
class MSyncApp {
    constructor() {
        this.currentPage = 'page-home';
        this.user = null;
        this.tokens = [];
        this.currentTokenPage = 1;
        this.tokenPageSize = 10;
        this.tokenFilters = {
            search: '',
            status: '',
            deviceType: ''
        };

        // API基础配置
        this.API_BASE = '/api/v1';

        // 初始化应用
        this.init();
    }

    // 初始化应用
    async init() {
        this.setupEventListeners();
        this.setupNavigation();
        this.setupModals();
        await this.checkAuthStatus();
        await this.checkServiceStatus();
        this.updateNavigation();
    }

    // ======================= 工具函数 =======================
    async apiRequest(endpoint, options = {}) {
        const url = `${this.API_BASE}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        // 详细的调试信息
        console.log('API Request Details:', {
            url: url,
            method: config.method || 'GET',
            headers: config.headers,
            body: config.body
        });

        try {
            const response = await fetch(url, config);

            console.log('API Response Details:', {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries())
            });

            const data = await response.json();
            console.log('API Response Data:', data);

            if (!response.ok) {
                const error = new Error(data.message || `HTTP ${response.status}`);
                // 传递详细的验证错误信息
                if (data.details) {
                    error.details = data.details;
                }
                throw error;
            }

            return data;
        } catch (error) {
            console.error('API Request failed:', error);
            throw error;
        }
    }

    async authenticatedRequest(endpoint, options = {}) {
        const token = localStorage.getItem('msync_token');
        if (!token) {
            throw new Error('未登录');
        }

        return this.apiRequest(endpoint, {
            ...options,
            headers: {
                'Authorization': `Bearer ${token}`,
                ...options.headers
            }
        });
    }

    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            const success = document.execCommand('copy');
            document.body.removeChild(textArea);
            return success;
        }
    }

    formatDate(dateString) {
        if (!dateString) return '未使用';
        const date = new Date(dateString);
        return date.toLocaleString('zh-CN');
    }

    getDeviceTypeName(deviceType) {
        const names = {
            'desktop': '桌面客户端',
            'ios_shortcuts': 'iOS快捷指令',
            'mobile': '移动应用',
            'web': 'Web应用',
            'api': 'API调用'
        };
        return names[deviceType] || deviceType;
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    showNotification(message, type = 'info') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;

        // 添加到页面
        document.body.appendChild(notification);

        // 显示动画
        setTimeout(() => notification.classList.add('show'), 100);

        // 自动隐藏
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => document.body.removeChild(notification), 300);
        }, 3000);
    }

    // ======================= 事件监听器设置 =======================
    setupEventListeners() {
        // 功能卡片点击事件
        document.querySelectorAll('.feature-card[data-target]').forEach(card => {
            card.addEventListener('click', (e) => {
                const target = e.currentTarget.getAttribute('data-target');
                this.navigateToPage(target);
            });
        });

        // 登录表单
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // 注册表单
        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        }

        // 创建Token表单
        const createTokenForm = document.getElementById('create-token-form');
        if (createTokenForm) {
            createTokenForm.addEventListener('submit', (e) => this.handleCreateToken(e));
        }

        // 登录/注册视图切换
        document.getElementById('show-register-view')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.switchAuthView('register');
        });

        document.getElementById('show-login-view')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.switchAuthView('login');
        });

        // Token搜索和筛选
        document.getElementById('token-search')?.addEventListener('input', (e) => {
            this.tokenFilters.search = e.target.value;
            this.debounce(() => this.loadTokens(), 300)();
        });

        document.getElementById('token-status-filter')?.addEventListener('change', (e) => {
            this.tokenFilters.status = e.target.value;
            this.loadTokens();
        });

        document.getElementById('token-device-filter')?.addEventListener('change', (e) => {
            this.tokenFilters.deviceType = e.target.value;
            this.loadTokens();
        });

        // 创建Token按钮
        document.getElementById('btn-show-create-token-modal')?.addEventListener('click', () => {
            this.showModal('modal-create-token');
        });

        // iOS配置复制按钮
        document.getElementById('btn-copy-ios-config')?.addEventListener('click', () => {
            this.copyIOSConfig();
        });
    }

    // ======================= 导航系统 =======================
    setupNavigation() {
        // 动态生成导航链接
        const nav = document.getElementById('main-nav');
        if (nav) {
            this.updateNavigation();
        }
    }

    updateNavigation() {
        const nav = document.getElementById('main-nav');
        if (!nav) return;

        let navLinks = [
            { id: 'page-home', text: '首页', icon: 'fas fa-home' }
        ];

        if (this.user) {
            navLinks.push(
                { id: 'page-tokens', text: 'Token管理', icon: 'fas fa-key' },
                { id: 'page-download', text: '下载客户端', icon: 'fas fa-download' }
            );
        }

        nav.innerHTML = navLinks.map(link => `
            <a href="#" class="nav-link ${this.currentPage === link.id ? 'active' : ''}"
               data-page="${link.id}">
                <i class="${link.icon}"></i> ${link.text}
            </a>
        `).join('');

        // 添加登录/登出按钮
        if (this.user) {
            nav.innerHTML += `
                <a href="#" class="nav-link" id="logout-btn">
                    <i class="fas fa-sign-out-alt"></i> 退出登录
                </a>
            `;
            document.getElementById('logout-btn')?.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        } else {
            nav.innerHTML += `
                <a href="#" class="nav-link" id="login-btn">
                    <i class="fas fa-sign-in-alt"></i> 登录
                </a>
            `;
            document.getElementById('login-btn')?.addEventListener('click', (e) => {
                e.preventDefault();
                this.showModal('modal-auth');
            });
        }

        // 绑定导航点击事件
        nav.querySelectorAll('.nav-link[data-page]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const pageId = e.currentTarget.getAttribute('data-page');
                this.navigateToPage(pageId);
            });
        });
    }

    navigateToPage(pageId) {
        // 检查权限
        if ((pageId === 'page-tokens') && !this.user) {
            this.showModal('modal-auth');
            return;
        }

        // 隐藏当前页面
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });

        // 显示目标页面
        const targetPage = document.getElementById(pageId);
        if (targetPage) {
            targetPage.classList.add('active');
            this.currentPage = pageId;

            // 更新导航状态
            this.updateNavigation();

            // 页面特定的初始化
            if (pageId === 'page-tokens' && this.user) {
                this.loadTokens();
            }
        }
    }

    // ======================= 服务状态检查 =======================
    async checkServiceStatus() {
        const statusElements = {
            service: document.getElementById('service-status'),
            database: document.getElementById('database-status'),
            websocket: document.getElementById('websocket-status'),
            version: document.getElementById('version-info')
        };

        try {
            const response = await this.apiRequest('/health');

            if (statusElements.service) {
                statusElements.service.textContent = '运行中';
                statusElements.service.className = 'status-value';
            }

            if (statusElements.database && response.data?.services) {
                const dbStatus = response.data.services.database === 'connected' ? '已连接' : '未连接';
                statusElements.database.textContent = dbStatus;
            }

            if (statusElements.websocket && response.data?.services) {
                const wsStatus = response.data.services.websocket === 'running' ? '运行中' : '未运行';
                statusElements.websocket.textContent = wsStatus;
            }

            if (statusElements.version && response.data?.version) {
                statusElements.version.textContent = response.data.version;
            }

        } catch (error) {
            console.error('Failed to check service status:', error);

            if (statusElements.service) {
                statusElements.service.textContent = '连接失败';
            }
        }
    }

    // ======================= 模态框管理 =======================
    setupModals() {
        // 模态框关闭按钮
        document.querySelectorAll('.modal-close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                const modalId = e.target.getAttribute('data-modal-id');
                this.hideModal(modalId);
            });
        });

        // 点击背景关闭模态框
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideModal(modal.id);
                }
            });
        });

        // 模态框内的关闭按钮
        document.querySelectorAll('[data-modal-close]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modalId = e.target.getAttribute('data-modal-close');
                this.hideModal(modalId);
            });
        });
    }

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('show');
            modal.style.display = 'flex';

            // 聚焦到第一个输入框
            const firstInput = modal.querySelector('input[type="text"], input[type="email"]');
            if (firstInput) {
                setTimeout(() => firstInput.focus(), 100);
            }
        }
    }

    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('show');
            modal.style.display = 'none';

            // 重置表单
            const forms = modal.querySelectorAll('form');
            forms.forEach(form => form.reset());
        }
    }

    switchAuthView(view) {
        const loginView = document.getElementById('login-view');
        const registerView = document.getElementById('register-view');

        if (view === 'register') {
            loginView.style.display = 'none';
            registerView.style.display = 'block';
        } else {
            loginView.style.display = 'block';
            registerView.style.display = 'none';
        }
    }

    // ======================= 认证管理 =======================
    async checkAuthStatus() {
        const token = localStorage.getItem('msync_token');
        const userData = localStorage.getItem('msync_user');

        if (token && userData) {
            try {
                this.user = JSON.parse(userData);
                this.updateUserInfo();
                return true;
            } catch (error) {
                console.error('Invalid user data:', error);
                this.logout();
                return false;
            }
        }
        return false;
    }

    updateUserInfo() {
        const userInfo = document.getElementById('user-info');
        if (userInfo && this.user) {
            userInfo.innerHTML = `
                <i class="fas fa-user"></i>
                <span>欢迎，${this.user.username}</span>
            `;
        }

        // 更新欢迎横幅
        const welcomeBanner = document.getElementById('welcome-banner');
        if (welcomeBanner && this.user) {
            welcomeBanner.innerHTML = `
                <i class="fas fa-home"></i> 欢迎回来，${this.user.username}！
            `;
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const loginData = {
            username: formData.get('username'),
            password: formData.get('password'),
            remember: formData.get('remember') === 'on'
        };

        try {
            const response = await this.apiRequest('/auth/login', {
                method: 'POST',
                body: JSON.stringify(loginData)
            });

            if (response.success) {
                // 保存认证信息
                localStorage.setItem('msync_token', response.data.token);
                localStorage.setItem('msync_user', JSON.stringify(response.data.user));

                this.user = response.data.user;
                this.updateUserInfo();
                this.updateNavigation();
                this.hideModal('modal-auth');

                // 导航到Token管理页面
                this.navigateToPage('page-tokens');

                this.showNotification('登录成功！', 'success');
            }
        } catch (error) {
            this.showNotification(error.message || '登录失败', 'error');
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        const formData = new FormData(e.target);

        // 验证密码确认
        const password = formData.get('password');
        const confirmPassword = formData.get('confirmPassword');

        if (password !== confirmPassword) {
            this.showNotification('密码确认不匹配', 'error');
            return;
        }

        const registerData = {
            username: formData.get('username'),
            email: formData.get('email'),
            password: password
        };

        try {
            const response = await this.apiRequest('/auth/register', {
                method: 'POST',
                body: JSON.stringify(registerData)
            });

            if (response.success) {
                this.showNotification('注册成功！请登录', 'success');
                this.switchAuthView('login');

                // 预填用户名
                document.getElementById('login-username').value = registerData.username;
            }
        } catch (error) {
            this.showNotification(error.message || '注册失败', 'error');
        }
    }

    logout() {
        localStorage.removeItem('msync_token');
        localStorage.removeItem('msync_user');
        this.user = null;
        this.tokens = [];

        this.updateNavigation();
        this.navigateToPage('page-home');

        // 清空用户信息
        const userInfo = document.getElementById('user-info');
        if (userInfo) {
            userInfo.innerHTML = '';
        }

        // 重置欢迎横幅
        const welcomeBanner = document.getElementById('welcome-banner');
        if (welcomeBanner) {
            welcomeBanner.innerHTML = '<i class="fas fa-home"></i> 欢迎使用 M-SYNC';
        }

        this.showNotification('已退出登录', 'info');
    }

    // ======================= Token管理功能 =======================
    async loadTokens() {
        if (!this.user) return;

        try {
            const queryParams = new URLSearchParams({
                page: this.currentTokenPage,
                limit: this.tokenPageSize,
                search: this.tokenFilters.search,
                status: this.tokenFilters.status,
                deviceType: this.tokenFilters.deviceType
            });

            const response = await this.authenticatedRequest(`/tokens?${queryParams}`);

            if (response.success) {
                this.tokens = response.data.tokens;
                this.renderTokenTable();
                this.renderPagination(response.data.pagination);
            }
        } catch (error) {
            console.error('Failed to load tokens:', error);
            this.showNotification('加载Token失败', 'error');
        }
    }

    renderTokenTable() {
        const tbody = document.getElementById('token-table-body');
        if (!tbody) return;

        if (this.tokens.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">暂无Token</td></tr>';
            return;
        }

        tbody.innerHTML = this.tokens.map(token => `
            <tr>
                <td>${token.tokenName || token.name || '未命名Token'}</td>
                <td>${this.getDeviceTypeName(token.deviceType)}</td>
                <td>${Array.isArray(token.permissions) ? token.permissions.join(', ') : token.permissions || 'message:publish, message:read'}</td>
                <td>${this.formatDate(token.createdAt)}</td>
                <td>${this.formatDate(token.lastUsedAt)}</td>
                <td>
                    <span class="status-badge ${token.status || (token.isActive ? 'active' : 'revoked')}">
                        ${(token.status === 'active' || token.isActive) ? '活跃' : '已撤销'}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn" onclick="app.copyToken('${token.token || token.accessToken}')" title="复制Token">
                            <i class="fas fa-copy"></i>
                        </button>
                        ${(token.status === 'active' || token.isActive) ? `
                            <button class="action-btn danger" onclick="app.confirmDeleteToken('${token.id}')" title="删除Token">
                                <i class="fas fa-trash"></i>
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `).join('');
    }

    renderPagination(pagination) {
        const paginationSection = document.getElementById('token-pagination');
        if (!paginationSection || !pagination) return;

        const { currentPage, totalPages, totalItems } = pagination;

        if (totalPages <= 1) {
            paginationSection.innerHTML = '';
            return;
        }

        let paginationHTML = `
            <button class="pagination-btn" ${currentPage <= 1 ? 'disabled' : ''}
                    onclick="app.goToTokenPage(${currentPage - 1})">
                <i class="fas fa-chevron-left"></i>
            </button>
        `;

        // 页码按钮
        for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
            paginationHTML += `
                <button class="pagination-btn ${i === currentPage ? 'active' : ''}"
                        onclick="app.goToTokenPage(${i})">
                    ${i}
                </button>
            `;
        }

        paginationHTML += `
            <button class="pagination-btn" ${currentPage >= totalPages ? 'disabled' : ''}
                    onclick="app.goToTokenPage(${currentPage + 1})">
                <i class="fas fa-chevron-right"></i>
            </button>
            <span style="margin-left: 1rem; color: var(--text-muted);">
                共 ${totalItems} 个Token
            </span>
        `;

        paginationSection.innerHTML = paginationHTML;
    }

    goToTokenPage(page) {
        this.currentTokenPage = page;
        this.loadTokens();
    }

    async handleCreateToken(e) {
        e.preventDefault();

        // 确保阻止任何默认行为
        if (e.stopPropagation) {
            e.stopPropagation();
        }

        console.log('handleCreateToken called, event:', e);

        const formData = new FormData(e.target);

        const permissions = [];
        formData.getAll('permissions').forEach(permission => {
            permissions.push(permission);
        });

        const tokenData = {
            tokenName: formData.get('tokenName'),
            deviceType: formData.get('deviceType'),
            permissions: permissions.length > 0 ? permissions : ['message:publish', 'message:read']
        };

        console.log('Prepared token data:', tokenData);

        try {
            // 直接使用fetch而不是通过authenticatedRequest
            const token = localStorage.getItem('msync_token');
            if (!token) {
                throw new Error('未登录');
            }

            const url = `${this.API_BASE}/tokens`;
            const requestConfig = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(tokenData)
            };

            console.log('Direct fetch request config:', requestConfig);
            console.log('Request URL:', url);
            console.log('Request body string:', requestConfig.body);

            const response = await fetch(url, requestConfig);

            console.log('Direct fetch response:', {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries())
            });

            const data = await response.json();
            console.log('Direct fetch response data:', data);

            if (!response.ok) {
                const error = new Error(data.message || `HTTP ${response.status}`);
                if (data.details) {
                    error.details = data.details;
                }
                throw error;
            }

            if (data.success) {
                this.showNotification('Token创建成功！', 'success');
                this.hideModal('modal-create-token');
                this.loadTokens();

                // 显示新创建的Token
                this.showTokenCreated(data.data);
            }
        } catch (error) {
            console.error('Token creation error details:', error);
            let errorMessage = error.message || 'Token创建失败';

            // 如果有详细的验证错误信息，显示第一个错误
            if (error.details && Array.isArray(error.details) && error.details.length > 0) {
                errorMessage = `验证失败: ${error.details[0].message}`;
            }

            this.showNotification(errorMessage, 'error');
        }
    }

    showTokenCreated(tokenData) {
        // 可以显示一个特殊的模态框来展示新创建的Token
        this.showNotification(`Token "${tokenData.name}" 创建成功！请妥善保存Token值。`, 'success');
    }

    async copyToken(token) {
        const success = await this.copyToClipboard(token);
        if (success) {
            this.showNotification('Token已复制到剪贴板', 'success');
        } else {
            this.showNotification('复制失败', 'error');
        }
    }



    confirmDeleteToken(tokenId) {
        this.tokenToDelete = tokenId;

        // 创建确认对话框
        const confirmed = confirm('确定要删除这个Token吗？删除后将无法恢复，使用此Token的应用将无法继续访问服务。');

        if (confirmed) {
            this.deleteToken(tokenId);
        }
    }

    async deleteToken(tokenId) {
        try {
            const response = await this.authenticatedRequest(`/tokens/${tokenId}`, {
                method: 'DELETE'
            });

            if (response.success) {
                this.showNotification('Token已删除', 'success');
                this.loadTokens();
            }
        } catch (error) {
            // 如果删除API不存在，尝试撤销API
            try {
                const revokeResponse = await this.authenticatedRequest(`/tokens/${tokenId}/revoke`, {
                    method: 'POST'
                });

                if (revokeResponse.success) {
                    this.showNotification('Token已撤销', 'success');
                    this.loadTokens();
                }
            } catch (revokeError) {
                this.showNotification(error.message || 'Token删除失败', 'error');
            }
        }
    }

    // ======================= iOS配置功能 =======================
    copyIOSConfig() {
        const template = document.getElementById('ios-config-template');
        if (template) {
            const success = this.copyToClipboard(template.textContent);
            if (success) {
                this.showNotification('iOS配置已复制到剪贴板', 'success');
            } else {
                this.showNotification('复制失败，请手动复制', 'error');
            }
        }
    }
}

// ======================= 应用初始化 =======================
let app;

document.addEventListener('DOMContentLoaded', function() {
    app = new MSyncApp();
});

// 导出应用实例供其他脚本使用
window.MSyncApp = MSyncApp;

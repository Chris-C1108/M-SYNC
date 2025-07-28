-- 创建统一访问令牌表
-- 支持所有客户端类型的Token管理

CREATE TABLE IF NOT EXISTS access_tokens (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    token_name VARCHAR(100),
    device_type VARCHAR(20) NOT NULL, -- 'desktop', 'ios_shortcuts', 'web', 'mobile'
    device_info JSON,
    client_info JSON,
    permissions JSON DEFAULT '["message:publish", "message:read"]',
    expires_at DATETIME,
    last_used_at DATETIME,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_access_tokens_user_id ON access_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_access_tokens_token_hash ON access_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_access_tokens_device_type ON access_tokens(device_type);
CREATE INDEX IF NOT EXISTS idx_access_tokens_expires_at ON access_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_access_tokens_last_used ON access_tokens(last_used_at);
CREATE INDEX IF NOT EXISTS idx_access_tokens_active ON access_tokens(is_active);
CREATE INDEX IF NOT EXISTS idx_access_tokens_created_at ON access_tokens(created_at);

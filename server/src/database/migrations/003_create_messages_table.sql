-- 创建消息表
-- 存储用户发布的消息记录

CREATE TABLE IF NOT EXISTS messages (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    token_id VARCHAR(36) NOT NULL,
    message_type VARCHAR(20) NOT NULL, -- 'TEXT', 'URL', 'CODE'
    content TEXT NOT NULL,
    content_hash VARCHAR(64), -- 内容哈希，用于去重
    metadata JSON, -- 额外的消息元数据
    published_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (token_id) REFERENCES access_tokens(id) ON DELETE SET NULL
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_token_id ON messages(token_id);
CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(message_type);
CREATE INDEX IF NOT EXISTS idx_messages_published_at ON messages(published_at);
CREATE INDEX IF NOT EXISTS idx_messages_content_hash ON messages(content_hash);

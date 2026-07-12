CREATE DATABASE IF NOT EXISTS sentinel_ai;
USE sentinel_ai;

-- 1. users
CREATE TABLE IF NOT EXISTS users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'admin',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 11. login_history
CREATE TABLE IF NOT EXISTS login_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    ip VARCHAR(45) NOT NULL,
    login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('SUCCESS', 'FAILED') NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 5. ip_reputation
CREATE TABLE IF NOT EXISTS ip_reputation (
    ip_address VARCHAR(45) PRIMARY KEY,
    reputation_score FLOAT NOT NULL DEFAULT 100.0,
    total_requests INT NOT NULL DEFAULT 0,
    malicious_requests INT NOT NULL DEFAULT 0,
    blocked_requests INT NOT NULL DEFAULT 0,
    sqli_count INT NOT NULL DEFAULT 0,
    xss_count INT NOT NULL DEFAULT 0,
    command_count INT NOT NULL DEFAULT 0,
    traversal_count INT NOT NULL DEFAULT 0,
    bot_count INT NOT NULL DEFAULT 0,
    status ENUM('SAFE', 'SUSPICIOUS', 'BLOCKED') NOT NULL DEFAULT 'SAFE',
    blocked_until TIMESTAMP NULL,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
CREATE INDEX idx_ip_reputation_score ON ip_reputation(reputation_score);

-- 2. requests
CREATE TABLE IF NOT EXISTS requests (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    request_uuid VARCHAR(36) NOT NULL UNIQUE,
    ip_address VARCHAR(45) NOT NULL,
    method ENUM('GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD') NOT NULL,
    protocol ENUM('HTTP/1.0', 'HTTP/1.1', 'HTTP/2', 'HTTP/3'),
    host VARCHAR(255),
    endpoint VARCHAR(2048),
    full_url TEXT,
    query_params JSON,
    headers JSON,
    cookies JSON,
    body LONGTEXT,
    user_agent TEXT,
    content_type VARCHAR(255),
    content_length INT,
    response_status INT,
    response_time_ms INT,
    decision ENUM('ALLOW', 'BLOCK', 'QUARANTINE') NOT NULL,
    country VARCHAR(100),
    city VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (ip_address) REFERENCES ip_reputation(ip_address) ON DELETE CASCADE
);
CREATE INDEX idx_request_uuid ON requests(request_uuid);
CREATE INDEX idx_requests_ip ON requests(ip_address);
CREATE INDEX idx_requests_created_at ON requests(created_at);
CREATE INDEX idx_ip_created ON requests(ip_address, created_at);
CREATE INDEX idx_requests_method ON requests(method);
CREATE INDEX idx_requests_decision ON requests(decision);

-- 3. attack_logs
CREATE TABLE IF NOT EXISTS attack_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    request_id BIGINT NOT NULL,
    attack_type ENUM('SQLI', 'XSS', 'COMMAND_INJECTION', 'PATH_TRAVERSAL', 'BOT', 'UNKNOWN') NOT NULL,
    severity ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL,
    confidence DECIMAL(5,2) NOT NULL,
    detector VARCHAR(100), -- Regex Engine, AI Engine, Hybrid
    matched_pattern TEXT,
    payload_snippet TEXT,
    blocked BOOLEAN NOT NULL DEFAULT FALSE,
    action ENUM('ALLOW', 'BLOCK', 'QUARANTINE'),
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE
);
CREATE INDEX idx_attack_logs_type ON attack_logs(attack_type);
CREATE INDEX idx_attack_logs_severity ON attack_logs(severity);
CREATE INDEX idx_attack_logs_detected_at ON attack_logs(detected_at);

-- 4. ai_analysis
CREATE TABLE IF NOT EXISTS ai_analysis (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    request_id BIGINT NOT NULL UNIQUE,
    model_name VARCHAR(100) NOT NULL,
    prompt TEXT NOT NULL,
    raw_response TEXT NOT NULL,
    summary TEXT,
    attack_type ENUM('SQLI', 'XSS', 'COMMAND_INJECTION', 'PATH_TRAVERSAL', 'BOT', 'UNKNOWN'),
    severity ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'),
    confidence DECIMAL(5,2),
    explanation TEXT,
    recommendation TEXT,
    tokens_used INT,
    processing_time_ms INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE
);

-- 6. firewall_rules
CREATE TABLE IF NOT EXISTS firewall_rules (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    rule_name VARCHAR(255) NOT NULL,
    rule_type VARCHAR(50) NOT NULL,
    target VARCHAR(255) NOT NULL,
    action ENUM('ALLOW', 'BLOCK', 'QUARANTINE') NOT NULL,
    reason TEXT,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    priority INT NOT NULL DEFAULT 100,
    created_by BIGINT,
    expires_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_firewall_rules_enabled ON firewall_rules(enabled);

-- 7. security_events
CREATE TABLE IF NOT EXISTS security_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    request_id BIGINT,
    event_type VARCHAR(100) NOT NULL,
    severity ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL,
    message TEXT NOT NULL,
    source VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE SET NULL
);
CREATE INDEX idx_security_events_created_at ON security_events(created_at);

-- 8. threat_reports
CREATE TABLE IF NOT EXISTS threat_reports (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    report_name VARCHAR(255) NOT NULL,
    summary TEXT,
    total_requests INT NOT NULL DEFAULT 0,
    blocked_requests INT NOT NULL DEFAULT 0,
    top_attack ENUM('SQLI', 'XSS', 'COMMAND_INJECTION', 'PATH_TRAVERSAL', 'BOT', 'UNKNOWN'),
    top_ip VARCHAR(45),
    generated_by ENUM('SYSTEM', 'AI'),
    recommendation TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 9. system_settings
CREATE TABLE IF NOT EXISTS system_settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value VARCHAR(255) NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO system_settings (setting_key, setting_value, description) VALUES
('AI_CONFIDENCE_THRESHOLD', '80', 'Minimum confidence score for AI to auto-block'),
('TEMP_BLOCK_MINUTES', '30', 'Duration to temporarily block suspicious IPs'),
('BOT_RATE_LIMIT', '100', 'Maximum requests per minute before identifying as bot'),
('AI_ENABLED', 'true', 'Enable or disable AI analysis');

-- 10. blocked_ips
CREATE TABLE IF NOT EXISTS blocked_ips (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    ip_address VARCHAR(45) NOT NULL,
    rule_id BIGINT,
    blocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    status ENUM('BLOCKED', 'UNBLOCKED') NOT NULL DEFAULT 'BLOCKED',
    FOREIGN KEY (rule_id) REFERENCES firewall_rules(id) ON DELETE SET NULL
);
CREATE INDEX idx_blocked_ips_ip ON blocked_ips(ip_address);

-- 12. protected_domains
CREATE TABLE IF NOT EXISTS protected_domains (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    host VARCHAR(255) NOT NULL UNIQUE,
    origin_url TEXT NOT NULL,
    description TEXT,
    app_type VARCHAR(50) NOT NULL DEFAULT 'Custom',
    environment VARCHAR(50) NOT NULL DEFAULT 'Docker',
    icon VARCHAR(10),
    color VARCHAR(20),
    status VARCHAR(30) NOT NULL DEFAULT 'unknown',
    risk VARCHAR(20) NOT NULL DEFAULT 'none',
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    protection_mode VARCHAR(20) NOT NULL DEFAULT 'block',
    owner VARCHAR(255),
    team VARCHAR(255),
    business_unit VARCHAR(255),
    criticality VARCHAR(20) NOT NULL DEFAULT 'Medium',
    internet_facing BOOLEAN NOT NULL DEFAULT TRUE,
    production BOOLEAN NOT NULL DEFAULT FALSE,
    health_status INT,
    health_latency_ms FLOAT,
    last_seen TIMESTAMP NULL,
    last_request_at TIMESTAMP NULL,
    last_attack_at TIMESTAMP NULL,
    last_block_at TIMESTAMP NULL,
    ssl_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ssl_expiry TIMESTAMP NULL,
    tls_version VARCHAR(20),
    https_redirect BOOLEAN NOT NULL DEFAULT FALSE,
    proxy_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    proxy_port INT,
    listen_port INT,
    upstream_port INT,
    tags JSON,
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    deleted_by BIGINT,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_protected_domains_name ON protected_domains(name);
CREATE INDEX idx_protected_domains_host ON protected_domains(host);
CREATE INDEX idx_protected_domains_status ON protected_domains(status);
CREATE INDEX idx_protected_domains_risk ON protected_domains(risk);
CREATE INDEX idx_protected_domains_enabled ON protected_domains(enabled);

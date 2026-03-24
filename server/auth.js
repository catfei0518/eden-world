/**
 * 简单的用户认证系统
 * 使用 JSON 文件存储用户数据
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const USERS_FILE = path.join(__dirname, 'users.json');
const GAME_VERSION = 'v0.14.0';

// 资源清单
const RESOURCE_MANIFEST = {
    version: GAME_VERSION,
    resourceVersion: 'v0.1.0',  // 资源包版本（独立管理，仅资源变更时更新）
    updateTime: '2024-03-24',
    announcement: `🎉 欢迎来到伊甸世界 v0.14.0！<br>• 资源本地缓存，下载后离线可玩<br>• 增量更新，只下载变化的文件<br>• 新增森林春夏秋冬四季纹理`,
    resources: [
        { key: 'textures', version: '1.0.0', size: '~50MB', description: '游戏纹理资源' },
        { key: 'audio', version: '1.0.0', size: '~10MB', description: '游戏音效资源' },
        { key: 'shaders', version: '1.0.0', size: '~1MB', description: '着色器资源' }
    ]
};

// 简单的密码 hash（生产环境应使用 bcrypt）
function hashPassword(password, salt) {
    return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

function generateSalt() {
    return crypto.randomBytes(16).toString('hex');
}

// 加载用户数据
function loadUsers() {
    try {
        if (fs.existsSync(USERS_FILE)) {
            return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('加载用户数据失败:', e);
    }
    return { users: [] };
}

// 保存用户数据
function saveUsers(data) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
}

// 生成 JWT token（简化版）
function generateToken(user) {
    const payload = {
        id: user.id,
        username: user.username,
        exp: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7天过期
    };
    const secret = 'eden-world-secret-key-2024';
    const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
    const signature = crypto.createHmac('sha256', secret).update(base64Payload).digest('hex');
    return `${base64Payload}.${signature}`;
}

// 验证 JWT token
function verifyToken(token) {
    try {
        const [payloadBase64, signature] = token.split('.');
        const secret = 'eden-world-secret-key-2024';
        const expectedSignature = crypto.createHmac('sha256', secret).update(payloadBase64).digest('hex');
        
        if (signature !== expectedSignature) {
            return null;
        }
        
        const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());
        
        if (payload.exp < Date.now()) {
            return null; // token 过期
        }
        
        return payload;
    } catch (e) {
        return null;
    }
}

// 注册
function register(username, password) {
    const data = loadUsers();
    
    // 检查用户名是否存在
    if (data.users.find(u => u.username === username)) {
        return { error: '用户名已存在' };
    }
    
    // 验证用户名格式
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
        return { error: '用户名必须为3-20位字母、数字或下划线' };
    }
    
    // 验证密码长度
    if (password.length < 6) {
        return { error: '密码至少6位' };
    }
    
    // 创建用户
    const salt = generateSalt();
    const user = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2),
        username,
        passwordHash: hashPassword(password, salt),
        salt,
        createdAt: new Date().toISOString(),
        lastLogin: null
    };
    
    data.users.push(user);
    saveUsers(data);
    
    return { success: true, user: { id: user.id, username: user.username, role: user.role || 'user' } };
}

// 登录
function login(username, password) {
    const data = loadUsers();
    const user = data.users.find(u => u.username === username);
    
    if (!user) {
        return { error: '用户名或密码错误' };
    }
    
    const passwordHash = hashPassword(password, user.salt);
    if (passwordHash !== user.passwordHash) {
        return { error: '用户名或密码错误' };
    }
    
    // 更新最后登录时间
    user.lastLogin = new Date().toISOString();
    saveUsers(data);
    
    const token = generateToken(user);
    
    return { 
        success: true, 
        token,
        user: { id: user.id, username: user.username, role: user.role || 'user' }
    };
}

// 获取用户信息
function getUserInfo(token) {
    const payload = verifyToken(token);
    if (!payload) {
        return null;
    }
    
    const data = loadUsers();
    const user = data.users.find(u => u.id === payload.id);
    
    if (!user) {
        return null;
    }
    
    return { id: user.id, username: user.username, role: user.role || 'user', createdAt: user.createdAt };
}

module.exports = {
    register,
    login,
    verifyToken,
    getUserInfo,
    getVersionInfo: () => RESOURCE_MANIFEST
};

/**
 * 伊甸世界 - 游戏服务器
 * 运行游戏逻辑 + LLM决策 + EMQX通信
 */

const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { LLMProxy } = require('./llm-proxy');
const { GameEngine } = require('./game-engine');
const auth = require('./auth');

const PORT = 3333;
const GAME_VERSION = 'v0.14.0';

// 资源文件哈希表（启动时生成）
const RESOURCE_HASHES = {};

// 计算文件MD5
function computeFileHash(filePath) {
    try {
        const buffer = fs.readFileSync(filePath);
        return crypto.createHash('md5').update(buffer).digest('hex');
    } catch (e) {
        return null;
    }
}

// 扫描资源目录并生成哈希表
function scanResourceHashes() {
    const imgDir = path.join(__dirname, '../shared/textures/img');
    if (!fs.existsSync(imgDir)) return;
    
    const files = fs.readdirSync(imgDir);
    for (const file of files) {
        if (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg')) {
            const filePath = path.join(imgDir, file);
            const hash = computeFileHash(filePath);
            if (hash) {
                RESOURCE_HASHES[`img/${file}`] = hash;
            }
        }
    }
    console.log(`📦 资源哈希已更新: ${Object.keys(RESOURCE_HASHES).length} 个文件`);
}

// 启动时扫描哈希
scanResourceHashes();

class EdenServer {
    constructor() {
        this.app = express();
        this.app.use(express.json());  // 解析JSON body
        this.server = http.createServer(this.app);
        this.wss = new WebSocketServer({ server: this.server });
        
        // LLM代理
        this.llmProxy = new LLMProxy();
        
        // 游戏引擎
        this.gameEngine = new GameEngine(this.llmProxy);
        
        this.setupRoutes();
        this.setupWebSocket();
    }
    
    setupRoutes() {
        // 健康检查
        this.app.get('/health', (req, res) => {
            res.json({ 
                status: 'ok', 
                players: this.gameEngine.getPlayerCount(),
                characters: this.gameEngine.getCharacterCount()
            });
        });
        
        // 在线玩家数量
        this.app.get('/api/players/count', (req, res) => {
            const playerCount = this.wss ? this.wss.clients.size : 0;
            res.json({ 
                count: playerCount,
                servers: [
                    { id: 'main', name: '全球服 - 亚洲', count: playerCount }
                ]
            });
        });
        
        // LLM代理端点（解决CORS问题）
        this.app.post('/api/llm', async (req, res) => {
            try {
                const body = req.body;
                const result = await this.llmProxy.generate(body);
                res.json(result);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        
        // LLM状态（前端检查服务器LLM是否可用）
        this.app.get('/api/llm/status', (req, res) => {
            res.json({ 
                available: true, 
                url: 'server' 
            });
        });
        
        // ========== 认证相关 API ==========
        
        // 版本信息
        this.app.get('/api/version', (req, res) => {
            res.json(auth.getVersionInfo());
        });
        
        // 资源清单（用于检查更新）
        this.app.get('/api/resources', (req, res) => {
            // 动态生成资源列表（带哈希）
            const resources = Object.entries(RESOURCE_HASHES).map(([key, hash]) => ({
                key,
                url: `/${key}`,
                type: 'image',
                hash
            }));
            
            const versionInfo = auth.getVersionInfo();
            
            res.json({
                version: GAME_VERSION,
                resourceVersion: versionInfo.resourceVersion,
                updateTime: '2024-03-24',
                resources,
                patches: [
                    { from: 'v0.12.0', to: 'v0.14.0', size: '~2MB', description: '资源缓存+增量更新+新森林纹理' },
                    { from: 'v0.11.0', to: 'v0.12.0', size: '~5MB', description: 'DNA系统+物品面板' }
                ]
            });
        });
        
        // 用户注册
        this.app.post('/api/register', (req, res) => {
            const { username, password } = req.body;
            
            if (!username || !password) {
                return res.status(400).json({ error: '用户名和密码不能为空' });
            }
            
            const result = auth.register(username, password);
            
            if (result.error) {
                return res.status(400).json({ error: result.error });
            }
            
            res.json({ success: true, message: '注册成功' });
        });
        
        // 用户登录
        this.app.post('/api/login', (req, res) => {
            const { username, password } = req.body;
            
            if (!username || !password) {
                return res.status(400).json({ error: '用户名和密码不能为空' });
            }
            
            const result = auth.login(username, password);
            
            if (result.error) {
                return res.status(401).json({ error: result.error });
            }
            
            res.json({
                success: true,
                token: result.token,
                user: result.user
            });
        });
        
        // 获取用户信息（需要认证）
        this.app.get('/api/user/profile', (req, res) => {
            const authHeader = req.headers.authorization;
            
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ error: '未授权' });
            }
            
            const token = authHeader.substring(7);
            const user = auth.getUserInfo(token);
            
            if (!user) {
                return res.status(401).json({ error: 'token无效或已过期' });
            }
            
            res.json({ user });
        });
        
        // 调试接口 - 获取游戏状态
        this.app.get('/api/state', (req, res) => {
            res.json(this.gameEngine.getState());
        });
        
        // 客户端HTML路由 - 必须放在静态文件之前才能生效
        this.app.get('/client', (req, res) => {
            res.sendFile(path.join(__dirname, '../dist-client/index.html'));
        });
        
        // 登录界面路由
        this.app.get('/lobby', (req, res) => {
            res.sendFile(path.join(__dirname, '../client-lobby/index.html'));
        });
        
        // 根路径指向登录界面
        this.app.get('/', (req, res) => {
            // 检查是否有 token 参数，有则跳转到游戏
            const token = req.query.token;
            if (token) {
                const user = auth.getUserInfo(token);
                if (user) {
                    return res.redirect('/client');
                }
            }
            // 默认显示登录界面
            res.sendFile(path.join(__dirname, '../client-lobby/index.html'));
        });
        
        // 静态文件
        this.app.use('/static', express.static(path.join(__dirname, '../dist-client')));
        this.app.use('/assets', express.static(path.join(__dirname, '../dist-client/assets')));
        this.app.use('/lobby-assets', express.static(path.join(__dirname, '../client-lobby')));
        this.app.use('/img', express.static(path.join(__dirname, '../shared/textures/img')));
        this.app.use(express.static(path.join(__dirname, '../dist-release')));
        
        // SPA fallback (放到最后)
        this.app.get('/{*path}', (req, res) => {
            res.sendFile(path.join(__dirname, '../dist-release/index.html'));
        });
    }
    
    setupWebSocket() {
        // 玩家WebSocket -> 角色ID映射
        this.playerCharacterMap = new Map();
        
        this.wss.on('connection', (ws) => {
            console.log('🔌 玩家连接');
            
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    this.handlePlayerMessage(ws, data);
                } catch (e) {
                    console.error('消息解析错误:', e);
                }
            });
            
            ws.on('close', () => {
                console.log('🔌 玩家断开');
                this.playerCharacterMap.delete(ws);
            });
            
            // 发送初始状态（包含世界种子）
            ws.send(JSON.stringify({
                type: 'init',
                data: this.gameEngine.getState()
            }));
        });
        
        // 启动游戏循环 - 固定20fps
        const TICK_RATE = 200;  // 200ms = 5fps (观察游戏不需要频繁更新)
        setInterval(() => {
            this.gameEngine.update();
            this.broadcastState();
        }, TICK_RATE);
    }
    
    handlePlayerMessage(ws, data) {
        switch (data.type) {
            case 'input':
                // Latency Compensation: 处理玩家输入（带序列号）
                if (data.characterId && data.seq !== undefined && data.input) {
                    this.gameEngine.handleInput(data.characterId, data.seq, data.input);
                    this.playerCharacterMap.set(ws, data.characterId);
                    
                    // 立即发送确认
                    ws.send(JSON.stringify({
                        type: 'input_ack',
                        seq: data.seq,
                        characterId: data.characterId,
                        timestamp: Date.now()
                    }));
                }
                break;
            case 'select_character':
                // 选择角色
                const char = this.gameEngine.characters.get(data.characterId);
                if (char) {
                    this.playerCharacterMap.set(ws, data.characterId);
                    ws.send(JSON.stringify({
                        type: 'character_selected',
                        characterId: data.characterId,
                        state: {
                            x: char.x,
                            y: char.y,
                            health: char.health,
                            energy: char.energy
                        }
                    }));
                }
                break;
        }
    }
    
    // 广播游戏状态（Latency Compensation版本）
    broadcastState() {
        const state = this.gameEngine.getBroadcastState();
        
        this.wss.clients.forEach(client => {
            if (client.readyState === 1) {
                client.send(JSON.stringify({
                    type: 'state',
                    data: state
                }));
            }
        });
    }
    
    start() {
        this.server.listen(PORT, () => {
            console.log(`
╔═══════════════════════════════════════════════╗
║       🌟 伊甸世界游戏服务器 🌟              ║
╠═══════════════════════════════════════════════╣
║  HTTP:      http://114.66.13.167:${PORT}        ║
║  WebSocket: ws://114.66.13.167:${PORT}        ║
╚═══════════════════════════════════════════════╝
            `);
        });
        
        // 启动游戏循环
        this.gameEngine.start(() => {
            this.broadcastState();
        });
    }
}

// 启动服务器
const server = new EdenServer();
server.start();

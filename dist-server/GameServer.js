"use strict";
/**
 * 伊甸世界 - 游戏服务器主类
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameServer = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = require("http");
const ws_1 = require("ws");
const path_1 = __importDefault(require("path"));
const CharacterManager_1 = require("./CharacterManager");
const WorldState_1 = require("./WorldState");
const GameLoop_1 = require("./GameLoop");
const WebSocketHandler_1 = require("./WebSocketHandler");
const auth_1 = __importDefault(require("./auth"));
const PORT = 3333;
const GAME_VERSION = 'v0.15.0';
class GameServer {
    constructor() {
        // 初始化组件
        this.worldState = new WorldState_1.WorldState();
        this.characterManager = new CharacterManager_1.CharacterManager();
        this.characterManager.setWorldState(this.worldState); // Phase 1: 传递真实WorldState
        this.gameLoop = new GameLoop_1.GameLoop(this.characterManager, this.worldState);
        this.wsHandler = new WebSocketHandler_1.WebSocketHandler(this.characterManager, this.worldState);
        // 创建角色
        this.createInitialCharacters();
        // Express应用
        this.app = (0, express_1.default)();
        this.app.use((0, cors_1.default)()); // 允许跨域访问
        this.app.use(express_1.default.json()); // 解析JSON body
        this.setupRoutes();
        // HTTP服务器
        this.server = (0, http_1.createServer)(this.app);
        // WebSocket服务器
        this.wss = new ws_1.WebSocketServer({ server: this.server });
        this.setupWebSocket();
        // 游戏循环回调 - 广播状态
        this.gameLoop.onTick((tick) => {
            // 每2个tick广播一次（约10次/秒）
            if (tick % 2 === 0) {
                this.wsHandler.broadcastState(tick);
            }
        });
    }
    createInitialCharacters() {
        // 找到合适的出生地（有水源和食物）
        const spawnPos = CharacterManager_1.CharacterManager.findGoodSpawnPosition(this.worldState);
        // 创建亚当（在出生地）
        this.characterManager.createCharacter('adam', spawnPos.x, spawnPos.y, '亚当');
        // 创建夏娃（在亚当旁边）
        this.characterManager.createCharacter('eve', spawnPos.x + 2, spawnPos.y + 1, '夏娃');
        console.log(`👤 创建初始角色: 亚当(${spawnPos.x}, ${spawnPos.y}), 夏娃(${spawnPos.x + 2}, ${spawnPos.y + 1})`);
    }
    setupRoutes() {
        // 健康检查
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'ok',
                players: this.wsHandler.getClientCount(),
                characters: this.characterManager.getAll().length,
                tick: this.gameLoop.getCurrentTick(),
                version: GAME_VERSION
            });
        });
        // 资源清单
        this.app.get('/api/resources', (req, res) => {
            const fs = require('fs');
            const path = require('path');
            const crypto = require('crypto');
            const imgDir = path.join(__dirname, '../shared/textures/img');
            const resources = [];
            if (fs.existsSync(imgDir)) {
                const files = fs.readdirSync(imgDir);
                for (const file of files) {
                    if (file.endsWith('.png') || file.endsWith('.jpg')) {
                        const filePath = path.join(imgDir, file);
                        const hash = crypto.createHash('md5').update(fs.readFileSync(filePath)).digest('hex');
                        resources.push({
                            key: `img/${file}`,
                            url: `/img/${file}`,
                            type: 'image',
                            hash
                        });
                    }
                }
            }
            res.json({
                version: GAME_VERSION,
                resourceVersion: 'v0.1.1',
                resources
            });
        });
        // API路由
        this.app.get('/api/version', (req, res) => {
            res.json({
                version: GAME_VERSION,
                resourceVersion: 'v0.1.0',
                updateTime: '2026-03-29',
                announcement: `🎉 欢迎来到伊甸世界 ${GAME_VERSION}！<br><br>🆕 Phase 1.6 新功能：<br>• 纯卡路里饥饿系统：真实卡路里计算<br>• 可拾取物品：树枝、石头、草本<br>• 双栏状态面板：装备栏+背包<br>• 动作进度条：头顶显示进度<br>• 移动抽搐修复<br>• CORS跨域修复<br><br>🔧 控制台命令：season春夏秋冬、speed快慢、pause继续`
            });
        });
        // 在线人数
        this.app.get('/api/players/count', (req, res) => {
            res.json({ count: this.wsHandler.getClientCount() });
        });
        // 用户注册
        this.app.post('/api/register', (req, res) => {
            const { username, password } = req.body;
            if (!username || !password) {
                return res.status(400).json({ error: '用户名和密码不能为空' });
            }
            const result = auth_1.default.register(username, password);
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
            const result = auth_1.default.login(username, password);
            if (result.error) {
                return res.status(401).json({ error: result.error });
            }
            res.json({
                success: true,
                token: result.token,
                user: result.user
            });
        });
        // 用户信息
        this.app.get('/api/user/profile', (req, res) => {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ error: '未授权' });
            }
            const token = authHeader.substring(7);
            const user = auth_1.default.getUserInfo(token);
            if (!user) {
                return res.status(401).json({ error: 'token无效或已过期' });
            }
            res.json({ user });
        });
        // 季节切换API
        this.app.post('/api/season', (req, res) => {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ error: '未授权' });
            }
            const token = authHeader.substring(7);
            const user = auth_1.default.getUserInfo(token);
            if (!user || user.role !== 'admin') {
                return res.status(403).json({ error: '需要管理员权限' });
            }
            const { season } = req.body;
            if (!['spring', 'summer', 'autumn', 'winter'].includes(season)) {
                return res.status(400).json({ error: '无效的季节' });
            }
            this.worldState.setSeason(season);
            this.wsHandler.broadcast({ type: 'season_changed', season });
            res.json({ success: true, season });
        });
        // 客户端HTML
        this.app.get('/client', (req, res) => {
            res.sendFile(path_1.default.join(__dirname, '../dist-client/index.html'));
        });
        // 登录页
        this.app.get('/lobby', (req, res) => {
            res.sendFile(path_1.default.join(__dirname, '../client-lobby/index.html'));
        });
        // 管理控制台
        this.app.get('/console', (req, res) => {
            res.sendFile(path_1.default.join(__dirname, '../client-console/index.html'));
        });
        // 首页重定向到登录页
        this.app.get('/', (req, res) => {
            res.redirect('/lobby');
        });
        // 静态资源
        this.app.use('/static', express_1.default.static(path_1.default.join(__dirname, '../dist-client')));
        this.app.use('/assets', express_1.default.static(path_1.default.join(__dirname, '../dist-client/assets')));
        this.app.use('/lobby-assets', express_1.default.static(path_1.default.join(__dirname, '../client-lobby')));
        this.app.use('/img', express_1.default.static(path_1.default.join(__dirname, '../shared/textures/img')));
        this.app.use(express_1.default.static(path_1.default.join(__dirname, '../dist-release')));
        // 404处理
        this.app.use((req, res) => {
            res.status(404).send('Not Found');
        });
    }
    setupWebSocket() {
        this.wss.on('connection', (ws) => {
            const clientId = this.wsHandler.handleConnection(ws);
            console.log(`🔗 WebSocket连接建立: ${clientId}`);
        });
        this.wss.on('error', (err) => {
            console.error('❌ WebSocket服务器错误:', err);
        });
    }
    start() {
        this.server.listen(PORT, () => {
            console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    伊甸世界服务器                            ║
╠══════════════════════════════════════════════════════════════╣
║  🌐 HTTP:      http://localhost:${PORT}                        ║
║  🔌 WebSocket: ws://localhost:${PORT}                         ║
║  📦 版本:      ${GAME_VERSION}                                    ║
║  🌍 世界:      ${this.worldState.getWidth()}x${this.worldState.getHeight()} 格子                 ║
╚══════════════════════════════════════════════════════════════╝
            `);
        });
        // 启动游戏循环
        this.gameLoop.start();
    }
    stop() {
        console.log('🛑 正在停止服务器...');
        this.gameLoop.stop();
        this.wss.close();
        this.server.close();
        console.log('✅ 服务器已停止');
    }
}
exports.GameServer = GameServer;

/**
 * 伊甸世界 - 游戏服务器主类
 */

import express from 'express';
import { createServer } from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import path from 'path';

import { CharacterManager } from './CharacterManager';
import { WorldState } from './WorldState';
import { GameLoop } from './GameLoop';
import { WebSocketHandler } from './WebSocketHandler';
import auth from './auth';

const PORT = 3333;
const GAME_VERSION = 'v0.14.0';

export class GameServer {
    private app: express.Application;
    private server: ReturnType<typeof createServer>;
    private wss: WebSocketServer;
    
    private characterManager: CharacterManager;
    private worldState: WorldState;
    private gameLoop: GameLoop;
    private wsHandler: WebSocketHandler;
    
    constructor() {
        // 初始化组件
        this.worldState = new WorldState();
        this.characterManager = new CharacterManager();
        this.gameLoop = new GameLoop(this.characterManager, this.worldState);
        this.wsHandler = new WebSocketHandler(this.characterManager, this.worldState);
        
        // 创建角色
        this.createInitialCharacters();
        
        // Express应用
        this.app = express();
        this.app.use(express.json());  // 解析JSON body
        this.setupRoutes();
        
        // HTTP服务器
        this.server = createServer(this.app);
        
        // WebSocket服务器
        this.wss = new WebSocketServer({ server: this.server });
        this.setupWebSocket();
        
        // 游戏循环回调 - 广播状态
        this.gameLoop.onTick((tick) => {
            // 每2个tick广播一次（约10次/秒）
            if (tick % 2 === 0) {
                this.wsHandler.broadcastState(tick);
            }
        });
    }
    
    private createInitialCharacters(): void {
        // 找到合适的出生地（有水源和食物）
        const spawnPos = CharacterManager.findGoodSpawnPosition(this.worldState);
        
        // 创建亚当（在出生地）
        this.characterManager.createCharacter('adam', spawnPos.x, spawnPos.y, '亚当');
        
        // 创建夏娃（在亚当旁边）
        this.characterManager.createCharacter('eve', spawnPos.x + 2, spawnPos.y + 1, '夏娃');
        
        console.log(`👤 创建初始角色: 亚当(${spawnPos.x}, ${spawnPos.y}), 夏娃(${spawnPos.x + 2}, ${spawnPos.y + 1})`);
    }
    
    private setupRoutes(): void {
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
                updateTime: '2024-03-24',
                announcement: `🎉 欢迎来到伊甸世界 v${GAME_VERSION}！`
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
        
        // 用户信息
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
        
        // 季节切换API
        this.app.post('/api/season', (req, res) => {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ error: '未授权' });
            }
            const token = authHeader.substring(7);
            const user = auth.getUserInfo(token);
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
            res.sendFile(path.join(__dirname, '../dist-client/index.html'));
        });
        
        // 登录页
        this.app.get('/lobby', (req, res) => {
            res.sendFile(path.join(__dirname, '../client-lobby/index.html'));
        });
        
        // 管理控制台
        this.app.get('/console', (req, res) => {
            res.sendFile(path.join(__dirname, '../client-console/index.html'));
        });
        
        // 首页重定向到登录页
        this.app.get('/', (req, res) => {
            res.redirect('/lobby');
        });
        
        // 静态资源
        this.app.use('/static', express.static(path.join(__dirname, '../dist-client')));
        this.app.use('/assets', express.static(path.join(__dirname, '../dist-client/assets')));
        this.app.use('/lobby-assets', express.static(path.join(__dirname, '../client-lobby')));
        this.app.use('/img', express.static(path.join(__dirname, '../shared/textures/img')));
        this.app.use(express.static(path.join(__dirname, '../dist-release')));
        
        // 404处理
        this.app.use((req, res) => {
            res.status(404).send('Not Found');
        });
    }
    
    private setupWebSocket(): void {
        this.wss.on('connection', (ws) => {
            const clientId = this.wsHandler.handleConnection(ws);
            console.log(`🔗 WebSocket连接建立: ${clientId}`);
        });
        
        this.wss.on('error', (err) => {
            console.error('❌ WebSocket服务器错误:', err);
        });
    }
    
    start(): void {
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
    
    stop(): void {
        console.log('🛑 正在停止服务器...');
        this.gameLoop.stop();
        this.wss.close();
        this.server.close();
        console.log('✅ 服务器已停止');
    }
}

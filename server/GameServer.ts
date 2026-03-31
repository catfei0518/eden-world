/**
 * 伊甸世界 - 游戏服务器主类
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import path from 'path';

import { CharacterManager } from './CharacterManager';
import { WorldState } from './WorldState';
import { GameLoop } from './GameLoop';
import { WebSocketHandler } from './WebSocketHandler';
import { TimeManager } from './TimeManager';
import { SaveManager } from './SaveManager';
import auth from './auth';

const PORT = 3333;
const GAME_VERSION = 'v0.15.0';

export class GameServer {
    private app: express.Application;
    private server: ReturnType<typeof createServer>;
    private wss: WebSocketServer;
    
    private characterManager: CharacterManager;
    private worldState: WorldState;
    private gameLoop: GameLoop;
    private wsHandler: WebSocketHandler;
    private timeManager: TimeManager;
    private saveManager: SaveManager;
    
    constructor() {
        // 初始化存档管理器
        this.saveManager = new SaveManager('./saves');
        
        // 尝试加载存档
        const loaded = this.saveManager.load();
        
        // 初始化组件
        this.worldState = new WorldState();
        this.characterManager = new CharacterManager();
        this.characterManager.setWorldState(this.worldState);  // Phase 1: 传递真实WorldState
        this.gameLoop = new GameLoop(this.characterManager, this.worldState);
        this.wsHandler = new WebSocketHandler(this.characterManager, this.worldState);
        this.timeManager = new TimeManager();
        
        // 如果有存档，恢复数据
        if (loaded) {
            this.restoreFromSave();
        }
        
        // 将时间管理器传递给WebSocketHandler
        this.wsHandler.setTimeManager(this.timeManager);
        
        // 设置时间系统事件监听
        this.setupTimeSystem();
        
        // 设置存档回调
        this.setupSaveSystem();
        
        // 始终创建初始角色（如果角色不存在）
        this.createInitialCharacters();
        
        // 如果有存档，恢复角色状态
        if (loaded) {
            this.restoreCharactersFromSave();
        }
        
        // Express应用
        this.app = express();
        this.app.use(cors());  // 允许跨域访问
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
    
    /**
     * 从存档恢复游戏状态
     */
    private restoreFromSave(): void {
        console.log('🔄 从存档恢复游戏状态...');
        
        // 获取存档数据
        const saveInfo = this.saveManager.getSaveInfo();
        if (!saveInfo.exists) return;
        
        // 读取存档
        try {
            const fs = require('fs');
            const saveFile = './saves/eden_world_save.json';
            if (fs.existsSync(saveFile)) {
                const data = JSON.parse(fs.readFileSync(saveFile, 'utf8'));
                
                // 恢复时间
                if (data.time) {
                    this.timeManager.fromJSON(data.time);
                    console.log(`⏰ 时间已恢复: ${data.time.gameYears}年${data.time.gameDays}日`);
                }
                
                // 恢复世界状态
                if (data.world) {
                    this.worldState.fromJSON(data.world);
                    console.log('🌍 世界状态已恢复');
                }
                
                // 恢复角色（这个只是记录，实际恢复在 restoreCharactersFromSave 中）
                if (data.characters) {
                    console.log(`👥 存档中有 ${data.characters.length} 个角色待恢复`);
                }
            }
        } catch (error) {
            console.error('❌ 恢复存档失败:', error);
        }
    }
    
    /**
     * 从存档恢复角色状态
     */
    private restoreCharactersFromSave(): void {
        try {
            const fs = require('fs');
            const saveFile = './saves/eden_world_save.json';
            if (fs.existsSync(saveFile)) {
                const data = JSON.parse(fs.readFileSync(saveFile, 'utf8'));
                if (data.characters) {
                    for (const charData of data.characters) {
                        const existing = this.characterManager.getCharacter(charData.id);
                        if (existing) {
                            existing.fromJSON(charData);
                            console.log(`👤 角色已恢复: ${charData.name} (${charData.id})`);
                        }
                    }
                    console.log(`👥 共恢复 ${data.characters.length} 个角色状态`);
                }
            }
        } catch (error) {
            console.error('❌ 恢复角色失败:', error);
        }
    }
    
    /**
     * 设置存档系统
     */
    private setupSaveSystem(): void {
        // 设置存档数据回调
        this.saveManager.setSaveDataCallback(() => {
            return {
                version: GAME_VERSION,
                timestamp: Date.now(),
                time: this.timeManager.toJSON(),
                world: this.worldState.toJSON(),
                characters: this.characterManager.toJSON()
            };
        });
        
        // 设置加载回调
        this.saveManager.setLoadCallback((data) => {
            // 这个回调在SaveManager.load()中被调用
            // 实际恢复逻辑在restoreFromSave中
        });
        
        // 启动自动存档（每5分钟）
        this.saveManager.startAutoSave();
        
        // 注册进程关闭时的存档
        process.on('SIGINT', () => {
            console.log('\n💾 服务器关闭，保存存档...');
            this.saveManager.saveSync();
            process.exit();
        });
        
        process.on('SIGTERM', () => {
            console.log('\n💾 服务器关闭，保存存档...');
            this.saveManager.saveSync();
            process.exit();
        });
        
        console.log('💾 存档系统已初始化');
    }
    
    /**
     * 设置时间系统
     */
    private setupTimeSystem(): void {
        // 季节变化时更新世界状态
        this.timeManager.on('onSeasonChange', (data) => {
            this.worldState.updateSeasonForBushes(data.season);
            this.wsHandler.broadcast({ 
                type: 'season_changed', 
                season: data.season,
                seasonInfo: data.seasonInfo
            });
        });
        
        // 每小时更新（可以用于AI决策等）
        this.timeManager.on('onHourChange', (data) => {
            const timeInfo = this.timeManager.getFullTimeInfo();
            // 广播时间更新
            this.wsHandler.broadcast({
                type: 'time_update',
                ...timeInfo
            });
            console.log(`⏰ 广播time_update: ${timeInfo.timeString} (${timeInfo.hour}时${timeInfo.minute}分)`);
        });
        
        // 驱动时间前进（每秒一次）
        setInterval(() => {
            if (this.gameLoop.isActive()) {
                // 驱动时间前进1秒（deltaMs）
                this.timeManager.advance(1000);
            }
        }, 1000);
    }
    
    /**
     * 获取时间管理器
     */
    getTimeManager(): TimeManager {
        return this.timeManager;
    }
    
    private createInitialCharacters(): void {
        // 尝试从存档加载角色
        const fs = require('fs');
        const saveFile = './saves/eden_world_save.json';
        let savedCharacters: any[] = [];
        
        if (fs.existsSync(saveFile)) {
            try {
                const data = JSON.parse(fs.readFileSync(saveFile, 'utf8'));
                if (data.characters) {
                    savedCharacters = data.characters;
                }
            } catch (e) {
                console.error('❌ 读取存档角色失败:', e);
            }
        }
        
        // 如果有存档角色，用存档角色创建
        if (savedCharacters.length > 0) {
            for (const charData of savedCharacters) {
                this.characterManager.createCharacterFromSave(charData);
                console.log(`👤 从存档创建角色: ${charData.name} (ID: ${charData.id})`);
            }
            return;
        }
        
        // 没有存档，创建新角色
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
            
            this.timeManager.setSeason(season);
            this.wsHandler.broadcast({ type: 'season_changed', season });
            
            res.json({ success: true, season });
        });
        
        // 时间控制API
        this.app.post('/api/time/speed', (req, res) => {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ error: '未授权' });
            }
            const token = authHeader.substring(7);
            const user = auth.getUserInfo(token);
            if (!user || user.role !== 'admin') {
                return res.status(403).json({ error: '需要管理员权限' });
            }
            
            const { speed } = req.body;
            if (typeof speed !== 'number' || speed < 0) {
                return res.status(400).json({ error: '无效的速度值' });
            }
            
            this.timeManager.setTimeSpeed(speed);
            res.json({ success: true, speed });
        });
        
        // 获取当前时间
        this.app.get('/api/time', (req, res) => {
            res.json(this.timeManager.getFullTimeInfo());
        });
        
        // 手动存档API
        this.app.post('/api/save', (req, res) => {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ error: '未授权' });
            }
            const token = authHeader.substring(7);
            const user = auth.getUserInfo(token);
            if (!user || user.role !== 'admin') {
                return res.status(403).json({ error: '需要管理员权限' });
            }
            
            const success = this.saveManager.save();
            if (success) {
                res.json({ success: true, message: '存档成功' });
            } else {
                res.status(500).json({ error: '存档失败' });
            }
        });
        
        // 获取存档信息API
        this.app.get('/api/save/info', (req, res) => {
            const info = this.saveManager.getSaveInfo();
            res.json(info);
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

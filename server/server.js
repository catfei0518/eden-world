/**
 * 伊甸世界 - 游戏服务器
 * 运行游戏逻辑 + LLM决策 + EMQX通信
 */

const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const path = require('path');
const { LLMProxy } = require('./llm-proxy');
const { GameEngine } = require('./game-engine');

const PORT = 3333;

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
        
        // 调试接口 - 获取游戏状态
        this.app.get('/api/state', (req, res) => {
            res.json(this.gameEngine.getState());
        });
        
        // 客户端HTML路由 - 必须放在静态文件之前才能生效
        this.app.get('/client', (req, res) => {
            res.sendFile(path.join(__dirname, '../dist-client/index.html'));
        });
        
        // 根路径指向新客户端
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, '../dist-client/index.html'));
        });
        
        // 静态文件
        this.app.use('/static', express.static(path.join(__dirname, '../dist-client')));
        this.app.use('/assets', express.static(path.join(__dirname, '../dist-client/assets')));
        this.app.use(express.static(path.join(__dirname, '../dist-release')));
        
        // SPA fallback (放到最后)
        this.app.get('/{*path}', (req, res) => {
            res.sendFile(path.join(__dirname, '../dist-release/index.html'));
        });
    }
    
    setupWebSocket() {
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
            });
            
            // 发送初始状态
            ws.send(JSON.stringify({
                type: 'init',
                data: this.gameEngine.getState()
            }));
        });
    }
    
    handlePlayerMessage(ws, data) {
        switch (data.type) {
            case 'action':
                this.gameEngine.handlePlayerAction(data.action);
                break;
            case 'select_character':
                this.gameEngine.selectCharacter(ws, data.characterId);
                break;
        }
    }
    
    // 广播游戏状态
    broadcastState() {
        const state = this.gameEngine.getState();
        
        // WebSocket广播
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

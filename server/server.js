/**
 * 伊甸世界 - 游戏服务器
 * 运行游戏逻辑 + LLM决策 + EMQX通信
 */

const express = require('express');
const { WebSocketServer } = require('ws');
const mqtt = require('mqtt');
const http = require('http');
const path = require('path');
const { LLMProxy } = require('./llm-proxy');
const { GameEngine } = require('./game-engine');

const PORT = 3334;
const EMQX_URL = 'mqtt://localhost:1883';

class EdenServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.wss = new WebSocketServer({ server: this.server });
        
        // LLM代理
        this.llmProxy = new LLMProxy();
        
        // 游戏引擎
        this.gameEngine = new GameEngine(this.llmProxy);
        
        // EMQX客户端
        this.mqttClient = null;
        
        this.setupRoutes();
        this.setupWebSocket();
        this.setupEMQX();
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
        
        // LLM代理端点
        this.app.post('/api/llm', async (req, res) => {
            try {
                const body = req.body;
                const result = await this.llmProxy.generate(body);
                res.json(result);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        
        // 静态文件
        this.app.use(express.static(path.join(__dirname, '../dist-release')));
        
        // SPA fallback
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
    
    setupEMQX() {
        try {
            this.mqttClient = mqtt.connect(EMQX_URL);
            
            this.mqttClient.on('connect', () => {
                console.log('📡 EMQX已连接');
                
                // 订阅游戏状态主题
                this.mqttClient.subscribe('eden/world/+/state', (err) => {
                    if (!err) {
                        console.log('📡 已订阅: eden/world/+/state');
                    }
                });
            });
            
            this.mqttClient.on('message', (topic, message) => {
                this.handleMQTTMessage(topic, message);
            });
            
            this.mqttClient.on('error', (err) => {
                console.error('📡 EMQX错误:', err.message);
            });
        } catch (error) {
            console.warn('📡 EMQX连接失败，继续使用WebSocket:', error.message);
        }
    }
    
    handleMQTTMessage(topic, message) {
        // 处理其他服务器的消息
        try {
            const data = JSON.parse(message.toString());
            
            // 广播给所有连接的浏览器客户端
            this.wss.clients.forEach(client => {
                if (client.readyState === 1) {
                    client.send(JSON.stringify({
                        type: 'sync',
                        data: data
                    }));
                }
            });
        } catch (e) {
            // 忽略解析错误
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
        
        // EMQX广播
        if (this.mqttClient && this.mqttClient.connected) {
            this.mqttClient.publish('eden/world/1/state', JSON.stringify(state));
        }
    }
    
    start() {
        this.server.listen(PORT, () => {
            console.log(`
╔═══════════════════════════════════════════════╗
║       🌟 伊甸世界游戏服务器 🌟              ║
╠═══════════════════════════════════════════════╣
║  HTTP:      http://114.66.13.167:${PORT}        ║
║  WebSocket:  ws://114.66.13.167:${PORT}        ║
║  EMQX:      ${EMQX_URL}            ║
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

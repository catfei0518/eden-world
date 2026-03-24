"use strict";
/**
 * 伊甸世界 - WebSocket处理器
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketHandler = void 0;
class WebSocketHandler {
    constructor(characterManager, worldState) {
        this.clients = new Map();
        this.pendingInputs = new Map();
        this.inputSeq = 0;
        this.characterManager = characterManager;
        this.worldState = worldState;
    }
    handleConnection(ws) {
        const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        this.clients.set(clientId, {
            ws,
            characterId: null,
            playerId: clientId
        });
        console.log(`🔌 客户端连接: ${clientId} (当前在线: ${this.clients.size})`);
        // 发送初始状态
        this.sendInit(clientId);
        // 设置消息处理
        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                this.handleMessage(clientId, message);
            }
            catch (e) {
                console.error('❌ 消息解析失败:', e);
            }
        });
        // 设置关闭处理
        ws.on('close', () => {
            this.handleDisconnect(clientId);
        });
        // 设置错误处理
        ws.on('error', (err) => {
            console.error(`❌ WebSocket错误 (${clientId}):`, err);
        });
        return clientId;
    }
    sendInit(clientId) {
        const conn = this.clients.get(clientId);
        if (!conn)
            return;
        const initMessage = {
            type: 'init',
            data: {
                world: {
                    tiles: this.worldState.getTiles2D(),
                    groundObjects: this.worldState.getAllGroundObjects(),
                    worldSeed: this.worldState.getSeed()
                },
                characters: this.characterManager.serialize(),
                season: this.worldState.getSeason(),
                width: this.worldState.getWidth(),
                height: this.worldState.getHeight()
            }
        };
        conn.ws.send(JSON.stringify(initMessage));
        console.log(`📤 发送init给 ${clientId}: ${this.worldState.getAllTiles().length} 格子, ${this.worldState.getAllGroundObjects().length} 物品`);
    }
    handleMessage(clientId, message) {
        const conn = this.clients.get(clientId);
        if (!conn)
            return;
        switch (message.type) {
            case 'select_character':
                this.handleSelectCharacter(clientId, message.characterId);
                break;
            case 'input':
                this.handleInput(clientId, message);
                break;
            case 'season':
                this.handleSeasonChange(clientId, message.season);
                break;
        }
    }
    handleSelectCharacter(clientId, characterId) {
        const success = this.characterManager.selectCharacter(characterId);
        if (success) {
            const conn = this.clients.get(clientId);
            if (conn) {
                conn.characterId = characterId;
            }
            const fullData = this.characterManager.serializeFull(characterId);
            if (fullData) {
                const response = {
                    type: 'character_selected',
                    characterId,
                    data: fullData
                };
                conn.ws.send(JSON.stringify(response));
                console.log(`🎭 客户端 ${clientId} 选择了角色 ${characterId}`);
            }
        }
    }
    handleInput(clientId, message) {
        const conn = this.clients.get(clientId);
        if (!conn)
            return;
        const { characterId, seq, input } = message;
        const character = this.characterManager.getCharacter(characterId);
        if (!character) {
            // 角色不存在，拒绝
            const ack = {
                type: 'input_ack',
                seq,
                accepted: false
            };
            conn.ws.send(JSON.stringify(ack));
            return;
        }
        // 处理输入
        if (input.action === 'move' && input.target) {
            const accepted = this.characterManager.moveCharacter(characterId, input.target.x, input.target.y, this.worldState.getTick());
            const ack = {
                type: 'input_ack',
                seq,
                accepted,
                position: accepted ? { x: input.target.x, y: input.target.y } : undefined
            };
            conn.ws.send(JSON.stringify(ack));
        }
        else if (input.action === 'idle') {
            this.characterManager.updateCharacterAction(characterId, 'idle');
            const ack = {
                type: 'input_ack',
                seq,
                accepted: true,
                position: { x: character.x, y: character.y }
            };
            conn.ws.send(JSON.stringify(ack));
        }
    }
    handleSeasonChange(clientId, season) {
        this.worldState.setSeason(season);
        // 广播给所有客户端
        this.broadcast({
            type: 'season_changed',
            season: season
        });
        console.log(`🌤️ 季节切换: ${season}`);
    }
    handleDisconnect(clientId) {
        const conn = this.clients.get(clientId);
        if (conn) {
            console.log(`🔌 客户端断开: ${clientId} (角色: ${conn.characterId})`);
        }
        this.clients.delete(clientId);
        console.log(`📊 当前在线: ${this.clients.size}`);
    }
    broadcast(message) {
        const data = JSON.stringify(message);
        for (const [clientId, conn] of this.clients) {
            if (conn.ws.readyState === 1) { // OPEN
                conn.ws.send(data);
            }
        }
    }
    broadcastState(tick) {
        const message = {
            type: 'state',
            data: {
                characters: this.characterManager.serialize(),
                tick
            }
        };
        this.broadcast(message);
    }
    getClientCount() {
        return this.clients.size;
    }
    getClients() {
        return Array.from(this.clients.keys());
    }
}
exports.WebSocketHandler = WebSocketHandler;

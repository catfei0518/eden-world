/**
 * 伊甸世界 - WebSocket处理器
 */

import type WebSocket from 'ws';
import type { CharacterManager } from './CharacterManager';
import type { WorldState } from './WorldState';
import type { ClientMessage, ServerMessage, InputMessage } from './types/Protocol';

interface ClientConnection {
    ws: WebSocket;
    characterId: string | null;
    playerId: string;
}

export class WebSocketHandler {
    private clients: Map<string, ClientConnection> = new Map();
    private characterManager: CharacterManager;
    private worldState: WorldState;
    private pendingInputs: Map<number, InputMessage> = new Map();
    private inputSeq: number = 0;
    
    constructor(characterManager: CharacterManager, worldState: WorldState) {
        this.characterManager = characterManager;
        this.worldState = worldState;
    }
    
    handleConnection(ws: WebSocket): string {
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
                const message: ClientMessage = JSON.parse(data.toString());
                this.handleMessage(clientId, message);
            } catch (e) {
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
    
    private sendInit(clientId: string): void {
        const conn = this.clients.get(clientId);
        if (!conn) return;
        
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
    
    private handleMessage(clientId: string, message: ClientMessage): void {
        const conn = this.clients.get(clientId);
        if (!conn) return;
        
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
    
    private handleSelectCharacter(clientId: string, characterId: string): void {
        const success = this.characterManager.selectCharacter(characterId);
        if (success) {
            const conn = this.clients.get(clientId);
            if (conn) {
                conn.characterId = characterId;
            }
            
            const fullData = this.characterManager.serializeFull(characterId);
            if (fullData) {
                const response: ServerMessage = {
                    type: 'character_selected',
                    characterId,
                    data: fullData
                };
                conn!.ws.send(JSON.stringify(response));
                console.log(`🎭 客户端 ${clientId} 选择了角色 ${characterId}`);
            }
        }
    }
    
    private handleInput(clientId: string, message: InputMessage): void {
        const conn = this.clients.get(clientId);
        if (!conn) return;
        
        const { characterId, seq, input } = message;
        const character = this.characterManager.getCharacter(characterId);
        
        if (!character) {
            // 角色不存在，拒绝
            const ack: ServerMessage = {
                type: 'input_ack',
                seq,
                accepted: false
            };
            conn.ws.send(JSON.stringify(ack));
            return;
        }
        
        // 处理输入
        if (input.action === 'move' && input.target) {
            const accepted = this.characterManager.moveCharacter(
                characterId,
                input.target.x,
                input.target.y,
                this.worldState.getTick()
            );
            
            const ack: ServerMessage = {
                type: 'input_ack',
                seq,
                accepted,
                position: accepted ? { x: input.target.x, y: input.target.y } : undefined
            };
            conn.ws.send(JSON.stringify(ack));
        } else if (input.action === 'idle') {
            this.characterManager.updateCharacterAction(characterId, 'idle');
            
            const ack: ServerMessage = {
                type: 'input_ack',
                seq,
                accepted: true,
                position: { x: character.x, y: character.y }
            };
            conn.ws.send(JSON.stringify(ack));
        }
    }
    
    private handleSeasonChange(clientId: string, season: string): void {
        this.worldState.setSeason(season as any);
        
        // 广播给所有客户端
        this.broadcast({
            type: 'season_changed',
            season: season as any
        });
        
        console.log(`🌤️ 季节切换: ${season}`);
    }
    
    private handleDisconnect(clientId: string): void {
        const conn = this.clients.get(clientId);
        if (conn) {
            console.log(`🔌 客户端断开: ${clientId} (角色: ${conn.characterId})`);
        }
        this.clients.delete(clientId);
        console.log(`📊 当前在线: ${this.clients.size}`);
    }
    
    broadcast(message: ServerMessage): void {
        const data = JSON.stringify(message);
        for (const [clientId, conn] of this.clients) {
            if (conn.ws.readyState === 1) { // OPEN
                conn.ws.send(data);
            }
        }
    }
    
    broadcastState(tick: number): void {
        const message: ServerMessage = {
            type: 'state',
            data: {
                characters: this.characterManager.serialize(),
                tick
            }
        };
        
        this.broadcast(message);
    }
    
    getClientCount(): number {
        return this.clients.size;
    }
    
    getClients(): string[] {
        return Array.from(this.clients.keys());
    }
}

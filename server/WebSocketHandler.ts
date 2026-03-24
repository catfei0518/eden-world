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
    role: string;  // 'user' or 'admin'
    username: string;
}

export class WebSocketHandler {
    private clients: Map<string, ClientConnection> = new Map();
    private characterManager: CharacterManager;
    private worldState: WorldState;
    private pendingInputs: Map<number, InputMessage> = new Map();
    private inputSeq: number = 0;
    
    // 允许的命令（仅管理员可执行）
    private adminCommands = ['season', 'spawn', 'kill', 'time', 'kick', 'give'];
    
    constructor(characterManager: CharacterManager, worldState: WorldState) {
        this.characterManager = characterManager;
        this.worldState = worldState;
    }
    
    handleConnection(ws: WebSocket): string {
        const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        
        this.clients.set(clientId, {
            ws,
            characterId: null,
            playerId: clientId,
            role: 'user',  // 默认普通用户
            username: 'anonymous'
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
            case 'auth':
                // 处理WebSocket认证
                this.handleAuth(clientId, message.token);
                break;
                
            case 'select_character':
                this.handleSelectCharacter(clientId, message.characterId);
                break;
                
            case 'input':
                this.handleInput(clientId, message);
                break;
                
            case 'season':
                // 检查管理员权限
                if (conn.role !== 'admin') {
                    conn.ws.send(JSON.stringify({ type: 'error', message: '无权限：需要管理员权限' }));
                    return;
                }
                this.handleSeasonChange(clientId, message.season);
                break;
                
            case 'command':
                // 检查管理员权限
                if (conn.role !== 'admin') {
                    conn.ws.send(JSON.stringify({ type: 'error', message: '无权限：需要管理员权限' }));
                    return;
                }
                this.handleCommand(clientId, message.command, message.args);
                break;
        }
    }
    
    // 处理WebSocket认证
    private handleAuth(clientId: string, token: string): void {
        const conn = this.clients.get(clientId);
        if (!conn) return;
        
        const auth = require('./auth');
        const user = auth.getUserInfo(token);
        
        if (user) {
            conn.role = user.role || 'user';
            conn.username = user.username;
            conn.ws.send(JSON.stringify({ type: 'auth_success', message: `已认证为 ${conn.username} (${conn.role})` }));
            console.log(`🔐 ${conn.username} (${conn.role}) 已通过WebSocket认证`);
        } else {
            conn.ws.send(JSON.stringify({ type: 'auth_error', message: 'Token无效或已过期' }));
        }
    }
    
    // 处理控制台命令
    private handleCommand(clientId: string, command: string, args: any): void {
        const conn = this.clients.get(clientId);
        console.log(`📟 管理员命令: ${conn?.username} -> /${command} ${JSON.stringify(args)}`);
        
        switch (command) {
            case 'help':
                conn?.ws.send(JSON.stringify({ 
                    type: 'command_result', 
                    result: {
                        description: '可用命令列表',
                        commands: [
                            { cmd: 'season <spring|summer|autumn|winter>', desc: '切换季节' },
                            { cmd: 'spawn <type> <x> <y>', desc: '在指定位置生成物品' },
                            { cmd: 'stat', desc: '显示服务器状态' },
                            { cmd: 'time <1|2|3>', desc: '设置时间速度' },
                            { cmd: 'help', desc: '显示此帮助信息' }
                        ]
                    }
                }));
                break;
            case 'season':
                if (['spring', 'summer', 'autumn', 'winter'].includes(args)) {
                    this.handleSeasonChange(clientId, args);
                    conn?.ws.send(JSON.stringify({ type: 'command_result', result: '季节已切换为: ' + args }));
                } else {
                    conn?.ws.send(JSON.stringify({ type: 'command_result', result: '无效季节，有效值: spring, summer, autumn, winter' }));
                }
                break;
            case 'spawn':
                this.handleSpawn(args);
                break;
            case 'kill':
                this.handleKill(args);
                break;
            case 'time':
                this.handleTimeSpeed(args);
                break;
            case 'stat':
                this.handleStat(clientId);
                break;
            default:
                conn?.ws.send(JSON.stringify({ type: 'command_result', result: '未知命令，输入 /help 查看可用命令' }));
        }
    }
    
    private handleStat(clientId: string): void {
        const conn = this.clients.get(clientId);
        conn?.ws.send(JSON.stringify({ 
            type: 'command_result', 
            result: {
                status: 'ok',
                players: this.clients.size,
                characters: this.characterManager.getAll().length
            }
        }));
    }
    
    private handleSpawn(args: any): void {
        // 物品生成逻辑
        if (args.type && args.x !== undefined && args.y !== undefined) {
            this.worldState.addGroundObject({
                id: `spawn_${Date.now()}`,
                type: args.type,
                x: args.x,
                y: args.y,
                terrain: 'grass'
            });
            this.broadcast({ type: 'item_spawned', data: args });
        }
    }
    
    private handleKill(args: any): void {
        // 角色删除逻辑
    }
    
    private handleTimeSpeed(args: any): void {
        // 时间速度调整逻辑
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
            // 碰撞检测验证
            const validation = this.characterManager.canMoveTo(
                characterId,
                input.target.x,
                input.target.y,
                this.worldState
            );
            
            if (!validation.allowed) {
                // 移动被阻挡
                const ack: ServerMessage = {
                    type: 'input_ack',
                    seq,
                    accepted: false,
                    position: { x: character.x, y: character.y }
                };
                conn.ws.send(JSON.stringify(ack));
                
                // 更新角色动作为idle
                this.characterManager.updateCharacterAction(characterId, 'blocked');
                return;
            }
            
            // 移动验证通过
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

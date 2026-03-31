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
    private timeManager: any = null;  // 时间管理器（稍后设置）
    private pendingInputs: Map<number, InputMessage> = new Map();
    private inputSeq: number = 0;
    
    // 允许的命令（仅管理员可执行）
    private adminCommands = ['season', 'spawn', 'kill', 'time', 'kick', 'give'];
    
    constructor(characterManager: CharacterManager, worldState: WorldState) {
        this.characterManager = characterManager;
        this.worldState = worldState;
    }
    
    /**
     * 设置时间管理器
     */
    setTimeManager(timeManager: any): void {
        this.timeManager = timeManager;
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
    
    // 视口大小配置
    private VIEWPORT_TILES = 50;  // 视口半径（50 = 101x101格子）足够覆盖初始视口
    
    private sendInit(clientId: string): void {
        const conn = this.clients.get(clientId);
        if (!conn) return;
        
        // 获取时间数据
        const timeInfo = this.timeManager ? this.timeManager.getFullTimeInfo() : {
            season: 'spring',
            seasonName: '春',
            seasonEmoji: '🌸',
            year: 1,
            day: 1,
            hour: 0,
            minute: 0,
            timeString: '00:00',
            period: 'day',
            periodName: '白天',
            periodEmoji: '☀️',
            lightCoefficient: 1
        };
        
        // 只发送视口区域的地形（基于角色位置）
        const characters = this.characterManager.serialize();
        const centerX = characters.length > 0 ? Math.floor(characters[0].x) : 50;
        const centerY = characters.length > 0 ? Math.floor(characters[0].y) : 25;
        
        // 获取视口区域的地形
        const viewportTiles = this.getViewportTiles(centerX, centerY, this.VIEWPORT_TILES);
        
        // 只发送视口内的物品
        const viewportObjects = this.getViewportGroundObjects(centerX, centerY, this.VIEWPORT_TILES);
        
        const initMessage = {
            type: 'init',
            data: {
                world: {
                    // 地形数据：只发送视口区域
                    viewport: {
                        tiles: viewportTiles,
                        centerX,
                        centerY,
                        radius: this.VIEWPORT_TILES
                    },
                    // 不再发送完整地形，客户端用worldSeed本地生成
                    groundObjects: viewportObjects,
                    foods: this.worldState.getFoodSources().filter(f => 
                        Math.abs(f.x - centerX) <= this.VIEWPORT_TILES && 
                        Math.abs(f.y - centerY) <= this.VIEWPORT_TILES
                    ),
                    worldSeed: this.worldState.getSeed()
                },
                characters: this.characterManager.serialize(),
                season: this.worldState.getSeason(),
                width: this.worldState.getWidth(),
                height: this.worldState.getHeight(),
                time: timeInfo
            }
        };
        
        conn.ws.send(JSON.stringify(initMessage));
        console.log(`📤 发送init给 ${clientId}: 视口${this.VIEWPORT_TILES*2+1}x${this.VIEWPORT_TILES*2+1}, 物品${viewportObjects.length}个`);
    }
    
    /**
     * 获取视口区域的地形数据
     */
    private getViewportTiles(centerX: number, centerY: number, radius: number): any[][] {
        const tiles: any[][] = [];
        
        // 确保坐标在有效范围内
        const worldWidth = this.worldState.getWidth();
        const worldHeight = this.worldState.getHeight();
        
        // 如果坐标超出范围，使用世界中心作为默认值
        if (centerX < 0 || centerX >= worldWidth || centerY < 0 || centerY >= worldHeight) {
            console.log(`⚠️ 视口坐标超出范围: centerX=${centerX}, centerY=${centerY}，使用默认值`);
            centerX = Math.floor(worldWidth / 2);
            centerY = Math.floor(worldHeight / 2);
        }
        
        const startX = Math.max(0, centerX - radius);
        const startY = Math.max(0, centerY - radius);
        const endX = Math.min(worldWidth - 1, centerX + radius);
        const endY = Math.min(worldHeight - 1, centerY + radius);
        
        // 如果起始坐标大于结束坐标，返回空数组
        if (startX > endX || startY > endY) {
            console.log(`⚠️ 视口范围无效: startX=${startX}, endX=${endX}, startY=${startY}, endY=${endY}`);
            return tiles;
        }
        
        console.log(`🔧 getViewportTiles: centerX=${centerX}, centerY=${centerY}, radius=${radius}`);
        console.log(`🔧 getViewportTiles: startX=${startX}, startY=${startY}, endX=${endX}, endY=${endY}`);
        
        for (let y = startY; y <= endY; y++) {
            const row: any[] = [];
            for (let x = startX; x <= endX; x++) {
                const tile = this.worldState.getTile(x, y);
                row.push(tile || { x, y, type: 'grass' });
            }
            tiles.push(row);
        }
        
        console.log(`🔧 getViewportTiles: 返回 ${tiles.length} 行, 每行 ${tiles[0]?.length || 0} 列`);
        return tiles;
    }
    
    /**
     * 获取视口区域的物品数据
     */
    private getViewportGroundObjects(centerX: number, centerY: number, radius: number): any[] {
        const allObjects = this.worldState.getAllGroundObjects();
        return allObjects.filter(obj => 
            Math.abs(obj.x - centerX) <= radius && 
            Math.abs(obj.y - centerY) <= radius
        );
    }
    
    private handleMessage(clientId: string, message: ClientMessage): void {
        const conn = this.clients.get(clientId);
        if (!conn) return;
        
        console.log(`📨 收到消息: type=${message.type}, client=${clientId}`);
        
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
                
            case 'get_viewport':
                this.handleGetViewport(clientId, message.centerX, message.centerY);
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
        if (!this.timeManager) return;
        
        const speed = parseInt(args);
        if (isNaN(speed) || speed < 0) {
            return;
        }
        
        this.timeManager.setTimeSpeed(speed);
        
        // 广播时间变化
        this.broadcast({
            type: 'time_speed_changed',
            speed
        });
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
    
    /**
     * 处理获取视口地形数据请求
     */
    private handleGetViewport(clientId: string, centerX?: number, centerY?: number): void {
        const conn = this.clients.get(clientId);
        if (!conn) return;
        
        console.log(`📥 收到 get_viewport 请求: client=${clientId}, centerX=${centerX}, centerY=${centerY}`);
        
        // 获取角色位置作为中心点（如果没有指定）
        let cx = centerX;
        let cy = centerY;
        
        if (cx === undefined || cy === undefined) {
            const characters = this.characterManager.serialize();
            const playerChar = characters.find(c => c.id === conn.characterId);
            if (playerChar && playerChar.x !== null && playerChar.y !== null) {
                cx = Math.floor(playerChar.x);
                cy = Math.floor(playerChar.y);
            } else if (characters.length > 0) {
                cx = Math.floor(characters[0].x);
                cy = Math.floor(characters[0].y);
            } else {
                cx = 50;
                cy = 25;
            }
        }
        
        // 获取视口区域的地形
        const viewportTiles = this.getViewportTiles(cx, cy, this.VIEWPORT_TILES);
        const viewportObjects = this.getViewportGroundObjects(cx, cy, this.VIEWPORT_TILES);
        
        // 调试：统计视口中的地形类型
        const terrainStats: Record<string, number> = {};
        for (const row of viewportTiles) {
            for (const tile of row) {
                terrainStats[tile.type] = (terrainStats[tile.type] || 0) + 1;
            }
        }
        console.log(`📊 视口地形统计 (center=${cx},${cy}): ${JSON.stringify(terrainStats)}`);
        
        const response = {
            type: 'viewport_update',
            data: {
                viewport: {
                    tiles: viewportTiles,
                    centerX: cx,
                    centerY: cy,
                    radius: this.VIEWPORT_TILES
                },
                groundObjects: viewportObjects
            }
        };
        
        conn.ws.send(JSON.stringify(response));
        console.log(`📤 发送 viewport_update: tiles=${viewportTiles.length}x${viewportTiles[0]?.length}, objects=${viewportObjects.length}`);
    }
    
    getClientCount(): number {
        return this.clients.size;
    }
    
    getClients(): string[] {
        return Array.from(this.clients.keys());
    }
}

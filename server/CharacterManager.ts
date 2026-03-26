/**
 * 伊甸世界 - 角色管理器 v2.0
 * 
 * 集成DNA × AI自动移动系统
 */

import type { CharacterSnapshot, CharacterFullData, CharacterType, Season } from './types/Protocol';
import { AICharacter, AICharacterData, WorldState as AIWorldState, ServerWorldState } from './AICharacter';

interface CharacterState {
    ai: AICharacter;  // 使用AI角色系统
}

export class CharacterManager {
    private characters: Map<string, CharacterState> = new Map();
    private selectedCharacter: string | null = null;
    
    createCharacter(type: CharacterType, x: number, y: number, name: string): string {
        const id = `char_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        
        // 创建AI角色（自动生成DNA）
        const ai = new AICharacter(id, name, type, x, y);
        
        const char: CharacterState = { ai };
        this.characters.set(id, char);
        
        console.log(`👤 创建AI角色: ${name} (${type}) - DNA好奇心:${ai.dna.curiosity.toFixed(2)}, 胆量:${ai.dna.bravery.toFixed(2)}`);
        
        return id;
    }
    
    getCharacter(id: string): AICharacter | undefined {
        return this.characters.get(id)?.ai;
    }
    
    getAll(): AICharacter[] {
        return Array.from(this.characters.values()).map(s => s.ai);
    }
    
    selectCharacter(id: string): boolean {
        if (this.characters.has(id)) {
            this.selectedCharacter = id;
            return true;
        }
        return false;
    }
    
    getSelected(): AICharacter | null {
        if (!this.selectedCharacter) return null;
        return this.characters.get(this.selectedCharacter)?.ai || null;
    }
    
    getSelectedId(): string | null {
        return this.selectedCharacter;
    }
    
    /**
     * AI决策（每tick调用）
     */
    processAI(worldState: AIWorldState): void {
        const allCharacters = this.getAll();
        
        for (const char of allCharacters) {
            // 1️⃣ AI决策
            char.decide(worldState, allCharacters);
            
            // 2️⃣ 执行移动
            char.moveStep(worldState);
        }
    }
    
    moveCharacter(id: string, x: number, y: number, tick: number): boolean {
        const char = this.getCharacter(id);
        if (!char) return false;
        
        // AI角色移动由AI系统控制，这里只用于外部强制移动
        char.x = x;
        char.y = y;
        char.targetX = null;
        char.targetY = null;
        
        return true;
    }
    
    // 验证移动是否合法（碰撞检测）
    canMoveTo(id: string, targetX: number, targetY: number, worldState: { getTerrainAt(x: number, y: number): string | null }): { allowed: boolean; reason?: string } {
        const char = this.getCharacter(id);
        if (!char) return { allowed: false, reason: '角色不存在' };
        
        // 1. 边界检查
        if (targetX < 0 || targetX >= 200 || targetY < 0 || targetY >= 100) {
            return { allowed: false, reason: '超出边界' };
        }
        
        // 2. 地形检查
        const terrain = worldState.getTerrainAt(targetX, targetY);
        if (!terrain) return { allowed: false, reason: '地形不存在' };
        
        const walkable = ['grass', 'plains', 'forest', 'desert', 'beach'];
        if (!walkable.includes(terrain)) {
            return { allowed: false, reason: `地形 ${terrain} 不可通行` };
        }
        
        // 3. 距离检查（每Tick最多移动1.5格子）
        const dx = targetX - char.x;
        const dy = targetY - char.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 1.5) {
            return { allowed: false, reason: '移动距离太远' };
        }
        
        return { allowed: true };
    }
    
    updateCharacterAction(id: string, action: string): boolean {
        const char = this.getCharacter(id);
        if (!char) return false;
        char.state = action as any;
        return true;
    }
    
    consumeResources(id: string, hungerDelta: number, thirstDelta: number, energyDelta: number): boolean {
        const char = this.getCharacter(id);
        if (!char) return false;
        
        char.hunger = Math.max(0, Math.min(100, char.hunger + hungerDelta));
        char.thirst = Math.max(0, Math.min(100, char.thirst + thirstDelta));
        char.energy = Math.max(0, Math.min(100, char.energy + energyDelta));
        
        return true;
    }
    
    serialize(): CharacterSnapshot[] {
        return this.getAll().map(ai => ({
            id: ai.id,
            name: ai.name,
            type: ai.type,
            x: ai.x,
            y: ai.y,
            hunger: ai.hunger,
            thirst: ai.thirst,
            energy: ai.energy,
            action: ai.getStatusText(),
            dna: ai.dna
        }));
    }
    
    serializeFull(id: string): CharacterFullData | null {
        const ai = this.getCharacter(id);
        if (!ai) return null;
        
        return {
            id: ai.id,
            name: ai.name,
            type: ai.type,
            x: ai.x,
            y: ai.y,
            action: ai.getStatusText(),
            needs: {
                hunger: ai.hunger,
                thirst: ai.thirst,
                energy: ai.energy
            },
            dna: ai.dna,
            phenotype: null,
            positionHistory: []
        };
    }
    
    // 根据地形获取初始位置（找有水源和食物的地方）
    static getStartPosition(type: CharacterType): { x: number; y: number } {
        // 草地位置 - 这些坐标会被GameServer根据实际地形调整
        if (type === 'adam') {
            return { x: 50, y: 30 };  // 地图中心区域
        } else {
            return { x: 52, y: 32 };
        }
    }
    
    // 根据世界状态找到合适的出生地
    static findGoodSpawnPosition(worldState: any): { x: number; y: number } {
        const tiles = worldState.getAllTiles();
        const items = worldState.getAllGroundObjects();
        
        // 优先找：草地/平原 + 附近有森林/灌木 + 附近有河流/湖泊
        for (let y = 10; y < 90; y++) {
            for (let x = 10; x < 190; x++) {
                const tile = tiles.find((t: any) => t.x === x && t.y === y);
                if (!tile) continue;
                
                // 只在草地或平原
                if (tile.type !== 'grass' && tile.type !== 'plains') continue;
                
                // 检查附近是否有水源
                const hasWater = tiles.some((t: any) => 
                    Math.abs(t.x - x) <= 5 && 
                    Math.abs(t.y - y) <= 5 && 
                    (t.type === 'river' || t.type === 'lake')
                );
                if (!hasWater) continue;
                
                // 检查附近是否有食物（森林或灌木）
                const hasFood = items.some((item: any) =>
                    Math.abs(item.x - x) <= 8 &&
                    Math.abs(item.y - y) <= 8 &&
                    (item.type === 'tree' || item.type === 'bush' || item.type === 'forest_tree')
                );
                if (!hasFood) continue;
                
                // 找到一个好位置
                return { x, y };
            }
        }
        
        // 如果找不到完美的，就找草地附近有水的
        for (let y = 10; y < 90; y++) {
            for (let x = 10; x < 190; x++) {
                const tile = tiles.find((t: any) => t.x === x && t.y === y);
                if (!tile) continue;
                
                if (tile.type !== 'grass' && tile.type !== 'plains') continue;
                
                const hasWater = tiles.some((t: any) =>
                    Math.abs(t.x - x) <= 3 &&
                    Math.abs(t.y - y) <= 3 &&
                    (t.type === 'river' || t.type === 'lake')
                );
                if (hasWater) return { x, y };
            }
        }
        
        // 默认返回地图中心
        return { x: 100, y: 50 };
    }
    
    /**
     * 创建用于AI决策的世界状态
     */
    createAIWorldState(worldState: any): ServerWorldState {
        const tiles = worldState.getAllTiles().map((t: any) => ({
            x: t.x,
            y: t.y,
            type: t.type
        }));
        
        const objects = worldState.getAllGroundObjects().map((o: any) => ({
            x: o.x,
            y: o.y,
            type: o.type
        }));
        
        return new ServerWorldState(tiles, objects);
    }
}

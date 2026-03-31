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
    private realWorldState: any = null;  // Phase 1: 真实WorldState引用
    
    setWorldState(ws: any): void {
        this.realWorldState = ws;
    }
    
    getWorldState(): any {
        return this.realWorldState;
    }
    
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
            // 1️⃣ AI决策（使用简化版ServerWorldState）
            char.decide(worldState, allCharacters);
            
            // 2️⃣ 执行移动（使用真实WorldState以便修改浆果数据）
            char.moveStep(this.realWorldState);
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
            action: ai.state,
            actionTimer: ai.actionTimer,
            actionTimerMax: ai.actionTimerMax,
            needs: {
                hunger: ai.hunger,
                thirst: ai.thirst,
                energy: ai.energy
            },
            inventory: {
                berries: ai.inventory.berries,
                twigs: ai.inventory.twigs,
                stones: ai.inventory.stones,
                herbs: ai.inventory.herbs,
                totalCalories: ai.getInventoryCalories()
            }
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
            action: ai.state,
            needs: {
                hunger: ai.hunger,
                thirst: ai.thirst,
                energy: ai.energy
            },
            inventory: {
                berries: ai.inventory.berries,
                twigs: ai.inventory.twigs,
                stones: ai.inventory.stones,
                herbs: ai.inventory.herbs,
                totalCalories: ai.getInventoryCalories()
            },
            actionTimer: ai.actionTimer,
            actionTimerMax: ai.actionTimerMax,
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
        // 使用新的SpawnPointSelector
        try {
            const { SpawnPointSelector, TileType } = require('./SpawnPointSelector');

            // 创建简单的GameMap适配器
            const mapAdapter = {
                getSize: () => ({ width: 200, height: 100 }),
                getTile: (x: number, y: number) => {
                    const tile = worldState.getTile(x, y);
                    if (!tile) return null;

                    // 映射服务器TileType到SpawnPointSelector的TileType
                    const typeMap: Record<string, string> = {
                        'plains': 'plain',
                        'grass': 'grass',
                        'desert': 'desert',
                        'forest': 'forest',
                        'ocean': 'ocean',
                        'lake': 'lake',
                        'river': 'river',
                        'swamp': 'swamp',
                        'mountain': 'mountain',
                        'hill': 'hill',
                        'cave': 'cave',
                        'beach': 'beach',
                    };

                    return {
                        type: typeMap[tile.type] || 'plain'
                    };
                }
            };

            const selector = new SpawnPointSelector(mapAdapter);
            const spawnPoints = selector.selectSpawnPoint(1);

            if (spawnPoints.length > 0) {
                const point = spawnPoints[0];
                console.log(`🎯 使用智能出生点: (${point.x}, ${point.y})`);
                console.log(`   - 水源距离: ${point.criteria.waterDistance}格`);
                console.log(`   - 食物评分: ${point.criteria.foodNearby}`);
                console.log(`   - 建材评分: ${point.criteria.shelterNearby}`);
                console.log(`   - 综合评分: ${point.criteria.totalScore.toFixed(3)}`);
                return { x: point.x, y: point.y };
            }
        } catch (e) {
            console.warn('SpawnPointSelector初始化失败，使用旧方法:', e);
        }

        // 备用：使用原有逻辑
        const tiles = worldState.getAllTiles();
        const items = worldState.getAllGroundObjects();

        for (let y = 10; y < 90; y++) {
            for (let x = 10; x < 190; x++) {
                const tile = tiles.find((t: any) => t.x === x && t.y === y);
                if (!tile) continue;

                if (tile.type !== 'grass' && tile.type !== 'plains') continue;

                const hasWater = tiles.some((t: any) =>
                    Math.abs(t.x - x) <= 5 &&
                    Math.abs(t.y - y) <= 5 &&
                    (t.type === 'river' || t.type === 'lake')
                );
                if (!hasWater) continue;

                const hasFood = items.some((item: any) =>
                    Math.abs(item.x - x) <= 8 &&
                    Math.abs(item.y - y) <= 8 &&
                    (item.type === 'tree' || item.type === 'bush' || item.type === 'forest_tree')
                );
                if (!hasFood) continue;

                console.log(`🎯 使用备用出生点: (${x}, ${y})`);
                return { x, y };
            }
        }

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
                if (hasWater) {
                    console.log(`🎯 使用备用出生点: (${x}, ${y})`);
                    return { x, y };
                }
            }
        }

        console.log(`🎯 使用默认出生点: (100, 50)`);
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
    
    /**
     * 导出存档数据
     */
    toJSON(): any[] {
        return Array.from(this.characters.values()).map(state => state.ai.toJSON());
    }
    
    /**
     * 从存档数据恢复
     */
    fromJSON(data: any[]): void {
        // 恢复每个角色
        for (const charData of data) {
            const existing = this.characters.get(charData.id);
            if (existing) {
                existing.ai.fromJSON(charData);
            }
        }
    }
    
    /**
     * 从存档数据创建角色
     */
    createCharacterFromSave(charData: any): void {
        const id = charData.id;
        const name = charData.name;
        const type = charData.type;
        const x = charData.x;
        const y = charData.y;
        
        // 创建 AI 角色
        const ai = new AICharacter(id, name, type, x, y, charData.dna);
        
        // 恢复所有状态
        ai.fromJSON(charData);
        
        // 存储角色
        const state: CharacterState = { ai };
        this.characters.set(id, state);
        
        console.log(`✅ 角色已创建: ${name} (${id}) 位置(${x.toFixed(1)}, ${y.toFixed(1)})`);
    }
}

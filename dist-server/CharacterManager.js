"use strict";
/**
 * 伊甸世界 - 角色管理器
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CharacterManager = void 0;
class CharacterManager {
    constructor() {
        this.characters = new Map();
        this.selectedCharacter = null;
    }
    createCharacter(type, x, y, name) {
        const id = `char_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const char = {
            id,
            name,
            type,
            x,
            y,
            hunger: 100,
            thirst: 100,
            energy: 5,
            action: 'idle',
            positionHistory: []
        };
        this.characters.set(id, char);
        return id;
    }
    getCharacter(id) {
        return this.characters.get(id);
    }
    getAll() {
        return Array.from(this.characters.values());
    }
    selectCharacter(id) {
        if (this.characters.has(id)) {
            this.selectedCharacter = id;
            return true;
        }
        return false;
    }
    getSelected() {
        if (!this.selectedCharacter)
            return null;
        return this.characters.get(this.selectedCharacter) || null;
    }
    getSelectedId() {
        return this.selectedCharacter;
    }
    moveCharacter(id, x, y, tick) {
        const char = this.characters.get(id);
        if (!char)
            return false;
        char.x = x;
        char.y = y;
        char.action = 'walking';
        // 记录位置历史（用于延迟补偿）
        char.positionHistory.push({ x, y, tick });
        if (char.positionHistory.length > 10) {
            char.positionHistory.shift();
        }
        return true;
    }
    updateCharacterAction(id, action) {
        const char = this.characters.get(id);
        if (!char)
            return false;
        char.action = action;
        return true;
    }
    consumeResources(id, hungerDelta, thirstDelta, energyDelta) {
        const char = this.characters.get(id);
        if (!char)
            return false;
        char.hunger = Math.max(0, Math.min(100, char.hunger + hungerDelta));
        char.thirst = Math.max(0, Math.min(100, char.thirst + thirstDelta));
        char.energy = Math.max(0, Math.min(5, char.energy + energyDelta));
        return true;
    }
    serialize() {
        return this.getAll().map(char => ({
            id: char.id,
            name: char.name,
            type: char.type,
            x: char.x,
            y: char.y,
            action: char.action,
            needs: {
                hunger: char.hunger,
                thirst: char.thirst,
                energy: char.energy
            }
        }));
    }
    serializeFull(id) {
        const char = this.characters.get(id);
        if (!char)
            return null;
        return {
            id: char.id,
            name: char.name,
            type: char.type,
            x: char.x,
            y: char.y,
            action: char.action,
            needs: {
                hunger: char.hunger,
                thirst: char.thirst,
                energy: char.energy
            },
            dna: null, // TODO: 集成DNA系统
            phenotype: null, // TODO: 集成表型系统
            positionHistory: char.positionHistory
        };
    }
    // 根据地形获取初始位置（找有水源和食物的地方）
    static getStartPosition(type) {
        // 草地位置 - 这些坐标会被GameServer根据实际地形调整
        if (type === 'adam') {
            return { x: 50, y: 30 }; // 地图中心区域
        }
        else {
            return { x: 52, y: 32 };
        }
    }
    // 根据世界状态找到合适的出生地
    static findGoodSpawnPosition(worldState) {
        const tiles = worldState.getAllTiles();
        const items = worldState.getAllGroundObjects();
        // 优先找：草地/平原 + 附近有森林/灌木 + 附近有河流/湖泊
        for (let y = 10; y < 90; y++) {
            for (let x = 10; x < 190; x++) {
                const tile = tiles.find(t => t.x === x && t.y === y);
                if (!tile)
                    continue;
                // 只在草地或平原
                if (tile.type !== 'grass' && tile.type !== 'plains')
                    continue;
                // 检查附近是否有水源
                const hasWater = tiles.some(t => Math.abs(t.x - x) <= 5 &&
                    Math.abs(t.y - y) <= 5 &&
                    (t.type === 'river' || t.type === 'lake'));
                if (!hasWater)
                    continue;
                // 检查附近是否有食物（森林或灌木）
                const hasFood = items.some(item => Math.abs(item.x - x) <= 8 &&
                    Math.abs(item.y - y) <= 8 &&
                    (item.type === 'tree' || item.type === 'bush' || item.type === 'forest_tree'));
                if (!hasFood)
                    continue;
                // 找到一个好位置
                return { x, y };
            }
        }
        // 如果找不到完美的，就找草地附近有水的
        for (let y = 10; y < 90; y++) {
            for (let x = 10; x < 190; x++) {
                const tile = tiles.find(t => t.x === x && t.y === y);
                if (!tile)
                    continue;
                if (tile.type !== 'grass' && tile.type !== 'plains')
                    continue;
                const hasWater = tiles.some(t => Math.abs(t.x - x) <= 3 &&
                    Math.abs(t.y - y) <= 3 &&
                    (t.type === 'river' || t.type === 'lake'));
                if (hasWater)
                    return { x, y };
            }
        }
        // 默认返回地图中心
        return { x: 100, y: 50 };
    }
}
exports.CharacterManager = CharacterManager;

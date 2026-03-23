/**
 * 游戏引擎 - 服务端运行
 */

const TILE_SIZE = 64;
const MAP_WIDTH = 100;
const MAP_HEIGHT = 50;

class Character {
    constructor(id, name, x, y) {
        this.id = id;
        this.name = name;
        this.x = x;
        this.y = y;
        this.health = 100;
        this.energy = 5;
        this.calories = 100;
        this.water = 100;
        this.action = '闲置';
        this.target = null;
        this.useLLM = false;
        
        // DNA
        this.dna = {
            bravery: 0.5 + Math.random() * 0.5,
            aggression: 0.3 + Math.random() * 0.5,
            curiosity: 0.4 + Math.random() * 0.4,
            metabolism: 0.8 + Math.random() * 0.4,
            strength: 0.4 + Math.random() * 0.4,
            constitution: 0.5 + Math.random() * 0.3,
            intelligence: 0.5 + Math.random() * 0.5,
            lifespan: 900 + Math.random() * 300
        };
    }
    
    get hungerPercent() { return Math.round(this.calories); }
    get thirstPercent() { return Math.round(this.water); }
}

class GameEngine {
    constructor(llmProxy) {
        this.llmProxy = llmProxy;
        this.characters = new Map();
        this.players = new Map(); // WebSocket -> characterId
        this.tickInterval = 1000; // 1秒
        this.llmInterval = 3000; // 3秒
        this.lastLLMTick = 0;
        this.worldState = this.generateWorld();
        
        // 创建初始角色
        this.createCharacter('adam', '亚当', 50, 25);
        this.createCharacter('eve', '夏娃', 51, 25);
    }
    
    generateWorld() {
        // 生成简单的世界
        const tiles = [];
        for (let y = 0; y < MAP_HEIGHT; y++) {
            const row = [];
            for (let x = 0; x < MAP_WIDTH; x++) {
                // 简单草地
                row.push({ type: 'grass', x, y });
            }
            tiles.push(row);
        }
        
        return { tiles };
    }
    
    createCharacter(id, name, x, y) {
        const char = new Character(id, name, x, y);
        // 亚当和夏娃用LLM
        char.useLLM = true;
        this.characters.set(id, char);
        return char;
    }
    
    start(onTick) {
        this.onTick = onTick;
        this.interval = setInterval(() => {
            this.tick();
        }, this.tickInterval);
    }
    
    stop() {
        if (this.interval) {
            clearInterval(this.interval);
        }
    }
    
    tick() {
        const now = Date.now();
        
        // 更新所有角色
        for (const char of this.characters.values()) {
            this.updateCharacter(char);
        }
        
        // LLM决策
        if (now - this.lastLLMTick > this.llmInterval) {
            this.lastLLMTick = now;
            this.updateLLMCharacters();
        }
    }
    
    updateCharacter(char) {
        // 消耗
        const consumptionRate = 100 / (6 * 60 * 60);
        const multiplier = 0.5 + char.dna.metabolism;
        
        char.calories = Math.max(0, char.calories - consumptionRate * multiplier);
        char.water = Math.max(0, char.water - consumptionRate * multiplier);
        
        // 移动
        if (char.target) {
            const dx = char.target.x - char.x;
            const dy = char.target.y - char.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < 0.3) {
                char.x = char.target.x;
                char.y = char.target.y;
                char.target = null;
                this.onArrive(char);
            } else {
                const speed = 0.05 * (0.5 + char.dna.agility);
                char.x += (dx / dist) * speed;
                char.y += (dy / dist) * speed;
            }
        }
        
        // 死亡检查
        if (char.calories <= 0 || char.water <= 0) {
            char.health = Math.max(0, char.health - 0.1);
        }
    }
    
    onArrive(char) {
        if (char.action === '寻找食物') {
            char.action = '采集中';
        } else if (char.action === '寻找水源') {
            char.action = '取水中';
        }
    }
    
    async updateLLMCharacters() {
        for (const char of this.characters.values()) {
            if (!char.useLLM) continue;
            
            // 跳过正在移动的角色
            if (char.target) continue;
            
            try {
                const worldState = this.getWorldStateFor(char);
                const decision = await this.llmProxy.decide(char, worldState);
                
                console.log(`🤖 ${char.name}: ${decision.action}`);
                
                char.action = decision.action;
                
                // 设置目标
                switch (decision.action) {
                    case '寻找食物':
                        this.goToNearest(char, this.worldState.foods);
                        break;
                    case '寻找水源':
                        this.goToNearest(char, this.worldState.waters);
                        break;
                    case '休息':
                        char.energy = Math.min(5, char.energy + 1);
                        break;
                    case '闲置':
                    case '探索':
                        this.randomWander(char);
                        break;
                }
            } catch (error) {
                console.error(`${char.name} LLM决策失败:`, error.message);
            }
        }
    }
    
    goToNearest(char, items) {
        if (!items || items.length === 0) {
            this.randomWander(char);
            return;
        }
        
        let nearest = items[0];
        let minDist = Infinity;
        
        for (const item of items) {
            const dist = Math.sqrt(
                Math.pow(item.x - char.x, 2) + 
                Math.pow(item.y - char.y, 2)
            );
            if (dist < minDist) {
                minDist = dist;
                nearest = item;
            }
        }
        
        char.target = { x: nearest.x, y: nearest.y };
    }
    
    randomWander(char) {
        const range = 10;
        char.target = {
            x: Math.floor(char.x) + Math.floor(Math.random() * range * 2) - range,
            y: Math.floor(char.y) + Math.floor(Math.random() * range * 2) - range
        };
    }
    
    getWorldStateFor(char) {
        // 简化版：附近食物和水源
        const foods = this.worldState.foods || [];
        const waters = this.worldState.waters || [];
        
        return {
            nearbyFood: foods.slice(0, 3),
            nearbyWater: waters.slice(0, 3)
        };
    }
    
    getState() {
        return {
            characters: Array.from(this.characters.values()).map(c => ({
                id: c.id,
                name: c.name,
                x: c.x,
                y: c.y,
                health: c.health,
                energy: c.energy,
                hunger: c.hungerPercent,
                thirst: c.thirstPercent,
                action: c.action
            })),
            world: this.worldState
        };
    }
    
    getPlayerCount() {
        return this.players.size;
    }
    
    getCharacterCount() {
        return this.characters.size;
    }
    
    handlePlayerAction(action) {
        // 处理玩家动作
        console.log('玩家动作:', action);
    }
    
    selectCharacter(ws, characterId) {
        this.players.set(ws, characterId);
    }
}

module.exports = { GameEngine };

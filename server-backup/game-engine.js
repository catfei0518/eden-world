/**
 * 游戏引擎 v2 - Latency Compensation 完整实现
 * 特性：
 * 1. 确定性随机生成（世界种子）
 * 2. 权威服务器
 * 3. 客户端预测
 * 4. 服务器协调
 * 5. 实体插值
 */

const TILE_SIZE = 64;
const MAP_WIDTH = 200;
const MAP_HEIGHT = 100;
const TICK_RATE = 20;  // 20fps服务器帧率
const BROADCAST_RATE = 50;  // 50ms广播一次 (20次/秒)

// 世界种子 - 用于确定性生成
const WORLD_SEED = 12345;

// 确定性随机函数
function seededRandom(seed, x, y) {
    const s = seed + x * 10000 + y;
    const rand = Math.sin(s) * 10000;
    return rand - Math.floor(rand);
}

// 角色类
class Character {
    constructor(id, name, x, y) {
        this.id = id;
        this.name = name;
        this.x = x;
        this.y = y;
        this.targetX = null;
        this.targetY = null;
        this.health = 100;
        this.energy = 5;
        this.calories = 100;
        this.water = 100;
        this.action = '闲置';
        this.lastProcessedInput = 0;  // 最后处理的输入序列号
        
        // DNA - 包含agility
        this.dna = {
            bravery: 0.5 + Math.random() * 0.5,
            aggression: 0.3 + Math.random() * 0.5,
            curiosity: 0.4 + Math.random() * 0.4,
            metabolism: 0.8 + Math.random() * 0.4,
            strength: 0.4 + Math.random() * 0.4,
            constitution: 0.5 + Math.random() * 0.3,
            intelligence: 0.5 + Math.random() * 0.5,
            lifespan: 900 + Math.random() * 300,
            agility: 0.5 + Math.random() * 0.5
        };
    }
    
    get hungerPercent() { return Math.round(this.calories); }
    get thirstPercent() { return Math.round(this.water); }
    
    // 本地移动预测（服务器和客户端使用相同逻辑）
    predictMove(deltaTime) {
        if (this.targetX === null || this.targetY === null) return;
        
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 0.1) {
            this.x = this.targetX;
            this.y = this.targetY;
            this.targetX = null;
            this.targetY = null;
            return;
        }
        
        const speed = 0.05 * (0.5 + this.dna.agility);
        let newX = this.x + (dx / dist) * speed;
        let newY = this.y + (dy / dist) * speed;
        
        // 边界检查
        newX = Math.max(0, Math.min(MAP_WIDTH - 1, newX));
        newY = Math.max(0, Math.min(MAP_HEIGHT - 1, newY));
        
        this.x = newX;
        this.y = newY;
    }
}

class GameEngine {
    constructor(llmProxy) {
        this.llmProxy = llmProxy;
        this.characters = new Map();
        this.players = new Map();  // WebSocket -> characterId
        
        // 输入队列
        this.inputQueue = new Map();  // characterId -> [{seq, input, timestamp}]
        
        // 服务器帧
        this.serverTick = 0;
        this.lastTickTime = Date.now();
        this.tickInterval = null;
        
        // 世界状态
        this.worldState = this.generateWorld();
        
        // 创建初始角色
        // 在水源附近的草地上生成角色
        this.createCharacter('adam', '亚当', 16, 10);
        this.createCharacter('eve', '夏娃', 18, 11);
    }
    
    // 生成世界（确定性）
    generateWorld() {
        const tiles = [];
        for (let y = 0; y < MAP_HEIGHT; y++) {
            const row = [];
            for (let x = 0; x < MAP_WIDTH; x++) {
                row.push({
                    type: this.getTerrainType(x, y),
                    x, y
                });
            }
            tiles.push(row);
        }
        
        // 生成地面物品（确定性）
        // 物品类型：树(forest)、灌木(grass/plains)、石头(mountain/hill)
        // 概率提高以支持文明发展
        const groundObjects = [];
        for (let y = 0; y < MAP_HEIGHT; y++) {
            for (let x = 0; x < MAP_WIDTH; x++) {
                const terrain = tiles[y][x].type;
                const rand = seededRandom(WORLD_SEED, x, y);
                
                // 森林：树 (15%概率)
                if (terrain === 'forest' && rand < 0.15) {
                    groundObjects.push({ type: 'tree', x, y, durability: 100, maxDurability: 100 });
                }
                // 草地/平原：灌木、浆果丛 (8%概率)
                else if ((terrain === 'grass' || terrain === 'plains') && rand < 0.08) {
                    groundObjects.push({ type: 'bush', x, y, durability: 50, maxDurability: 50 });
                }
                // 山地/丘陵：石头 (10%概率)
                else if ((terrain === 'mountain' || terrain === 'hill') && rand < 0.10) {
                    groundObjects.push({ type: 'rock', x, y, durability: 200, maxDurability: 200 });
                }
                // 海滩：偶尔有贝壳 (3%概率)
                else if (terrain === 'beach' && rand < 0.03) {
                    groundObjects.push({ type: 'shell', x, y, durability: 10, maxDurability: 10 });
                }
            }
        }
        
        return {
            tiles,
            groundObjects,
            worldSeed: WORLD_SEED
        };
    }
    
    getTerrainType(x, y) {
        // 使用简化的Perlin-like噪声函数，直接用坐标
        const hash = (px, py) => {
            const n = Math.sin(px * 12.9898 + py * 78.233) * 43758.5453;
            return n - Math.floor(n);
        };
        
        const lerp = (a, b, t) => a + (b - a) * t;
        const smooth = (t) => t * t * (3 - 2 * t);
        
        // 2D噪声
        const noise2D = (px, py) => {
            const ix = Math.floor(px);
            const iy = Math.floor(py);
            const fx = px - ix;
            const fy = py - iy;
            const sx = smooth(fx);
            const sy = smooth(fy);
            
            const n00 = hash(ix, iy);
            const n10 = hash(ix + 1, iy);
            const n01 = hash(ix, iy + 1);
            const n11 = hash(ix + 1, iy + 1);
            
            const nx0 = lerp(n00, n10, sx);
            const nx1 = lerp(n01, n11, sx);
            return lerp(nx0, nx1, sy);
        };
        
        // 分形噪声
        const fbm = (px, py, octaves) => {
            let value = 0, amplitude = 1, frequency = 1, maxValue = 0;
            for (let i = 0; i < octaves; i++) {
                value += amplitude * noise2D(px * frequency, py * frequency);
                maxValue += amplitude;
                amplitude *= 0.5;
                frequency *= 2;
            }
            return value / maxValue;
        };
        
        // 直接用坐标，缩放到0-1
        const scale = 0.02;  // 噪声缩放
        const elevation = fbm(x * scale, y * scale, 4);
        const moisture = fbm(x * scale + 100, y * scale + 100, 3);
        
        // 湖泊（优先）
        const lakes = [
            { cx: 30, cy: 30, r: 8 },
            { cx: 80, cy: 50, r: 10 },
            { cx: 140, cy: 40, r: 12 },
            { cx: 160, cy: 70, r: 6 }
        ];
        for (const lake of lakes) {
            const dist = Math.sqrt((x - lake.cx) ** 2 + (y - lake.cy) ** 2);
            if (dist < lake.r) return 'lake';
            if (dist < lake.r + 1) return 'beach';
        }
        
        // 河流
        const rivers = [
            { x1: 50, y1: 0, x2: 60, y2: 100 },
            { x1: 120, y1: 0, x2: 110, y2: 100 },
            { x1: 180, y1: 0, x2: 170, y2: 100 }
        ];
        for (const river of rivers) {
            const riverWidth = 2;
            const t = y / 100;
            const riverX = river.x1 + (river.x2 - river.x1) * t;
            if (Math.abs(x - riverX) < riverWidth) return 'river';
        }
        
        // 基于elevation和moisture的地形
        if (elevation < 0.35) return 'ocean';
        if (elevation < 0.40) return 'beach';
        if (elevation > 0.70) return 'mountain';
        if (elevation > 0.60) return 'hill';
        if (moisture > 0.6) return 'forest';
        if (moisture > 0.5) return 'grass';
        return 'plains';
    }
    
    createCharacter(id, name, x, y) {
        const char = new Character(id, name, x, y);
        this.characters.set(id, char);
        this.inputQueue.set(id, []);
        return char;
    }
    
    // 启动游戏引擎（兼容旧API）
    start(onTick) {
        this.tickInterval = setInterval(() => {
            this.tick();
            if (onTick) onTick();
        }, 1000 / 20);  // 20fps
    }
    
    stop() {
        if (this.tickInterval) {
            clearInterval(this.tickInterval);
        }
    }
    
    // 游戏帧更新
    tick() {
        this.update();
    }
    
    // 处理玩家输入（带序列号）
    handleInput(characterId, seq, input) {
        const char = this.characters.get(characterId);
        if (!char) return;
        
        // 丢弃旧输入
        const queue = this.inputQueue.get(characterId) || [];
        this.inputQueue.set(characterId, queue.filter(i => i.seq > char.lastProcessedInput));
        
        // 添加新输入
        queue.push({
            seq,
            input,
            timestamp: Date.now()
        });
        
        console.log(`📥 ${char.name}: 收到输入 seq=${seq}, action=${input.action}`);
    }
    
    // 服务器更新
    update() {
        const now = Date.now();
        const deltaTime = (now - this.lastTickTime) / 1000;
        this.lastTickTime = now;
        
        this.serverTick++;
        
        // 更新所有角色
        for (const char of this.characters.values()) {
            this.updateCharacter(char, deltaTime);
        }
    }
    
    updateCharacter(char, deltaTime) {
        // 处理输入队列
        const queue = this.inputQueue.get(char.id) || [];
        while (queue.length > 0) {
            const item = queue[0];
            this.applyInput(char, item.input);
            char.lastProcessedInput = item.seq;
            queue.shift();
        }
        
        // 预测移动
        char.predictMove(deltaTime);
        
        // 消耗
        const consumptionRate = 100 / (6 * 60 * 60);
        const multiplier = 0.5 + char.dna.metabolism;
        char.calories = Math.max(0, char.calories - consumptionRate * multiplier);
        char.water = Math.max(0, char.water - consumptionRate * multiplier);
        
        // 死亡检查
        if (char.calories <= 0 || char.water <= 0) {
            char.health = Math.max(0, char.health - 0.1);
        }
    }
    
    applyInput(char, input) {
        if (!input || !input.action) return;
        
        switch (input.action) {
            case 'move':
                if (input.targetX !== undefined && input.targetY !== undefined) {
                    char.targetX = input.targetX;
                    char.targetY = input.targetY;
                    char.action = '移动中';
                }
                break;
            case 'goto':
                char.targetX = input.x;
                char.targetY = input.y;
                char.action = '移动中';
                break;
            case 'stop':
                char.targetX = null;
                char.targetY = null;
                char.action = '闲置';
                break;
        }
    }
    
    // 获取完整状态（初始化用）
    getState() {
        const chars = Array.from(this.characters.values()).map(c => ({
            id: c.id,
            name: c.name,
            x: c.x,
            y: c.y,
            targetX: c.targetX,
            targetY: c.targetY,
            speed: 0.05 * (0.5 + c.dna.agility),
            health: c.health,
            energy: c.energy,
            hunger: c.hungerPercent,
            thirst: c.thirstPercent,
            action: c.action,
            dna: c.dna
        }));
        
        return {
            characters: chars,
            world: this.worldState
        };
    }
    
    // 获取广播状态（带时间戳，用于插值）
    getBroadcastState() {
        const chars = Array.from(this.characters.values()).map(c => ({
            id: c.id,
            x: c.x,
            y: c.y,
            targetX: c.targetX,
            targetY: c.targetY,
            action: c.action,
            lastProcessedInput: c.lastProcessedInput
        }));
        
        return {
            tick: this.serverTick,
            timestamp: Date.now(),
            characters: chars
        };
    }
    
    getPlayerCount() {
        return this.players.size;
    }
    
    getCharacterCount() {
        return this.characters.size;
    }
}

module.exports = { GameEngine };

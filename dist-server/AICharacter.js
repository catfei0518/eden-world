"use strict";
/**
 * 伊甸世界 - AI角色系统 v1.0
 *
 * 基于DNA的AI自动移动系统
 * 观察类游戏核心：让角色自主行动
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServerWorldState = exports.AICharacter = void 0;
// ============ AI 角色类 ============
class AICharacter {
    // 计算背包总热量
    getInventoryCalories() {
        // 浆果: 48 kcal/个 (真实8 × 6)
        // 草本: 20 kcal/个 (真实5 × 4)
        return this.inventory.berries * 48 + this.inventory.herbs * 20;
    }
    constructor(id, name, type, x, y, dna) {
        // 需求状态
        // hunger: 0-2000 kcal (0=饿死, 2000=吃饱)
        // thirst: 0-100 (百分比)
        // energy: 0-100 (百分比)
        this.hunger = 2000;
        this.thirst = 100;
        this.energy = 100;
        // AI 状态机
        this.state = 'idle';
        this.targetX = null;
        this.targetY = null;
        // 状态计时器
        this.stateTimer = 0;
        this.actionTimer = 0;
        this.actionTimerMax = 0; // 用于客户端进度条
        // Phase 1: 背包系统（物品数量）
        this.inventory = { berries: 0, twigs: 0, stones: 0, herbs: 0 };
        this.id = id;
        this.name = name;
        this.type = type;
        this.x = x;
        this.y = y;
        this.birthX = x;
        this.birthY = y;
        // 创建DNA（使用随机或指定的）
        this.dna = dna || this.generateDNA(type);
    }
    /**
     * 生成随机DNA
     */
    generateDNA(type) {
        // 亚当：高好奇心，高胆量，低社交（领导者型）
        // 夏娃：高社交性，中等好奇心（养育型）
        if (type === 'adam') {
            return {
                curiosity: 0.7 + Math.random() * 0.3, // 0.7-1.0
                bravery: 0.6 + Math.random() * 0.4, // 0.6-1.0
                sociability: 0.3 + Math.random() * 0.2, // 0.3-0.5
                aggression: 0.3 + Math.random() * 0.3, // 0.3-0.6
                metabolism: 0.8 + Math.random() * 0.4, // 0.8-1.2
                intelligence: 0.6 + Math.random() * 0.3, // 0.6-0.9
                speed: 0.08 + Math.random() * 0.04, // 0.08-0.12
                strength: 0.4 + Math.random() * 0.4, // 0.4-0.8
                constitution: 0.5 + Math.random() * 0.3, // 0.5-0.8
                lifespan: 900 + Math.random() * 300, // 900-1200
                skinTone: Math.random(),
                height: 0.9 + Math.random() * 0.2
            };
        }
        else {
            return {
                curiosity: 0.4 + Math.random() * 0.3, // 0.4-0.7
                bravery: 0.4 + Math.random() * 0.3, // 0.4-0.7
                sociability: 0.7 + Math.random() * 0.3, // 0.7-1.0
                aggression: 0.2 + Math.random() * 0.2, // 0.2-0.4
                metabolism: 0.7 + Math.random() * 0.3, // 0.7-1.0
                intelligence: 0.6 + Math.random() * 0.3, // 0.6-0.9
                speed: 0.07 + Math.random() * 0.03, // 0.07-0.10
                strength: 0.3 + Math.random() * 0.3, // 0.3-0.6
                constitution: 0.6 + Math.random() * 0.3, // 0.6-0.9
                lifespan: 900 + Math.random() * 300, // 900-1200
                skinTone: Math.random(),
                height: 0.85 + Math.random() * 0.15
            };
        }
    }
    /**
     * 获取需求阈值（受DNA影响）
     */
    getThresholds() {
        return {
            // 饥饿阈值：代谢高的角色更快感到饥饿
            // 2000 kcal满，从1000开始感到饿（约50%）
            hungerTrigger: 600 - (this.dna.metabolism - 1) * 150, // 代谢1.0时600，代谢1.5时525
            thirstTrigger: 50 - (this.dna.metabolism - 1) * 20,
            // 精力阈值
            energyTrigger: 30,
            // 巡逻范围：好奇心影响
            wanderRadius: 10 + this.dna.curiosity * 15 // 10-25格
        };
    }
    /**
     * AI 决策（每tick调用）
     */
    decide(worldState, allCharacters) {
        const thresholds = this.getThresholds();
        // 正在执行动作中
        if (this.actionTimer > 0) {
            return;
        }
        // 如果已经在寻找水源/食物，且有有效目标，不再重新寻路（避免抽搐）
        if ((this.state === 'seeking_water' || this.state === 'seeking_food') && this.targetX !== null) {
            return;
        }
        // 1️⃣ 紧急需求检查（生命危险）
        if (this.thirst < 10) {
            this.state = 'seeking_water';
            this.findNearestWater(worldState);
            return;
        }
        if (this.hunger < 200) { // 饥饿低于200kcal（约10%）时紧急
            this.state = 'seeking_food';
            this.findNearestFood(worldState);
            return;
        }
        if (this.energy < 10) {
            this.state = 'resting';
            this.targetX = null;
            this.targetY = null;
            this.actionTimer = 60;
            this.actionTimerMax = 60; // 休息3秒
            return;
        }
        // 2️⃣ 一般需求检查（开始感到需求）
        if (this.thirst < thresholds.thirstTrigger) {
            this.state = 'seeking_water';
            this.findNearestWater(worldState);
            return;
        }
        if (this.hunger < thresholds.hungerTrigger) {
            this.state = 'seeking_food';
            this.findNearestFood(worldState);
            return;
        }
        // 3️⃣ 社交行为（高社交性角色）
        if (this.dna.sociability > 0.6 && allCharacters.length > 1) {
            const nearest = this.findNearestCharacter(allCharacters);
            if (nearest && this.distanceTo(nearest.x, nearest.y) > 8) {
                // 靠近其他角色
                this.state = 'wandering';
                this.targetX = nearest.x + (Math.random() - 0.5) * 4;
                this.targetY = nearest.y + (Math.random() - 0.5) * 4;
                return;
            }
        }
        // 4️⃣ 探索行为（高好奇心角色）
        if (this.dna.curiosity > 0.5 && Math.random() < 0.3) {
            this.state = 'wandering';
            this.exploreNewArea();
            return;
        }
        // 5️⃣ 默认：在家附近巡逻
        if (this.targetX === null || this.distanceTo(this.targetX, this.targetY) < 1) {
            this.state = 'wandering';
            this.pickWanderTarget();
        }
    }
    /**
     * 寻找最近的水源
     */
    findNearestWater(worldState) {
        const waters = worldState.getWaterSources();
        if (waters.length === 0) {
            // 没有已知水源，随机走
            this.pickWanderTarget();
            return;
        }
        let nearest = waters[0];
        let nearestDist = this.distanceTo(waters[0].x, waters[0].y);
        for (const water of waters) {
            const dist = this.distanceTo(water.x, water.y);
            if (dist < nearestDist) {
                nearest = water;
                nearestDist = dist;
            }
        }
        // 设置目标为水源附近
        this.targetX = nearest.x + (Math.random() - 0.5) * 2;
        this.targetY = nearest.y + (Math.random() - 0.5) * 2;
    }
    /**
     * 寻找最近的食物
     */
    findNearestFood(worldState) {
        const foods = worldState.getFoodSources();
        if (foods.length === 0) {
            // 没有食物，随机走
            this.pickWanderTarget();
            return;
        }
        // 过滤掉已被预留的灌木
        const availableFoods = foods.filter(f => !f.id || worldState.isBushAvailable(f.id));
        if (availableFoods.length === 0) {
            // 所有食物都被预留了，等待一下再尝试（避免重复争抢同一个灌木）
            console.log(`🍃 ${this.name} 找不到可用食物，休息一下...`);
            this.state = 'resting';
            this.targetX = null; // 清除目标，避免重复到达
            this.targetY = null;
            this.actionTimer = 60;
            this.actionTimerMax = 60; // 休息3秒
            return;
        }
        let nearest = availableFoods[0];
        let nearestDist = this.distanceTo(availableFoods[0].x, availableFoods[0].y);
        for (const food of availableFoods) {
            const dist = this.distanceTo(food.x, food.y);
            if (dist < nearestDist) {
                nearest = food;
                nearestDist = dist;
            }
        }
        this.targetX = nearest.x + (Math.random() - 0.5);
        this.targetY = nearest.y + (Math.random() - 0.5);
    }
    /**
     * 寻找最近的物品（树枝、石头等）
     */
    findNearestItem(worldState) {
        // 获取所有可拾取的物品
        const items = worldState.groundObjects.filter(obj => ['twig', 'stone', 'shell', 'herb'].includes(obj.type));
        if (items.length === 0) {
            // 没有物品，随机走
            console.log(`🔍 ${this.name} 找不到物品，到处走走...`);
            this.pickWanderTarget();
            return;
        }
        // 找最近的物品
        let nearest = items[0];
        let nearestDist = this.distanceTo(items[0].x, items[0].y);
        for (const item of items) {
            const dist = this.distanceTo(item.x, item.y);
            if (dist < nearestDist) {
                nearest = item;
                nearestDist = dist;
            }
        }
        this.targetX = nearest.x + (Math.random() - 0.5);
        this.targetY = nearest.y + (Math.random() - 0.5);
        this.state = 'seeking_item';
        console.log(`🔍 ${this.name} 发现了${nearest.type}，正在前往...`);
    }
    /**
     * 寻找最近的其他角色
     */
    findNearestCharacter(allCharacters) {
        let nearest = null;
        let nearestDist = Infinity;
        for (const char of allCharacters) {
            if (char.id === this.id)
                continue;
            const dist = this.distanceTo(char.x, char.y);
            if (dist < nearestDist) {
                nearest = char;
                nearestDist = dist;
            }
        }
        return nearest;
    }
    /**
     * 探索新区域（好奇心驱动）
     */
    exploreNewArea() {
        const thresholds = this.getThresholds();
        // 随机选择一个探索方向
        const angle = Math.random() * Math.PI * 2;
        const distance = thresholds.wanderRadius * (0.5 + Math.random() * 0.5);
        let targetX = this.birthX + Math.cos(angle) * distance;
        let targetY = this.birthY + Math.sin(angle) * distance;
        // 限制在世界边界内
        targetX = Math.max(5, Math.min(195, targetX));
        targetY = Math.max(5, Math.min(95, targetY));
        this.targetX = targetX;
        this.targetY = targetY;
    }
    /**
     * 选择巡逻目标
     */
    pickWanderTarget() {
        const thresholds = this.getThresholds();
        // 在出生地附近随机选择点
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * thresholds.wanderRadius * 0.5;
        this.targetX = this.birthX + Math.cos(angle) * distance;
        this.targetY = this.birthY + Math.sin(angle) * distance;
    }
    /**
     * 执行一步移动
     */
    moveStep(worldState) {
        // 消耗行动计时器
        if (this.actionTimer > 0) {
            this.actionTimer--;
            // 休息时恢复精力
            if (this.state === 'resting') {
                this.energy = Math.min(100, this.energy + 2);
            }
            // 饮水时恢复
            if (this.state === 'drinking') {
                this.thirst = Math.min(100, this.thirst + 5);
            }
            // Phase 1: 采集时收获浆果
            if (this.state === 'gathering') {
                // 采集1-3个浆果
                const harvested = worldState.harvestBerry(Math.floor(this.x), Math.floor(this.y));
                if (harvested > 0) {
                    this.inventory.berries += harvested;
                    this.state = 'eating';
                    this.actionTimer = 30;
                    this.actionTimerMax = 30; // 吃浆果1.5秒
                    console.log(`🫐 ${this.name} 采集了 ${harvested} 个浆果！持有: ${this.inventory.berries}个 (${this.getInventoryCalories()} kcal)`);
                }
                else {
                    // 没有浆果了，释放预留并寻找其他食物
                    const currentBush = worldState.getBushAt(Math.floor(this.x), Math.floor(this.y));
                    if (currentBush) {
                        worldState.releaseBush(currentBush.id, this.id);
                    }
                    this.state = 'idle';
                    this.findNearestFood(worldState);
                }
            }
            // Phase 1.5: 拾取物品（树枝、石头等）
            if (this.state === 'picking_up') {
                const picked = worldState.pickupItem(Math.floor(this.x), Math.floor(this.y));
                if (picked) {
                    // 添加到背包
                    switch (picked.type) {
                        case 'twig':
                            this.inventory.twigs += picked.quantity;
                            console.log(`🪵 ${this.name} 拾取了 ${picked.quantity} 根树枝！持有: ${this.inventory.twigs}个`);
                            break;
                        case 'stone':
                            this.inventory.stones += picked.quantity;
                            console.log(`🪨 ${this.name} 拾取了 ${picked.quantity} 个石头！持有: ${this.inventory.stones}个`);
                            break;
                        case 'herb':
                            this.inventory.herbs += picked.quantity;
                            console.log(`🌿 ${this.name} 拾取了 ${picked.quantity} 株草本！持有: ${this.inventory.herbs}株`);
                            break;
                        case 'shell':
                            // 贝壳可以吃也可以做装饰
                            this.inventory.herbs += picked.quantity; // 暂用herbs存
                            console.log(`🐚 ${this.name} 拾取了 ${picked.quantity} 个贝壳！`);
                            break;
                    }
                }
                this.state = 'idle';
            }
            // Phase 1: 吃浆果时恢复饥饿
            if (this.state === 'eating' && this.inventory.berries > 0) {
                // 每个浆果 48 kcal（真实8kcal × 6）
                const consumed = Math.min(this.inventory.berries, 8); // 每次最多吃8个
                this.inventory.berries -= consumed;
                this.hunger = Math.min(2000, this.hunger + consumed * 48);
                console.log(`🍽️ ${this.name} 吃了 ${consumed} 个浆果，饥饿恢复至 ${this.hunger.toFixed(0)} kcal`);
            }
            return;
        }
        // 消耗需求（根据状态）
        // 休息: 83 kcal/h, 巡逻: 120 kcal/h, 采集: 250 kcal/h
        // = 83/60/20 = 0.069, 120/60/20 = 0.1, 250/60/20 = 0.208 per tick (metabolism 1.0)
        let hungerRate = 0.069; // 默认休息
        if (this.state === 'wandering' || this.state === 'seeking_food' || this.state === 'seeking_water') {
            hungerRate = 0.1;
        }
        else if (this.state === 'gathering' || this.state === 'running') {
            hungerRate = 0.208;
        }
        this.hunger -= hungerRate * this.dna.metabolism;
        this.thirst -= 0.03 * this.dna.metabolism;
        this.energy -= 0.01;
        // 限制范围
        this.hunger = Math.max(0, Math.min(2000, this.hunger));
        this.thirst = Math.max(0, Math.min(100, this.thirst));
        this.energy = Math.max(0, Math.min(100, this.energy));
        // 检查是否到达目标
        if (this.targetX === null || this.targetY === null) {
            this.state = 'idle';
            return;
        }
        const dist = this.distanceTo(this.targetX, this.targetY);
        // 到达目标
        if (dist < 0.5) {
            this.onArrivedAtTarget(worldState);
            return;
        }
        // 移动
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const moveSpeed = this.dna.speed;
        // 检查地形是否可通行
        if (!worldState.isWalkable(this.targetX, this.targetY)) {
            // 目标不可通行，换一个随机目标
            this.pickWanderTarget();
            return;
        }
        if (dist <= moveSpeed) {
            this.x = this.targetX;
            this.y = this.targetY;
        }
        else {
            this.x += (dx / dist) * moveSpeed;
            this.y += (dy / dist) * moveSpeed;
        }
        // 限制在世界边界内
        this.x = Math.max(0, Math.min(200, this.x));
        this.y = Math.max(0, Math.min(100, this.y));
        // 更新状态
        if (this.state === 'idle') {
            this.state = 'wandering';
        }
    }
    /**
     * 到达目标后的行为
     */
    onArrivedAtTarget(worldState) {
        this.targetX = null;
        this.targetY = null;
        switch (this.state) {
            case 'seeking_water':
                // 到达水源，开始饮水
                this.state = 'drinking';
                this.actionTimer = 30;
                this.actionTimerMax = 30; // 饮水1.5秒
                break;
            case 'seeking_food':
                // 到达食物点，检查附近是否有可采集的灌木
                const bush = worldState.getBushAt(Math.floor(this.x), Math.floor(this.y));
                if (bush && bush.hasBerries && bush.berryCount > 0) {
                    // 尝试预留灌木
                    if (worldState.reserveBush(bush.id, this.id)) {
                        // 预留成功，开始采集
                        this.state = 'gathering';
                        this.actionTimer = 20;
                        this.actionTimerMax = 20; // 采集1秒
                        // 标记为最近访问，避免其他角色重复访问
                        worldState.markBushVisited?.(bush.id);
                    }
                    else {
                        // 已被其他角色预留，寻找其他食物
                        this.findNearestFood(worldState);
                    }
                }
                else {
                    // 没有浆果，继续寻找其他食物
                    this.findNearestFood(worldState);
                }
                break;
            case 'seeking_item':
                // 到达物品点，尝试拾取
                const item = worldState.getItemAt(Math.floor(this.x), Math.floor(this.y));
                if (item && ['twig', 'stone', 'shell', 'herb'].includes(item.type)) {
                    // 开始拾取
                    this.state = 'picking_up';
                    this.actionTimer = 20;
                    this.actionTimerMax = 20; // 拾取1秒
                }
                else {
                    // 物品已被拾取，寻找其他物品
                    this.findNearestItem(worldState);
                }
                break;
            case 'wandering':
                // 巡逻到达，随机休息一下
                if (Math.random() < 0.3) {
                    this.state = 'resting';
                    this.actionTimer = 20;
                    this.actionTimerMax = 20; // 休息1秒
                }
                else {
                    this.state = 'idle';
                    this.pickWanderTarget();
                }
                break;
            default:
                this.state = 'idle';
        }
    }
    /**
     * 计算到某点的距离
     */
    distanceTo(x, y) {
        const dx = x - this.x;
        const dy = y - this.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    /**
     * 获取状态描述（用于显示）
     */
    getStatusText() {
        switch (this.state) {
            case 'idle': return '🧘待机';
            case 'wandering': return '🚶巡逻';
            case 'seeking_food': return '🔍找食物';
            case 'seeking_water': return '💧找水';
            case 'seeking_item': return '🔍找物品';
            case 'eating': return '🍖进食';
            case 'drinking': return '💧饮水';
            case 'resting': return '💤休息';
            case 'gathering': return '🫐采集';
            case 'picking_up': return '🤲拾取';
            default: return '❓未知';
        }
    }
    /**
     * 序列化为JSON（用于网络传输）
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            type: this.type,
            x: this.x,
            y: this.y,
            hunger: this.hunger,
            thirst: this.thirst,
            energy: this.energy,
            action: this.getStatusText(),
            dna: this.dna,
            inventory: {
                berries: this.inventory.berries,
                twigs: this.inventory.twigs,
                stones: this.inventory.stones,
                herbs: this.inventory.herbs,
                totalCalories: this.getInventoryCalories()
            }
        };
    }
}
exports.AICharacter = AICharacter;
// ============ 简化版世界状态（用于服务器）============
class ServerWorldState {
    constructor(tiles, groundObjects) {
        this.tiles = new Map();
        this.groundObjects = []; // 改为public
        this.reservedBushes = new Map(); // 灌木预留追踪
        this.recentlyVisited = new Map(); // 最近访问时间戳
        this.VISIT_COOLDOWN = 5000; // 5秒内避免重复访问
        // 建立地形索引
        for (const tile of tiles) {
            this.tiles.set(`${tile.x},${tile.y}`, tile.type);
        }
        this.groundObjects = groundObjects;
    }
    getWaterSources() {
        const water = [];
        // 从地形找水源
        for (const [key, type] of this.tiles) {
            if (type === 'river' || type === 'lake') {
                const [x, y] = key.split(',').map(Number);
                water.push({ x, y });
            }
        }
        // 从物品找水井
        for (const obj of this.groundObjects) {
            if (obj.type === 'well') {
                water.push({ x: obj.x, y: obj.y });
            }
        }
        return water;
    }
    getFoodSources() {
        const food = [];
        const now = Date.now();
        // 灌木作为食物来源，排除最近访问过的
        for (const obj of this.groundObjects) {
            if (obj.type === 'bush') {
                const bushId = `bush_${obj.x}_${obj.y}`;
                const lastVisit = this.recentlyVisited.get(bushId);
                // 跳过5秒内被访问过的灌木
                if (lastVisit && now - lastVisit < this.VISIT_COOLDOWN) {
                    continue;
                }
                food.push({ x: obj.x, y: obj.y, type: 'bush' });
            }
        }
        return food;
    }
    // 标记灌木为最近访问
    markBushVisited(bushId) {
        this.recentlyVisited.set(bushId, Date.now());
    }
    isWalkable(x, y) {
        const tile = this.tiles.get(`${Math.floor(x)},${Math.floor(y)}`);
        if (!tile)
            return false;
        const walkable = ['grass', 'plains', 'forest', 'desert', 'beach'];
        return walkable.includes(tile);
    }
    getTerrainAt(x, y) {
        return this.tiles.get(`${Math.floor(x)},${Math.floor(y)}`) || null;
    }
    // Phase 1: 简化版灌木查询（ServerWorldState不知道berry数据）
    getBushAt(x, y) {
        const bush = this.groundObjects.find(o => o.x === x && o.y === y && o.type === 'bush');
        if (bush) {
            // 假设灌木总有浆果（实际数据在WorldState里）
            return { id: `bush_${x}_${y}`, hasBerries: true, berryCount: 10 };
        }
        return undefined;
    }
    // Phase 1: 采集浆果（简化版，实际上ServerWorldState不会真正减少浆果）
    harvestBerry(x, y) {
        return 1; // 假设每次采集1个
    }
    // 预留灌木
    reserveBush(bushId, characterId) {
        const existing = this.reservedBushes.get(bushId);
        if (existing && existing !== characterId) {
            // 已被其他角色预留
            return false;
        }
        this.reservedBushes.set(bushId, characterId);
        return true;
    }
    // 释放灌木预留
    releaseBush(bushId, characterId) {
        if (this.reservedBushes.get(bushId) === characterId) {
            this.reservedBushes.delete(bushId);
        }
    }
    // 检查灌木是否可用
    isBushAvailable(bushId) {
        const reserved = this.reservedBushes.get(bushId);
        return !reserved;
    }
    // 获取指定位置的物品
    getItemAt(x, y) {
        const item = this.groundObjects.find(obj => obj.x === x && obj.y === y);
        if (item && ['twig', 'stone', 'shell', 'herb'].includes(item.type)) {
            return { type: item.type, quantity: item.quantity || 1 };
        }
        return undefined;
    }
    // 拾取物品
    pickupItem(x, y) {
        const item = this.getItemAt(x, y);
        if (!item)
            return null;
        const qty = item.quantity || 1;
        // 从地面移除
        this.groundObjects = this.groundObjects.filter(obj => !(obj.x === x && obj.y === y));
        return { type: item.type, quantity: qty };
    }
}
exports.ServerWorldState = ServerWorldState;

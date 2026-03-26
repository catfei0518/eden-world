/**
 * 伊甸世界 - AI角色系统 v1.0
 * 
 * 基于DNA的AI自动移动系统
 * 观察类游戏核心：让角色自主行动
 */

import type { CharacterType, Season } from './types/Protocol';

// ============ DNA 类型 ============

export interface CharacterDNA {
    // 性格特质 (0-1)
    curiosity: number;       // 好奇心：探索范围
    bravery: number;        // 胆量：危险区域容忍度
    sociability: number;     // 社交性：靠近其他角色
    aggression: number;      // 攻击性：防御/攻击倾向
    
    // 能力特质
    metabolism: number;      // 代谢：消耗速度倍率 (0.5-2.0)
    intelligence: number;    // 智力：决策质量
    speed: number;           // 移动速度
    strength: number;        // 力量
    constitution: number;     // 体质
    lifespan: number;         // 寿命
    
    // 外观（用于渲染）
    skinTone: number;        // 肤色 0-1
    height: number;          // 身高 0.7-1.3
}

// ============ AI 状态 ============

export type AIState = 
    | 'idle'           // 闲置
    | 'wandering'     // 巡逻
    | 'seeking_food'  // 寻找食物
    | 'seeking_water' // 寻找水源
    | 'eating'        // 进食
    | 'drinking'      // 饮水
    | 'resting';      // 休息

// ============ AI 角色类 ============

export class AICharacter {
    readonly id: string;
    readonly name: string;
    readonly type: CharacterType;
    
    // 位置
    x: number;
    y: number;
    birthX: number;  // 出生地（用于限制巡逻范围）
    birthY: number;
    
    // DNA
    dna: CharacterDNA;
    
    // 需求状态 (0-100)
    hunger: number = 100;
    thirst: number = 100;
    energy: number = 100;
    
    // AI 状态机
    state: AIState = 'idle';
    targetX: number | null = null;
    targetY: number | null = null;
    
    // 状态计时器
    stateTimer: number = 0;
    actionTimer: number = 0;
    
    constructor(id: string, name: string, type: CharacterType, x: number, y: number, dna?: CharacterDNA) {
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
    private generateDNA(type: CharacterType): CharacterDNA {
        // 亚当：高好奇心，高胆量，低社交（领导者型）
        // 夏娃：高社交性，中等好奇心（养育型）
        
        if (type === 'adam') {
            return {
                curiosity: 0.7 + Math.random() * 0.3,      // 0.7-1.0
                bravery: 0.6 + Math.random() * 0.4,       // 0.6-1.0
                sociability: 0.3 + Math.random() * 0.2,    // 0.3-0.5
                aggression: 0.3 + Math.random() * 0.3,      // 0.3-0.6
                metabolism: 0.8 + Math.random() * 0.4,     // 0.8-1.2
                intelligence: 0.6 + Math.random() * 0.3,   // 0.6-0.9
                speed: 0.08 + Math.random() * 0.04,       // 0.08-0.12
                strength: 0.4 + Math.random() * 0.4,       // 0.4-0.8
                constitution: 0.5 + Math.random() * 0.3,   // 0.5-0.8
                lifespan: 900 + Math.random() * 300,        // 900-1200
                skinTone: Math.random(),
                height: 0.9 + Math.random() * 0.2
            };
        } else {
            return {
                curiosity: 0.4 + Math.random() * 0.3,     // 0.4-0.7
                bravery: 0.4 + Math.random() * 0.3,        // 0.4-0.7
                sociability: 0.7 + Math.random() * 0.3,    // 0.7-1.0
                aggression: 0.2 + Math.random() * 0.2,     // 0.2-0.4
                metabolism: 0.7 + Math.random() * 0.3,     // 0.7-1.0
                intelligence: 0.6 + Math.random() * 0.3,   // 0.6-0.9
                speed: 0.07 + Math.random() * 0.03,       // 0.07-0.10
                strength: 0.3 + Math.random() * 0.3,       // 0.3-0.6
                constitution: 0.6 + Math.random() * 0.3,   // 0.6-0.9
                lifespan: 900 + Math.random() * 300,        // 900-1200
                skinTone: Math.random(),
                height: 0.85 + Math.random() * 0.15
            };
        }
    }
    
    /**
     * 获取需求阈值（受DNA影响）
     */
    private getThresholds() {
        return {
            // 饥饿阈值：代谢高的角色更快感到饥饿
            hungerTrigger: 50 - (this.dna.metabolism - 1) * 20,  // 代谢1.0时50，代谢1.5时40
            thirstTrigger: 50 - (this.dna.metabolism - 1) * 20,
            // 精力阈值
            energyTrigger: 30,
            // 巡逻范围：好奇心影响
            wanderRadius: 10 + this.dna.curiosity * 15  // 10-25格
        };
    }
    
    /**
     * AI 决策（每tick调用）
     */
    decide(worldState: WorldState, allCharacters: AICharacter[]): void {
        const thresholds = this.getThresholds();
        
        // 正在执行动作中
        if (this.actionTimer > 0) {
            return;
        }
        
        // 1️⃣ 紧急需求检查
        if (this.thirst < 30) {
            this.state = 'seeking_water';
            this.findNearestWater(worldState);
            return;
        }
        
        if (this.hunger < 30) {
            this.state = 'seeking_food';
            this.findNearestFood(worldState);
            return;
        }
        
        if (this.energy < thresholds.energyTrigger) {
            this.state = 'resting';
            this.targetX = null;
            this.targetY = null;
            this.actionTimer = 60;  // 休息3秒
            return;
        }
        
        // 2️⃣ 一般需求检查
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
    private findNearestWater(worldState: WorldState): void {
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
    private findNearestFood(worldState: WorldState): void {
        const foods = worldState.getFoodSources();
        if (foods.length === 0) {
            // 没有食物，随机走
            this.pickWanderTarget();
            return;
        }
        
        let nearest = foods[0];
        let nearestDist = this.distanceTo(foods[0].x, foods[0].y);
        
        for (const food of foods) {
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
     * 寻找最近的其他角色
     */
    private findNearestCharacter(allCharacters: AICharacter[]): AICharacter | null {
        let nearest: AICharacter | null = null;
        let nearestDist = Infinity;
        
        for (const char of allCharacters) {
            if (char.id === this.id) continue;
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
    private exploreNewArea(): void {
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
    private pickWanderTarget(): void {
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
    moveStep(worldState: WorldState): void {
        // 消耗行动计时器
        if (this.actionTimer > 0) {
            this.actionTimer--;
            
            // 休息时恢复精力
            if (this.state === 'resting') {
                this.energy = Math.min(100, this.energy + 2);
            }
            
            // 饮水/进食时恢复
            if (this.state === 'drinking') {
                this.thirst = Math.min(100, this.thirst + 5);
            }
            if (this.state === 'eating') {
                this.hunger = Math.min(100, this.hunger + 3);
            }
            
            return;
        }
        
        // 消耗需求
        this.hunger -= 0.02 * this.dna.metabolism;
        this.thirst -= 0.03 * this.dna.metabolism;
        this.energy -= 0.01;
        
        // 限制范围
        this.hunger = Math.max(0, Math.min(100, this.hunger));
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
            this.onArrivedAtTarget();
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
        } else {
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
    private onArrivedAtTarget(): void {
        this.targetX = null;
        this.targetY = null;
        
        switch (this.state) {
            case 'seeking_water':
                // 到达水源，开始饮水
                this.state = 'drinking';
                this.actionTimer = 30;  // 饮水1.5秒
                break;
                
            case 'seeking_food':
                // 到达食物点，开始进食
                this.state = 'eating';
                this.actionTimer = 40;  // 进食2秒
                break;
                
            case 'wandering':
                // 巡逻到达，随机休息一下
                if (Math.random() < 0.3) {
                    this.state = 'resting';
                    this.actionTimer = 20;  // 休息1秒
                } else {
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
    private distanceTo(x: number, y: number): number {
        const dx = x - this.x;
        const dy = y - this.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    /**
     * 获取状态描述（用于显示）
     */
    getStatusText(): string {
        switch (this.state) {
            case 'idle': return '🧘待机';
            case 'wandering': return '🚶巡逻';
            case 'seeking_food': return '🔍找食物';
            case 'seeking_water': return '💧找水';
            case 'eating': return '🍖进食';
            case 'drinking': return '💧饮水';
            case 'resting': return '💤休息';
            default: return '❓未知';
        }
    }
    
    /**
     * 序列化为JSON（用于网络传输）
     */
    toJSON(): AICharacterData {
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
            dna: this.dna
        };
    }
}

// ============ 世界状态接口（用于AI决策）============

export interface AICharacterData {
    id: string;
    name: string;
    type: CharacterType;
    x: number;
    y: number;
    hunger: number;
    thirst: number;
    energy: number;
    action: string;
    dna: CharacterDNA;
}

export interface WorldState {
    // 获取所有水源位置
    getWaterSources(): { x: number; y: number }[];
    // 获取所有食物位置
    getFoodSources(): { x: number; y: number }[];
    // 检查某位置是否可通行
    isWalkable(x: number, y: number): boolean;
    // 获取地形类型
    getTerrainAt(x: number, y: number): string | null;
}

// ============ 简化版世界状态（用于服务器）============

export class ServerWorldState implements WorldState {
    private tiles: Map<string, string> = new Map();
    private groundObjects: { x: number; y: number; type: string }[] = [];
    
    constructor(
        tiles: { x: number; y: number; type: string }[],
        groundObjects: { x: number; y: number; type: string }[]
    ) {
        // 建立地形索引
        for (const tile of tiles) {
            this.tiles.set(`${tile.x},${tile.y}`, tile.type);
        }
        this.groundObjects = groundObjects;
    }
    
    getWaterSources(): { x: number; y: number }[] {
        const water: { x: number; y: number }[] = [];
        
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
    
    getFoodSources(): { x: number; y: number }[] {
        const food: { x: number; y: number }[] = [];
        
        for (const obj of this.groundObjects) {
            if (obj.type === 'berry' || obj.type === 'bush' || obj.type === 'tree') {
                food.push({ x: obj.x, y: obj.y });
            }
        }
        
        return food;
    }
    
    isWalkable(x: number, y: number): boolean {
        const tile = this.tiles.get(`${Math.floor(x)},${Math.floor(y)}`);
        if (!tile) return false;
        
        const walkable = ['grass', 'plains', 'forest', 'desert', 'beach'];
        return walkable.includes(tile);
    }
    
    getTerrainAt(x: number, y: number): string | null {
        return this.tiles.get(`${Math.floor(x)},${Math.floor(y)}`) || null;
    }
}

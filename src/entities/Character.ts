/**
 * 角色实体 - DNA驱动的AI
 */

import { DNA, Phenotype } from '../systems/dna/DNA';
import { WorldState } from '../systems/needs/NeedsCalculator';

export type CharacterType = 'adam' | 'eve';

export interface CharacterData {
    id: string;
    name: string;
    type: CharacterType;
    dna: DNA;
    x: number;
    y: number;
    food: number;
    water: number;
    energy: number;
    action: string;
}

const TILE_SIZE = 64;

export class Character {
    readonly id: string;
    readonly name: string;
    readonly type: CharacterType;
    readonly dna: DNA;
    readonly phenotype: Phenotype; // 缓存表现型
    
    x: number;
    y: number;
    
    // 状态
    food: number = 5;
    water: number = 5;
    energy: number = 5; // 5=满, 0=空
    health: number = 100; // 生命值 0-100
    
    // 当前行动
    action: string = '闲置';
    target: { x: number; y: number } | null = null;
    
    // 碰撞检测
    private canMove: (x: number, y: number) => boolean;
    
    constructor(type: CharacterType, x: number, y: number, name?: string, canMove?: (x: number, y: number) => boolean) {
        this.id = `char_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        this.type = type;
        this.name = name || (type === 'adam' ? '亚当' : '夏娃');
        this.dna = DNA.createInitial();
        this.phenotype = this.dna.getPhenotype();
        this.x = x;
        this.y = y;
        this.canMove = canMove || (() => true);
    }
    
    // 获取移动速度（受敏捷DNA影响）
    private get moveSpeed(): number {
        // 基础速度 * (0.5 + 敏捷 * 1.5)
        // 敏捷低的0.5倍速度，高的2倍速度
        return 0.017 * (0.5 + this.phenotype.agility * 1.5);
    }
    
    // 获取代谢速度（影响消耗）
    private get metabolismRate(): number {
        return this.phenotype.metabolism;
    }
    
    // 获取需求阈值（受DNA影响）
    private get hungerThreshold(): number {
        // 基础3，代谢快的阈值更低（更早感到饥饿）
        return 3 - (this.phenotype.metabolism - 1) * 0.5;
    }
    
    private get thirstThreshold(): number {
        return 3 - (this.phenotype.metabolism - 1) * 0.5;
    }
    
    // 获取探索范围（受好奇心DNA影响）
    private get wanderRange(): number {
        // 基础8，好奇心高的探索范围更大
        return Math.floor(8 + this.phenotype.curiosity * 12);
    }
    
    // ==================== 核心战斗属性 ====================
    
    // 胆量：探索危险区域的意愿
    // true = 愿意探索危险区域
    public shouldExploreDanger(): boolean {
        return this.phenotype.bravery > 0.6;
    }
    
    // 恐惧阈值：是否触发逃跑
    // dangerLevel: 0-1，危险程度
    // 返回true表示应该逃跑
    public shouldFlee(dangerLevel: number): boolean {
        // 危险程度超过阈值就逃跑
        // 阈值低的(0.3)容易被吓跑，阈值高的(0.7)不容易跑
        return dangerLevel > (1 - this.phenotype.fearResponse);
    }
    
    // 攻击性：是否主动攻击
    // true = 主动攻击
    public shouldAttack(): boolean {
        return this.phenotype.aggression > 0.6;
    }
    
    // 获取性格描述
    public getPersonality(): string {
        const bravery = this.phenotype.bravery;
        const fear = this.phenotype.fearResponse;
        const aggr = this.phenotype.aggression;
        
        // 判断性格类型
        if (bravery > 0.7 && fear > 0.7 && aggr > 0.7) return '勇士';
        if (bravery > 0.7 && fear < 0.4 && aggr > 0.7) return '莽夫';
        if (bravery > 0.7 && fear > 0.7 && aggr < 0.4) return '谨慎战士';
        if (bravery < 0.4 && fear < 0.4 && aggr < 0.4) return '逃兵';
        if (bravery < 0.4 && fear > 0.7 && aggr < 0.4) return '旁观者';
        if (aggr > 0.7) return '挑衅者';
        if (fear < 0.4) return '易受惊';
        return '普通人';
    }
    
    // ==================== 生命值系统 ====================
    
    // 最大生命值（体质影响）
    public get maxHealth(): number {
        // 75 + 体质 × 50 = 75-125
        return 75 + this.phenotype.constitution * 50;
    }
    
    // 生命值百分比
    public get healthPercent(): number {
        return Math.round((this.health / this.maxHealth) * 100);
    }
    
    // 基础伤害（力量影响）
    public get baseDamage(): number {
        // 10 + 力量 × 20 = 10-30
        return 10 + this.phenotype.strength * 20;
    }
    
    // 获取生命状态
    public getHealthStatus(): string {
        const pct = this.health / this.maxHealth;
        if (pct > 0.7) return '健康';
        if (pct > 0.4) return '轻伤';
        if (pct > 0.2) return '重伤';
        return '濒死';
    }
    
    // 受到伤害
    public takeDamage(damage: number): void {
        if (this.isDead) return;
        this.health = Math.max(0, this.health - damage);
        if (this.health <= 0) {
            this.die(`战斗伤害 (-${damage}HP)`);
        }
    }
    
    // 死亡原因
    public deathCause: string = '';
    
    // 死亡时间（游戏时间戳）
    public deathTime: number = 0;
    
    // 死亡时年龄
    public deathAge: number = 0;
    
    // 死亡标记
    public isDead: boolean = false;
    
    // 死亡方法
    public die(cause: string = '未知'): void {
        this.isDead = true;
        this.action = '死亡';
        this.deathCause = cause;
        this.deathTime = Date.now(); // TODO: 接入游戏时间系统
        this.deathAge = 0; // TODO: 接入年龄系统
        
        // 记录死亡日志
        console.log(`💀 ${this.name} 死亡了！`);
        console.log(`   死因: ${cause}`);
        console.log(`   位置: (${this.x.toFixed(1)}, ${this.y.toFixed(1)})`);
    }
    
    // 恢复生命
    public heal(amount: number): void {
        this.health = Math.min(this.maxHealth, this.health + amount);
    }
    
    // 攻击其他角色
    public attack(target: Character, weaponBonus: number = 0): number {
        // 伤害 = 基础伤害 + 武器加成 - 目标体质减免
        const damage = this.baseDamage + weaponBonus - target.phenotype.constitution * 10;
        const actualDamage = Math.max(1, Math.round(damage)); // 最小1点伤害
        target.takeDamage(actualDamage);
        return actualDamage;
    }
    
    // 每帧更新
    update(deltaTime: number, world: WorldState): void {
        // 消耗（受代谢影响）
        const consumption = deltaTime * 0.01 * this.metabolismRate;
        this.food = Math.max(0, this.food - consumption);
        this.water = Math.max(0, this.water - consumption * 1.5);
        this.energy = Math.max(0, this.energy - consumption);
        
        // 生命值消耗
        // 口渴为0：每分钟消耗2点生命
        if (this.water <= 0 && !this.isDead) {
            this.health = Math.max(0, this.health - deltaTime * 2 / 60);
        }
        // 饥饿为0：每分钟消耗1点生命
        if (this.food <= 0 && !this.isDead) {
            this.health = Math.max(0, this.health - deltaTime * 1 / 60);
        }
        
        // 死亡检查
        if (this.health <= 0 && !this.isDead) {
            this.die('饥饿/口渴耗尽');
        }
        
        // 移动
        if (this.target) {
            this.moveToTarget();
        }
        
        // 决策
        this.decide(world);
    }
    
    // 决策（受DNA性格影响）
    private decide(world: WorldState): void {
        // 有目标时不决策
        if (this.target) return;
        
        // 口渴优先（但受阈值影响）
        if (this.water < this.thirstThreshold) {
            this.action = '寻找水源';
            this.goToWater(world);
            return;
        }
        
        // 饥饿次之（但受阈值影响）
        if (this.food < this.hungerThreshold) {
            this.action = '寻找食物';
            this.goToFood(world);
            return;
        }
        
        // 精力不足
        if (this.energy < 2) {
            this.action = '休息中';
            this.target = null;
            this.energy = Math.min(5, this.energy + 0.15); // 恢复（受耐力影响）
            return;
        }
        
        // 探索（受好奇心影响）
        this.action = '探索中';
        this.wander();
    }
    
    // 找水
    private goToWater(world: WorldState): void {
        if (world.nearbyWater.length > 0) {
            const w = world.nearbyWater[0];
            this.target = { x: w.position.x, y: w.position.y };
        } else {
            this.wander();
        }
    }
    
    // 找食物
    private goToFood(world: WorldState): void {
        if (world.nearbyFood.length > 0) {
            const f = world.nearbyFood[0];
            this.target = { x: f.position.x, y: f.position.y };
        } else {
            this.wander();
        }
    }
    
    // 随机漫游（受好奇心影响范围）
    private wander(): void {
        const range = this.wanderRange;
        for (let i = 0; i < 20; i++) {
            const x = Math.floor(this.x) + Math.floor(Math.random() * range * 2) - range;
            const y = Math.floor(this.y) + Math.floor(Math.random() * range * 2) - range;
            if (x < 0 || y < 0) continue;
            if (this.canMove(x, y)) {
                this.target = { x, y };
                return;
            }
        }
    }
    
    // 移动（受敏捷影响速度）
    private moveToTarget(): void {
        if (!this.target) return;
        
        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // 到达
        if (dist < 0.3) {
            this.x = this.target.x;
            this.y = this.target.y;
            this.arrive();
            return;
        }
        
        // 移动（使用DNA影响的移动速度）
        const speed = this.moveSpeed;
        const nextX = this.x + (dx / dist) * speed;
        const nextY = this.y + (dy / dist) * speed;
        
        if (this.canMove(Math.round(nextX), Math.round(nextY))) {
            this.x = nextX;
            this.y = nextY;
        } else {
            this.target = null;
        }
    }
    
    // 到达
    private arrive(): void {
        this.target = null;
        
        if (this.action === '寻找水源') {
            this.water = Math.min(5, this.water + 2);
        } else if (this.action === '寻找食物') {
            this.food = Math.min(5, this.food + 2);
        }
        
        this.energy = 5; // 完全恢复
    }
    
    getPixelPos(): { x: number; y: number } {
        return {
            x: this.x * TILE_SIZE + TILE_SIZE / 2,
            y: this.y * TILE_SIZE + TILE_SIZE / 2
        };
    }
}

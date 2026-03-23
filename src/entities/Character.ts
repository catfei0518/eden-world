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
    
    // 状态 - 营养系统
    // 初始100% = 每日需求的1/3（约1顿饭的量）
    calories: number = 100;      // 当前饱食度 0-100%
    water: number = 100;       // 当前口渴度 0-100%
    
    energy: number = 5; // 精力 5=满, 0=空
    health: number = 100; // 生命值 0-100
    
    // 当前行动
    action: string = '闲置';
    target: { x: number; y: number } | null = null;
    
    // 手中物品
    heldItem: string | null = null;  // 物品类型
    heldItemCount: number = 0;      // 物品数量
    
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
    
    // ==================== 生存属性 ====================
    
    // 生活方式统计
    public lifestyle = {
        rawMeatEaten: 0,       // 吃生肉次数
        rawWaterDrunk: 0,        // 喝生水次数
        cookedMealsEaten: 0,      // 吃熟食次数
        cleanWaterDrunk: 0,      // 喝净水次数
        starvationDays: 0,        // 饥饿天数
        diseaseEpisodes: 0,       // 患病次数
        overworkDays: 0,          // 过度劳累天数
    };
    
    // 计算基础寿命（DNA决定上限）
    public get baseLifespan(): number {
        // DNA中lifespan是600-1200，需要归一化到40-70岁
        const normalized = Math.max(0, Math.min(1, (this.phenotype.lifespan - 600) / 600));
        return 40 + normalized * 30; // 40-70游戏岁
    }
    
    // 计算生活方式系数
    public get lifestyleMultiplier(): number {
        let mult = 1.0;
        
        // 正面因素（简化版）
        // 吃熟食+10%
        if (this.lifestyle.cookedMealsEaten > this.lifestyle.rawMeatEaten) {
            mult += 0.1;
        }
        // 喝净水+10%
        if (this.lifestyle.cleanWaterDrunk > this.lifestyle.rawWaterDrunk) {
            mult += 0.1;
        }
        
        // 负面因素
        // 生肉-5%每次（上限-30%）
        mult -= Math.min(this.lifestyle.rawMeatEaten * 0.05, 0.3);
        // 生水-3%每次（上限-20%）
        mult -= Math.min(this.lifestyle.rawWaterDrunk * 0.03, 0.2);
        // 饥饿-2%每天（上限-30%）
        mult -= Math.min(this.lifestyle.starvationDays * 0.02, 0.3);
        // 疾病-10%每次（上限-50%）
        mult -= Math.min(this.lifestyle.diseaseEpisodes * 0.1, 0.5);
        
        return Math.max(0.3, Math.min(1.5, mult)); // 30%-150%
    }
    
    // 计算预期寿命
    public get lifeExpectancy(): number {
        return this.baseLifespan * this.lifestyleMultiplier;
    }
    
    // 获取生活方式状态
    public getLifestyleStatus(): string {
        const mult = this.lifestyleMultiplier;
        if (mult >= 1.2) return '优良';
        if (mult >= 1.0) return '良好';
        if (mult >= 0.8) return '一般';
        if (mult >= 0.6) return '较差';
        return '糟糕';
    }
    
    // ==================== 营养系统 ====================
    
    // 计算每日基础代谢需求 (kcal)
    public get dailyCalorieNeed(): number {
        // 代谢0.5 = 1500kcal, 代谢1.0 = 2000kcal
        return 1500 * (0.5 + this.phenotype.metabolism);
    }
    
    // 计算每日水分需求 (ml)
    public get dailyWaterNeed(): number {
        return 2000; // 固定2000ml
    }
    
    // 饥饿百分比 (0-100)
    public get hungerPercent(): number {
        return Math.round(this.calories);
    }
    
    // 口渴百分比 (0-100)
    public get thirstPercent(): number {
        return Math.round(this.water);
    }
    
    // 获取饥饿/口渴状态描述
    public getHungerStatus(): string {
        const pct = this.hungerPercent;
        if (pct >= 80) return '饱';
        if (pct >= 50) return '正常';
        if (pct >= 30) return '饥饿';
        if (pct >= 10) return '很饿';
        return '饿死';
    }
    
    public getThirstStatus(): string {
        const pct = this.thirstPercent;
        if (pct >= 80) return '充足';
        if (pct >= 50) return '正常';
        if (pct >= 30) return '口渴';
        if (pct >= 10) return '很渴';
        return '渴死';
    }
    
    // 获取寿命影响描述
    public getLifeImpactDesc(): string {
        const impacts: string[] = [];
        
        // 正面
        if (this.lifestyle.cookedMealsEaten > this.lifestyle.rawMeatEaten) {
            impacts.push('✅熟食');
        }
        if (this.lifestyle.cleanWaterDrunk > this.lifestyle.rawWaterDrunk) {
            impacts.push('✅净水');
        }
        
        // 负面
        if (this.lifestyle.rawMeatEaten > 0) {
            impacts.push(`❌生肉×${this.lifestyle.rawMeatEaten}`);
        }
        if (this.lifestyle.rawWaterDrunk > 0) {
            impacts.push(`❌生水×${this.lifestyle.rawWaterDrunk}`);
        }
        if (this.lifestyle.starvationDays > 0) {
            impacts.push(`❌饥饿×${this.lifestyle.starvationDays}`);
        }
        
        return impacts.length > 0 ? impacts.join(' ') : '无记录';
    }
    
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
        // 每分钟消耗约1/10的每日需求
        const consumptionPerMinute = deltaTime / 60;
        const calorieConsumption = (this.dailyCalorieNeed / 10) * consumptionPerMinute;
        const waterConsumption = (this.dailyWaterNeed / 10) * consumptionPerMinute;
        
        this.calories = Math.max(0, this.calories - calorieConsumption);
        this.water = Math.max(0, this.water - waterConsumption);
        this.energy = Math.max(0, this.energy - consumptionPerMinute * 0.1);
        
        // 在食物/水源附近时恢复（基于代谢）
        if (this.action === '寻找食物' && world.nearbyFood.length > 0) {
            // 在食物附近，每秒恢复少量热量
            this.calories += 0.5 * this.phenotype.metabolism;
        }
        if (this.action === '寻找水源' && world.nearbyWater.length > 0) {
            // 在水源附近，每秒恢复少量水分
            this.water += 0.5 * this.phenotype.metabolism;
        }
        
        // 生命值消耗
        // 热量为0：每分钟消耗生命
        if (this.calories <= 0 && !this.isDead) {
            this.health = Math.max(0, this.health - deltaTime * 1 / 60);
        }
        // 水分低于10%：每分钟消耗生命
        if (this.water < this.dailyWaterNeed * 0.1 && !this.isDead) {
            this.health = Math.max(0, this.health - deltaTime * 2 / 60);
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
        
        // 手中有物品，先处理
        if (this.heldItem) {
            // 吃东西
            if (this.hungerPercent < 80) {
                this.action = '吃东西';
                return;
            }
            // 喝水
            if (this.thirstPercent < 80) {
                this.action = '喝水';
                return;
            }
        }
        
        // 口渴优先（但受阈值影响）
        if (this.thirstPercent < 50) {
            this.action = '寻找水源';
            this.goToWater(world);
            return;
        }
        
        // 饥饿次之（但受阈值影响）
        if (this.hungerPercent < 50) {
            this.action = '寻找食物';
            this.goToFood(world);
            return;
        }
        
        // 精力不足
        if (this.energy < 2) {
            this.action = '休息中';
            this.target = null;
            this.energy = Math.min(5, this.energy + 0.15);
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
            // 获取水源物品
            this.heldItem = 'river_water';
            this.heldItemCount = 1;
            this.action = '取水中';
        } else if (this.action === '寻找食物') {
            // 获取食物物品
            this.heldItem = 'berry';
            this.heldItemCount = 1;
            this.action = '采集中';
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

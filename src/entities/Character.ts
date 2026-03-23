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
    
    // 每帧更新
    update(deltaTime: number, world: WorldState): void {
        // 消耗（受代谢影响）
        const consumption = deltaTime * 0.01 * this.metabolismRate;
        this.food = Math.max(0, this.food - consumption);
        this.water = Math.max(0, this.water - consumption * 1.5);
        this.energy = Math.max(0, this.energy - consumption);
        
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

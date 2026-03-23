/**
 * 角色实体 - 包含DNA、需求和AI决策
 */

import { DNA, Phenotype } from '../systems/dna/DNA';
import { NeedsCalculator, IndividualState, WorldState } from '../systems/needs/NeedsCalculator';
import { AIController, ActionType } from '../systems/ai/AIController';

export type CharacterType = 'adam' | 'eve';

export interface CharacterData {
    id: string;
    name: string;
    type: CharacterType;
    dna: DNA;
    phenotype: Phenotype;
    position: { x: number; y: number };
    state: IndividualState;
    ai: AIController;
    currentAction: ActionType | null;
    actionTarget: { x: number; y: number } | null;
}

const TILE_SIZE = 64;
const CHARACTER_SIZE = 32;

export class Character {
    // 基础属性
    readonly id: string;
    readonly name: string;
    readonly type: CharacterType;
    
    // DNA和表现型
    readonly dna: DNA;
    readonly phenotype: Phenotype;
    
    // 位置
    x: number;
    y: number;
    
    // 状态
    private state: IndividualState;
    
    // AI系统
    private needsCalculator: NeedsCalculator;
    private aiController: AIController;
    private currentAction: ActionType | null = null;
    private actionTarget: { x: number; y: number } | null = null;
    private actionTimer: number = 0;
    
    // 构造函数
    constructor(type: CharacterType, x: number, y: number, name?: string) {
        this.id = `char_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.type = type;
        this.name = name || (type === 'adam' ? '亚当' : '夏娃');
        
        // 创建DNA
        this.dna = DNA.createInitial();
        this.phenotype = this.dna.getPhenotype();
        
        // 初始化位置
        this.x = x;
        this.y = y;
        
        // 初始化状态
        this.state = {
            storedFood: 5,
            storedWater: 3,
            health: 100,
            lastMealTime: 0,
            lastDrinkTime: 0,
            lastRestTime: 0,
            lastSocialTime: 0,
            position: { x, y },
            age: 0,
            sex: type === 'adam' ? 'male' : 'female',
            aloneTime: 0
        };
        
        // 初始化AI系统
        this.needsCalculator = new NeedsCalculator();
        this.aiController = new AIController(this.phenotype);
    }
    
    // 每帧更新
    update(deltaTime: number, worldState: WorldState): void {
        // 更新年龄
        this.state.age += deltaTime;
        this.state.lastRestTime += deltaTime;
        this.state.aloneTime += deltaTime;
        
        // 如果有目标位置，向目标移动
        if (this.actionTarget) {
            this.moveToTarget();
            
            // 到达目标后重置
            if (Math.abs(this.x - this.actionTarget.x) < 0.5 && 
                Math.abs(this.y - this.actionTarget.y) < 0.5) {
                this.actionTarget = null;
                this.currentAction = null;
                this.actionTimer = 0;
            }
            return;
        }
        
        // 执行动作时增加计时器
        if (this.currentAction) {
            this.actionTimer += deltaTime;
            return;
        }
        
        // AI决策
        this.makeDecision(worldState);
    }
    
    // AI决策
    private makeDecision(worldState: WorldState): void {
        // 计算需求
        const needs = this.needsCalculator.calculate(this.state, worldState, this.phenotype);
        
        // AI决定行动
        const action = this.aiController.decideAction(needs, this.state, worldState);
        
        // 设置行动目标
        this.currentAction = action;
        this.actionTimer = 0;
        
        // 根据行动类型设置目标
        this.setActionTarget(action, worldState);
    }
    
    // 设置行动目标
    private setActionTarget(action: ActionType, worldState: WorldState): void {
        switch (action) {
            case ActionType.FIND_FOOD:
            case ActionType.GATHER:
                // 找食物 - 向附近食物移动
                if (worldState.nearbyFood.length > 0) {
                    const food = worldState.nearbyFood[0];
                    this.actionTarget = { x: food.position.x, y: food.position.y };
                } else {
                    // 随机移动
                    this.randomMove();
                }
                break;
                
            case ActionType.FIND_WATER:
                // 找水
                if (worldState.nearbyWater.length > 0) {
                    const water = worldState.nearbyWater[0];
                    this.actionTarget = { x: water.position.x, y: water.position.y };
                } else {
                    this.randomMove();
                }
                break;
                
            case ActionType.DRINK:
            case ActionType.EAT:
                // 喝水/吃东西 - 消耗物品
                this.consumeResources(action);
                this.actionTarget = null;
                this.currentAction = null;
                break;
                
            case ActionType.REST:
            case ActionType.SLEEP:
                // 休息 - 不移动
                this.state.lastRestTime = 0;
                this.state.health = Math.min(100, this.state.health + 10);
                this.actionTarget = null;
                this.currentAction = null;
                break;
                
            case ActionType.SOCIALIZE:
                // 社交 - 向其他角色移动
                if (worldState.nearbyCharacters > 1) {
                    // 随机移动找人
                    this.randomMove();
                }
                break;
                
            case ActionType.EXPLORE:
                // 探索 - 随机移动
                this.randomMove();
                break;
                
            case ActionType.FLEE:
                // 逃跑 - 远离威胁
                this.fleeFromThreat(worldState);
                break;
                
            default:
                this.randomMove();
        }
    }
    
    // 向目标移动
    private moveToTarget(): void {
        if (!this.actionTarget) return;
        
        const dx = this.actionTarget.x - this.x;
        const dy = this.actionTarget.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 0.1) {
            this.x = this.actionTarget.x;
            this.y = this.actionTarget.y;
        } else {
            // 根据敏捷度决定速度
            const speed = 0.01 + (this.phenotype.agility / 100) * 0.02;
            this.x += (dx / dist) * speed;
            this.y += (dy / dist) * speed;
        }
        
        // 更新状态位置
        this.state.position = { x: this.x, y: this.y };
        this.state.lastRestTime += 0.016; // 约1帧
    }
    
    // 随机移动
    private randomMove(): void {
        const directions = [
            { dx: 1, dy: 0 },
            { dx: -1, dy: 0 },
            { dx: 0, dy: 1 },
            { dx: 0, dy: -1 },
            { dx: 1, dy: 1 },
            { dx: -1, dy: -1 },
        ];
        
        const dir = directions[Math.floor(Math.random() * directions.length)];
        this.actionTarget = {
            x: Math.max(0, Math.min(99, this.x + dir.dx * 5)),
            y: Math.max(0, Math.min(49, this.y + dir.dy * 5))
        };
    }
    
    // 逃离威胁
    private fleeFromThreat(worldState: WorldState): void {
        if (worldState.threats.length === 0) {
            this.randomMove();
            return;
        }
        
        const threat = worldState.threats[0];
        // 远离威胁方向
        this.actionTarget = {
            x: this.x - (threat.x - this.x) * 2,
            y: this.y - (threat.y - this.y) * 2
        };
    }
    
    // 消耗资源
    private consumeResources(action: ActionType): void {
        if (action === ActionType.EAT && this.state.storedFood > 0) {
            this.state.storedFood -= 1;
            this.state.lastMealTime = 0;
            // 减少饥饿感
        } else if (action === ActionType.DRINK && this.state.storedWater > 0) {
            this.state.storedWater -= 1;
            this.state.lastDrinkTime = 0;
            // 减少口渴感
        }
    }
    
    // 获取像素位置
    getPixelPosition(): { x: number; y: number } {
        return {
            x: this.x * TILE_SIZE + TILE_SIZE / 2,
            y: this.y * TILE_SIZE + TILE_SIZE / 2
        };
    }
    
    // 获取当前状态
    getState(): IndividualState {
        return this.state;
    }
    
    // 获取表现型
    getPhenotype(): Phenotype {
        return this.phenotype;
    }
    
    // 获取当前行动描述
    getActionDescription(): string {
        if (!this.currentAction) return '闲置';
        
        const descriptions: Record<ActionType, string> = {
            [ActionType.FIND_FOOD]: '寻找食物',
            [ActionType.HUNT]: '狩猎中',
            [ActionType.GATHER]: '采集中',
            [ActionType.EAT]: '进食中',
            [ActionType.FIND_WATER]: '寻找水源',
            [ActionType.DRINK]: '饮水中',
            [ActionType.REST]: '休息中',
            [ActionType.SLEEP]: '睡眠中',
            [ActionType.FLEE]: '逃跑中',
            [ActionType.HIDE]: '躲藏中',
            [ActionType.DEFEND]: '防御中',
            [ActionType.ATTACK]: '攻击中',
            [ActionType.SOCIALIZE]: '社交中',
            [ActionType.COMMUNICATE]: '交流中',
            [ActionType.TRADE]: '交易中',
            [ActionType.MATE]: '繁殖中',
            [ActionType.CARE_OFFSPRING]: '照顾后代',
            [ActionType.EXPLORE]: '探索中',
            [ActionType.INVESTIGATE]: '调查中',
            [ActionType.LEARN]: '学习中',
            [ActionType.BUILD]: '建造中',
            [ActionType.CRAFT]: '制作中',
            [ActionType.GATHER_MATERIALS]: '收集材料'
        };
        
        return descriptions[this.currentAction] || '行动中';
    }
}

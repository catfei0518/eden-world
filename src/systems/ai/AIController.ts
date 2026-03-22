/**
 * AI决策系统
 * 
 * 基于DNA性格和当前需求做决策
 */

import { Phenotype, DynamicNeeds } from '../dna/DNA';
import { WorldState, IndividualState, NeedsCalculator } from '../needs/NeedsCalculator';

/**
 * 行为类型
 */
export enum ActionType {
    // 觅食
    FIND_FOOD = 'find_food',
    HUNT = 'hunt',
    GATHER = 'gather',
    EAT = 'eat',
    
    // 饮水
    FIND_WATER = 'find_water',
    DRINK = 'drink',
    
    // 休息
    REST = 'rest',
    SLEEP = 'sleep',
    
    // 安全
    FLEE = 'flee',
    HIDE = 'hide',
    DEFEND = 'defend',
    ATTACK = 'attack',
    
    // 社交
    SOCIALIZE = 'socialize',
    COMMUNICATE = 'communicate',
    TRADE = 'trade',
    MATE = 'mate',
    CARE_OFFSPRING = 'care_offspring',
    
    // 探索
    EXPLORE = 'explore',
    INVESTIGATE = 'investigate',
    LEARN = 'learn',
    
    // 建造
    BUILD = 'build',
    CRAFT = 'craft',
    GATHER_MATERIALS = 'gather_materials',
}

/**
 * 行为效果
 */
export interface ActionEffects {
    // 满足的需求
    satisfies: string[];
    
    // 满足量
    foodValue: number;
    waterValue: number;
    energyValue: number;
    safetyValue: number;
    socialValue: number;
    curiosityValue: number;
    reproductionValue: number;
    
    // 消耗
    energyCost: number;
    foodCost: number;
    waterCost: number;
    
    // 风险
    risky: boolean;
    
    // 探索性
    exploration: boolean;
    
    // 社交性
    social: boolean;
    
    // 持续时间（秒）
    duration: number;
}

/**
 * 行为评分
 */
export interface ActionScore {
    action: ActionType;
    totalScore: number;
    needSatisfaction: number;
    dnaAlignment: number;
    riskAssessment: number;
    energyEfficiency: number;
}

/**
 * 行为效果表
 */
const ACTION_EFFECTS: Record<ActionType, ActionEffects> = {
    [ActionType.FIND_FOOD]: {
        satisfies: ['hunger'],
        foodValue: 0.5, waterValue: 0, energyValue: 0,
        safetyValue: 0, socialValue: 0, curiosityValue: 0.2, reproductionValue: 0,
        energyCost: 0.2, foodCost: 0, waterCost: 0,
        risky: false, exploration: true, social: false,
        duration: 30
    },
    
    [ActionType.HUNT]: {
        satisfies: ['hunger'],
        foodValue: 0.8, waterValue: 0, energyValue: 0,
        safetyValue: 0, socialValue: 0, curiosityValue: 0.1, reproductionValue: 0,
        energyCost: 0.4, foodCost: 0, waterCost: 0,
        risky: true, exploration: false, social: false,
        duration: 60
    },
    
    [ActionType.GATHER]: {
        satisfies: ['hunger'],
        foodValue: 0.4, waterValue: 0, energyValue: 0,
        safetyValue: 0, socialValue: 0, curiosityValue: 0.1, reproductionValue: 0,
        energyCost: 0.15, foodCost: 0, waterCost: 0,
        risky: false, exploration: false, social: false,
        duration: 20
    },
    
    [ActionType.EAT]: {
        satisfies: ['hunger'],
        foodValue: 0.9, waterValue: 0.1, energyValue: 0.1,
        safetyValue: 0, socialValue: 0, curiosityValue: 0, reproductionValue: 0,
        energyCost: 0, foodCost: 1, waterCost: 0,
        risky: false, exploration: false, social: false,
        duration: 5
    },
    
    [ActionType.FIND_WATER]: {
        satisfies: ['thirst'],
        foodValue: 0, waterValue: 0.4, energyValue: 0,
        safetyValue: 0, socialValue: 0, curiosityValue: 0.2, reproductionValue: 0,
        energyCost: 0.15, foodCost: 0, waterCost: 0,
        risky: false, exploration: true, social: false,
        duration: 25
    },
    
    [ActionType.DRINK]: {
        satisfies: ['thirst'],
        foodValue: 0, waterValue: 0.95, energyValue: 0,
        safetyValue: 0, socialValue: 0, curiosityValue: 0, reproductionValue: 0,
        energyCost: 0, foodCost: 0, waterCost: 0.5,
        risky: false, exploration: false, social: false,
        duration: 3
    },
    
    [ActionType.REST]: {
        satisfies: ['energy'],
        foodValue: 0, waterValue: 0, energyValue: 0.6,
        safetyValue: 0.2, socialValue: 0, curiosityValue: 0, reproductionValue: 0,
        energyCost: 0, foodCost: 0, waterCost: 0.1,
        risky: false, exploration: false, social: false,
        duration: 30
    },
    
    [ActionType.SLEEP]: {
        satisfies: ['energy'],
        foodValue: 0, waterValue: 0, energyValue: 0.95,
        safetyValue: 0.3, socialValue: 0, curiosityValue: 0, reproductionValue: 0,
        energyCost: 0, foodCost: 0.2, waterCost: 0.2,
        risky: false, exploration: false, social: false,
        duration: 120
    },
    
    [ActionType.FLEE]: {
        satisfies: ['safety'],
        foodValue: 0, waterValue: 0, energyValue: 0,
        safetyValue: 0.9, socialValue: 0, curiosityValue: 0, reproductionValue: 0,
        energyCost: 0.35, foodCost: 0, waterCost: 0,
        risky: true, exploration: false, social: false,
        duration: 10
    },
    
    [ActionType.HIDE]: {
        satisfies: ['safety'],
        foodValue: 0, waterValue: 0, energyValue: 0.1,
        safetyValue: 0.7, socialValue: 0, curiosityValue: 0, reproductionValue: 0,
        energyCost: 0.05, foodCost: 0, waterCost: 0,
        risky: false, exploration: false, social: false,
        duration: 20
    },
    
    [ActionType.DEFEND]: {
        satisfies: ['safety'],
        foodValue: 0, waterValue: 0, energyValue: 0,
        safetyValue: 0.6, socialValue: 0.1, curiosityValue: 0, reproductionValue: 0,
        energyCost: 0.3, foodCost: 0, waterCost: 0,
        risky: true, exploration: false, social: false,
        duration: 15
    },
    
    [ActionType.ATTACK]: {
        satisfies: ['safety'],
        foodValue: 0, waterValue: 0, energyValue: 0,
        safetyValue: 0.5, socialValue: -0.2, curiosityValue: 0, reproductionValue: 0,
        energyCost: 0.4, foodCost: 0, waterCost: 0,
        risky: true, exploration: false, social: false,
        duration: 10
    },
    
    [ActionType.SOCIALIZE]: {
        satisfies: ['social'],
        foodValue: 0, waterValue: 0, energyValue: 0,
        safetyValue: 0.1, socialValue: 0.8, curiosityValue: 0.1, reproductionValue: 0.1,
        energyCost: 0.05, foodCost: 0, waterCost: 0,
        risky: false, exploration: false, social: true,
        duration: 60
    },
    
    [ActionType.COMMUNICATE]: {
        satisfies: ['social', 'curiosity'],
        foodValue: 0, waterValue: 0, energyValue: 0,
        safetyValue: 0.05, socialValue: 0.5, curiosityValue: 0.3, reproductionValue: 0,
        energyCost: 0.02, foodCost: 0, waterCost: 0,
        risky: false, exploration: false, social: true,
        duration: 30
    },
    
    [ActionType.EXPLORE]: {
        satisfies: ['curiosity'],
        foodValue: 0.1, waterValue: 0.05, energyValue: 0,
        safetyValue: -0.2, socialValue: 0, curiosityValue: 0.7, reproductionValue: 0,
        energyCost: 0.25, foodCost: 0, waterCost: 0,
        risky: true, exploration: true, social: false,
        duration: 120
    },
    
    [ActionType.MATE]: {
        satisfies: ['reproduction', 'social'],
        foodValue: 0, waterValue: 0, energyValue: 0,
        safetyValue: 0, socialValue: 0.3, curiosityValue: 0, reproductionValue: 0.9,
        energyCost: 0.2, foodCost: 0, waterCost: 0,
        risky: false, exploration: false, social: true,
        duration: 30
    },
    
    [ActionType.BUILD]: {
        satisfies: [],
        foodValue: 0, waterValue: 0, energyValue: 0,
        safetyValue: 0.3, socialValue: 0.1, curiosityValue: 0.2, reproductionValue: 0,
        energyCost: 0.3, foodCost: 0, waterCost: 0,
        risky: false, exploration: false, social: true,
        duration: 180
    },
};

/**
 * AI控制器
 */
export class AIController {
    private personality: PersonalityWeights;
    
    constructor(dna: Phenotype) {
        this.personality = this.derivePersonality(dna);
    }
    
    /**
     * 从DNA派生性格权重
     */
    private derivePersonality(dna: Phenotype): PersonalityWeights {
        return {
            // 需求权重
            hungerWeight: 0.8 + (1 - dna.hungerSensitivity) * 0.2,
            thirstWeight: 0.8 + (1 - dna.thirstSensitivity) * 0.2,
            energyWeight: 0.6,
            safetyWeight: 0.7 + dna.fearResponse * 0.3,
            socialWeight: 0.4 + dna.socialNeed * 0.4,
            curiosityWeight: 0.3 + dna.curiosity * 0.4,
            reproductionWeight: 0.2 + dna.fertility * 0.3,
            
            // 性格修正
            braveryModifier: dna.bravery,
            aggressionModifier: dna.aggression,
            empathyModifier: dna.empathy,
            curiosityModifier: dna.curiosity,
            
            // 风险承受
            riskTolerance: dna.bravery * (1 - dna.riskAversion),
            
            // 代谢影响
            metabolismRate: dna.metabolism
        };
    }
    
    /**
     * 决定下一步行动
     */
    decideAction(
        needs: DynamicNeeds,
        individual: IndividualState,
        worldState: WorldState
    ): ActionType {
        // 获取所有可用行动
        const availableActions = this.getAvailableActions(individual, worldState);
        
        // 评分所有行动
        const scoredActions = availableActions.map(action => 
            this.scoreAction(action, needs, worldState)
        );
        
        // 使用softmax选择（加入随机性）
        return this.softmaxSelect(scoredActions);
    }
    
    /**
     * 获取可用行动
     */
    private getAvailableActions(
        individual: IndividualState,
        worldState: WorldState
    ): ActionType[] {
        const actions: ActionType[] = [];
        
        // 总是可用的基础行动
        actions.push(ActionType.REST);
        actions.push(ActionType.SLEEP);
        
        // 附近有食物/水
        if (worldState.nearbyFood.length > 0) {
            actions.push(ActionType.GATHER);
            actions.push(ActionType.EAT);
        }
        
        if (worldState.nearbyWater.length > 0) {
            actions.push(ActionType.DRINK);
        }
        
        // 有威胁
        if (worldState.threats.length > 0) {
            actions.push(ActionType.FLEE);
            actions.push(ActionType.HIDE);
            
            // 高攻击性可能选择战斗
            if (this.personality.aggressionModifier > 0.6) {
                actions.push(ActionType.ATTACK);
            }
        }
        
        // 附近有人
        if (worldState.nearbyIndividuals > 0) {
            actions.push(ActionType.SOCIALIZE);
            actions.push(ActionType.COMMUNICATE);
            
            // 有繁殖需求且有伴侣
            if (needs.reproduction > 0.5 && individual.sex === 'female') {
                actions.push(ActionType.MATE);
            }
        }
        
        // 高好奇心者会探索
        if (this.personality.curiosityModifier > 0.5) {
            actions.push(ActionType.EXPLORE);
            actions.push(ActionType.INVESTIGATE);
        }
        
        // 可以寻找食物/水
        actions.push(ActionType.FIND_FOOD);
        actions.push(ActionType.FIND_WATER);
        
        // 可以建造
        if (this.personality.intelligence > 50) {
            actions.push(ActionType.BUILD);
        }
        
        return [...new Set(actions)]; // 去重
    }
    
    /**
     * 评分单个行动
     */
    private scoreAction(
        action: ActionType,
        needs: DynamicNeeds,
        worldState: WorldState
    ): ActionScore {
        const effects = ACTION_EFFECTS[action];
        
        // 1. 需求满足度 (40%)
        const needSatisfaction = this.calculateNeedSatisfaction(action, needs);
        
        // 2. DNA性格契合度 (25%)
        const dnaAlignment = this.calculateDNAAlignment(action);
        
        // 3. 风险评估 (20%)
        const riskAssessment = this.assessRisk(action, worldState);
        
        // 4. 能量效率 (15%)
        const energyEfficiency = 1 - effects.energyCost;
        
        // 综合评分
        const totalScore = 
            needSatisfaction * 0.4 +
            dnaAlignment * 0.25 +
            riskAssessment * 0.2 +
            energyEfficiency * 0.15;
        
        return {
            action,
            totalScore,
            needSatisfaction,
            dnaAlignment,
            riskAssessment,
            energyEfficiency
        };
    }
    
    /**
     * 计算需求满足度
     */
    private calculateNeedSatisfaction(action: ActionType, needs: DynamicNeeds): number {
        const effects = ACTION_EFFECTS[action];
        let score = 0;
        
        // 每个行动满足特定需求
        for (const need of effects.satisfies) {
            const needValue = (needs as any)[need] || 0;
            const effectValue = (effects as any)[`${need}Value`] || 0;
            score += needValue * effectValue;
        }
        
        // 没有满足任何需求的行动得分很低
        if (effects.satisfies.length === 0) {
            score = 0.1;
        }
        
        return Math.min(1, Math.max(0, score));
    }
    
    /**
     * 计算DNA性格契合度
     */
    private calculateDNAAlignment(action: ActionType): number {
        const effects = ACTION_EFFECTS[action];
        let score = 0.5; // 基础分
        
        // 探索性行动与好奇心契合
        if (effects.exploration) {
            score += this.personality.curiosityModifier * 0.3;
        }
        
        // 社交行动与社交需求契合
        if (effects.social) {
            score += this.personality.empathyModifier * 0.2;
        }
        
        // 冒险行动与勇敢度契合
        if (effects.risky) {
            score += (this.personality.braveryModifier - 0.5) * 0.3;
        }
        
        // 攻击行动与攻击性契合
        if (action === ActionType.ATTACK || action === ActionType.DEFEND) {
            score += (this.personality.aggressionModifier - 0.5) * 0.3;
        }
        
        return Math.min(1, Math.max(0, score));
    }
    
    /**
     * 风险评估
     */
    private assessRisk(action: ActionType, worldState: WorldState): number {
        const effects = ACTION_EFFECTS[action];
        
        if (!effects.risky) return 0.9;
        
        // 夜晚风险更高
        if (worldState.isNight) {
            return 0.3 * this.personality.riskTolerance;
        }
        
        // 有威胁时风险更高
        if (worldState.threats.length > 0) {
            return 0.4 * this.personality.riskTolerance;
        }
        
        return 0.6 * this.personality.riskTolerance;
    }
    
    /**
     * Softmax选择（带随机性）
     */
    private softmaxSelect(scoredActions: ActionScore[]): ActionType {
        const temperature = 0.5; // 随机性温度
        const expScores = scoredActions.map(s => 
            Math.exp(s.totalScore / temperature)
        );
        const sum = expScores.reduce((a, b) => a + b, 0);
        
        let random = Math.random() * sum;
        for (const scored of scoredActions) {
            random -= Math.exp(scored.totalScore / temperature);
            if (random <= 0) return scored.action;
        }
        
        return scoredActions[0].action;
    }
    
    /**
     * 获取最高分的行动（贪心）
     */
    getGreedyAction(
        needs: DynamicNeeds,
        individual: IndividualState,
        worldState: WorldState
    ): ActionType {
        const availableActions = this.getAvailableActions(individual, worldState);
        const scoredActions = availableActions.map(action => 
            this.scoreAction(action, needs, worldState)
        );
        
        scoredActions.sort((a, b) => b.totalScore - a.totalScore);
        
        return scoredActions[0].action;
    }
}

/**
 * 性格权重
 */
interface PersonalityWeights {
    // 需求权重
    hungerWeight: number;
    thirstWeight: number;
    energyWeight: number;
    safetyWeight: number;
    socialWeight: number;
    curiosityWeight: number;
    reproductionWeight: number;
    
    // 性格修正
    braveryModifier: number;
    aggressionModifier: number;
    empathyModifier: number;
    curiosityModifier: number;
    
    // 风险承受
    riskTolerance: number;
    
    // 代谢
    metabolismRate: number;
}

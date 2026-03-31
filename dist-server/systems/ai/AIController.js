"use strict";
/**
 * AI决策系统
 *
 * 基于DNA性格和当前需求做决策
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIController = exports.ActionType = void 0;
/**
 * 行为类型
 */
var ActionType;
(function (ActionType) {
    // 觅食
    ActionType["FIND_FOOD"] = "find_food";
    ActionType["HUNT"] = "hunt";
    ActionType["GATHER"] = "gather";
    ActionType["EAT"] = "eat";
    // 饮水
    ActionType["FIND_WATER"] = "find_water";
    ActionType["DRINK"] = "drink";
    // 休息
    ActionType["REST"] = "rest";
    ActionType["SLEEP"] = "sleep";
    // 安全
    ActionType["FLEE"] = "flee";
    ActionType["HIDE"] = "hide";
    ActionType["DEFEND"] = "defend";
    ActionType["ATTACK"] = "attack";
    // 社交
    ActionType["SOCIALIZE"] = "socialize";
    ActionType["COMMUNICATE"] = "communicate";
    ActionType["TRADE"] = "trade";
    ActionType["MATE"] = "mate";
    ActionType["CARE_OFFSPRING"] = "care_offspring";
    // 探索
    ActionType["EXPLORE"] = "explore";
    ActionType["INVESTIGATE"] = "investigate";
    ActionType["LEARN"] = "learn";
    // 建造
    ActionType["BUILD"] = "build";
    ActionType["CRAFT"] = "craft";
    ActionType["GATHER_MATERIALS"] = "gather_materials";
})(ActionType || (exports.ActionType = ActionType = {}));
/**
 * 行为效果表
 */
const ACTION_EFFECTS = {
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
    [ActionType.CRAFT]: {
        satisfies: ['curiosity'],
        foodValue: 0, waterValue: 0, energyValue: 0,
        safetyValue: 0.1, socialValue: 0, curiosityValue: 0.3, reproductionValue: 0,
        energyCost: 0.25, foodCost: 0, waterCost: 0,
        risky: false, exploration: false, social: false,
        duration: 90
    },
    [ActionType.GATHER_MATERIALS]: {
        satisfies: ['curiosity'],
        foodValue: 0.1, waterValue: 0, energyValue: 0,
        safetyValue: 0, socialValue: 0, curiosityValue: 0.2, reproductionValue: 0,
        energyCost: 0.15, foodCost: 0, waterCost: 0,
        risky: false, exploration: true, social: false,
        duration: 45
    },
    [ActionType.TRADE]: {
        satisfies: ['social'],
        foodValue: 0, waterValue: 0, energyValue: 0,
        safetyValue: 0.1, socialValue: 0.7, curiosityValue: 0.1, reproductionValue: 0,
        energyCost: 0.05, foodCost: 0, waterCost: 0,
        risky: false, exploration: false, social: true,
        duration: 30
    },
    [ActionType.CARE_OFFSPRING]: {
        satisfies: ['social', 'reproduction'],
        foodValue: 0, waterValue: 0, energyValue: -0.1,
        safetyValue: 0.3, socialValue: 0.6, curiosityValue: 0, reproductionValue: 0.5,
        energyCost: 0.15, foodCost: 0, waterCost: 0,
        risky: false, exploration: false, social: true,
        duration: 60
    },
    [ActionType.INVESTIGATE]: {
        satisfies: ['curiosity'],
        foodValue: 0, waterValue: 0, energyValue: 0,
        safetyValue: -0.1, socialValue: 0, curiosityValue: 0.8, reproductionValue: 0,
        energyCost: 0.2, foodCost: 0, waterCost: 0,
        risky: true, exploration: true, social: false,
        duration: 40
    },
    [ActionType.LEARN]: {
        satisfies: ['curiosity'],
        foodValue: 0, waterValue: 0, energyValue: 0,
        safetyValue: 0, socialValue: 0.2, curiosityValue: 0.9, reproductionValue: 0,
        energyCost: 0.1, foodCost: 0, waterCost: 0,
        risky: false, exploration: false, social: false,
        duration: 120
    },
};
/**
 * AI控制器
 */
class AIController {
    constructor(dna) {
        this.personality = this.derivePersonality(dna);
    }
    /**
     * 从DNA派生性格权重
     */
    derivePersonality(dna) {
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
            metabolismRate: dna.metabolism,
            // 智力
            intelligence: dna.intelligence
        };
    }
    /**
     * 决定下一步行动
     */
    decideAction(needs, individual, worldState) {
        // 获取所有可用行动
        const availableActions = this.getAvailableActions(individual, worldState, needs);
        // 评分所有行动
        const scoredActions = availableActions.map(action => this.scoreAction(action, needs, worldState));
        // 使用softmax选择（加入随机性）
        return this.softmaxSelect(scoredActions);
    }
    /**
     * 获取可用行动
     */
    getAvailableActions(individual, worldState, needs) {
        const actions = [];
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
        // 可以建造（智力高于0.5）
        if (this.personality.intelligence > 0.5) {
            actions.push(ActionType.BUILD);
        }
        return [...new Set(actions)]; // 去重
    }
    /**
     * 评分单个行动
     */
    scoreAction(action, needs, worldState) {
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
        const totalScore = needSatisfaction * 0.4 +
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
    calculateNeedSatisfaction(action, needs) {
        const effects = ACTION_EFFECTS[action];
        let score = 0;
        // 每个行动满足特定需求
        for (const need of effects.satisfies) {
            const needValue = needs[need] || 0;
            const effectValue = effects[`${need}Value`] || 0;
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
    calculateDNAAlignment(action) {
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
    assessRisk(action, worldState) {
        const effects = ACTION_EFFECTS[action];
        if (!effects.risky)
            return 0.9;
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
    softmaxSelect(scoredActions) {
        const temperature = 0.5; // 随机性温度
        const expScores = scoredActions.map(s => Math.exp(s.totalScore / temperature));
        const sum = expScores.reduce((a, b) => a + b, 0);
        let random = Math.random() * sum;
        for (const scored of scoredActions) {
            random -= Math.exp(scored.totalScore / temperature);
            if (random <= 0)
                return scored.action;
        }
        return scoredActions[0].action;
    }
    /**
     * 获取最高分的行动（贪心）
     */
    getGreedyAction(needs, individual, worldState) {
        const availableActions = this.getAvailableActions(individual, worldState, needs);
        const scoredActions = availableActions.map(action => this.scoreAction(action, needs, worldState));
        scoredActions.sort((a, b) => b.totalScore - a.totalScore);
        return scoredActions[0].action;
    }
}
exports.AIController = AIController;

/**
 * 需求计算器
 * 
 * 计算角色的动态需求值
 * 基于DNA阈值和当前状态
 */

import { DNA, Phenotype, DynamicNeeds } from '../dna/DNA';

export interface IndividualState {
    // 资源状态
    storedFood: number;      // 储存食物
    storedWater: number;     // 储存水
    health: number;          // 健康 0-1
    
    // 时间追踪
    lastMealTime: number;    // 上次进食时间
    lastDrinkTime: number;   // 上次饮水时间
    lastRestTime: number;    // 上次休息时间
    lastSocialTime: number;  // 上次社交时间
    
    // 当前位置
    position: { x: number; y: number };
    
    // 年龄（秒）
    age: number;
    
    // 性别
    sex: 'male' | 'female';
    
    // 是否独处
    aloneTime: number;
}

export interface WorldState {
    time: number;                    // 世界时间
    threats: Threat[];              // 附近威胁
    nearbyFood: Resource[];         // 附近食物
    nearbyWater: Resource[];        // 附近水源
    nearbyIndividuals: number;       // 附近人数
    temperature: number;           // 温度
    isNight: boolean;              // 是否夜晚
}

export interface Threat {
    type: 'predator' | 'hostile' | 'disaster';
    distance: number;
    dangerLevel: number;
}

export interface Resource {
    type: string;
    distance: number;
    quantity: number;
}

/**
 * 需求计算器
 */
export class NeedsCalculator {
    /**
     * 计算所有动态需求
     */
    calculate(
        individual: IndividualState,
        worldState: WorldState,
        dna: Phenotype
    ): DynamicNeeds {
        return {
            hunger: this.calculateHunger(individual, dna),
            thirst: this.calculateThirst(individual, dna),
            energy: this.calculateEnergy(individual, worldState, dna),
            safety: this.calculateSafety(individual, worldState, dna),
            social: this.calculateSocial(individual, worldState, dna),
            curiosity: this.calculateCuriosity(individual, worldState, dna),
            reproduction: this.calculateReproduction(individual, worldState, dna)
        };
    }
    
    /**
     * 饥饿需求
     */
    private calculateHunger(individual: IndividualState, dna: Phenotype): number {
        const timeSinceMeal = Math.max(0, individual.lastMealTime);
        const metabolism = dna.metabolism;
        
        // 基础饥饿（随时间增长）
        const baseHunger = Math.min(1, timeSinceMeal / 600 * metabolism);
        
        // 食物储存缓冲
        const foodBuffer = individual.storedFood / 10;
        const bufferedHunger = Math.max(0, baseHunger - foodBuffer * 0.1);
        
        // 敏感度修正
        const sensitivity = dna.hungerSensitivity;
        const threshold = dna.hungerThreshold;
        
        // 最终饥饿值
        const hunger = Math.min(1, bufferedHunger * sensitivity);
        
        // 低于阈值时快速上升
        if (hunger < threshold) {
            return hunger / threshold * 0.3;
        }
        
        return hunger;
    }
    
    /**
     * 口渴需求
     */
    private calculateThirst(individual: IndividualState, dna: Phenotype): number {
        const timeSinceDrink = Math.max(0, individual.lastDrinkTime);
        const metabolism = dna.metabolism;
        
        // 口渴增长更快（比饥饿）
        const baseThirst = Math.min(1, timeSinceDrink / 300 * metabolism);
        
        // 水储存缓冲
        const waterBuffer = individual.storedWater / 10;
        const bufferedThirst = Math.max(0, baseThirst - waterBuffer * 0.15);
        
        // 敏感度修正
        const sensitivity = dna.thirstSensitivity;
        
        return Math.min(1, bufferedThirst * sensitivity);
    }
    
    /**
     * 精力需求
     */
    private calculateEnergy(
        individual: IndividualState,
        worldState: WorldState,
        dna: Phenotype
    ): number {
        const timeSinceRest = Math.max(0, individual.lastRestTime);
        
        // 精力随时间下降
        let energyDrain = timeSinceRest / 900; // 15分钟耗尽
        
        // 夜晚消耗更快
        if (worldState.isNight) {
            energyDrain *= 1.2;
        }
        
        // 体质修正
        const constitution = dna.constitution;
        energyDrain *= (1.5 - constitution / 100);
        
        return Math.min(1, energyDrain);
    }
    
    /**
     * 安全需求
     */
    private calculateSafety(
        individual: IndividualState,
        worldState: WorldState,
        dna: Phenotype
    ): number {
        let safetyScore = 1.0;
        
        // 威胁距离
        for (const threat of worldState.threats) {
            if (threat.distance < 50) {
                safetyScore *= 0.3;
            } else if (threat.distance < 100) {
                safetyScore *= 0.6;
            } else if (threat.distance < 200) {
                safetyScore *= 0.8;
            }
        }
        
        // 夜晚更危险
        if (worldState.isNight) {
            safetyScore *= 0.7;
        }
        
        // 恐惧反应修正
        const fearResponse = dna.fearResponse;
        const riskAversion = dna.riskAversion;
        
        // 高恐惧反应者更容易感到不安全
        safetyScore *= (1.5 - fearResponse * 0.5);
        
        return Math.max(0, Math.min(1, 1 - safetyScore));
    }
    
    /**
     * 社交需求
     */
    private calculateSocial(
        individual: IndividualState,
        worldState: WorldState,
        dna: Phenotype
    ): number {
        const aloneTime = individual.aloneTime;
        const socialNeed = dna.socialNeed;
        
        // 社交需求随独处时间增长
        const baseSocial = Math.min(1, aloneTime / 600 * socialNeed);
        
        // 附近有人时需求降低
        if (worldState.nearbyIndividuals > 0) {
            const nearbyReduction = Math.min(0.5, worldState.nearbyIndividuals * 0.1);
            return Math.max(0, baseSocial - nearbyReduction);
        }
        
        return baseSocial;
    }
    
    /**
     * 好奇心需求
     */
    private calculateCuriosity(
        individual: IndividualState,
        worldState: WorldState,
        dna: Phenotype
    ): number {
        const curiosity = dna.curiosity;
        
        // 基础好奇心
        let curiosityScore = curiosity * 0.3;
        
        // 在熟悉区域降低，新区域提高
        // （这里简化处理）
        curiosityScore += Math.random() * 0.2;
        
        return Math.min(1, curiosityScore);
    }
    
    /**
     * 繁殖需求
     */
    private calculateReproduction(
        individual: IndividualState,
        worldState: WorldState,
        dna: Phenotype
    ): number {
        // 繁殖需求随年龄变化
        const fertileAge = individual.age > 60 && individual.age < 600; // 1分钟到10分钟
        const fertility = dna.fertility;
        
        if (!fertileAge) return 0;
        
        // 基础繁殖欲望
        let reproductionScore = fertility * 0.2;
        
        // 有潜在伴侣时提高
        if (worldState.nearbyIndividuals > 0) {
            reproductionScore += 0.3;
        }
        
        // 独处太久时降低（优先满足社交）
        if (individual.aloneTime > 300) {
            reproductionScore *= 0.5;
        }
        
        return Math.min(1, reproductionScore);
    }
    
    /**
     * 获取最高需求
     */
    getDominantNeed(needs: DynamicNeeds): string {
        const entries = Object.entries(needs);
        let maxNeed = { name: 'hunger', value: 0 };
        
        for (const [name, value] of entries) {
            if (value > maxNeed.value) {
                maxNeed = { name, value };
            }
        }
        
        return maxNeed.name;
    }
    
    /**
     * 获取需求描述
     */
    static getNeedDescription(needName: string): string {
        const descriptions: Record<string, string> = {
            hunger: '饥饿',
            thirst: '口渴',
            energy: '疲惫',
            safety: '安全感',
            social: '孤独',
            curiosity: '好奇心',
            reproduction: '繁殖'
        };
        return descriptions[needName] || needName;
    }
}

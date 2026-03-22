/**
 * DNA系统 - 完整染色体模拟
 * 
 * 基于真实人类遗传学：
 * - 23对染色体
 * - 基因座精确定位
 * - 显性/隐性表达
 * - 突变机制
 */

import { Chromosome, Gene, Allele, GeneLocus, Dominance, Mutation, EpigeneticMark } from './Chromosome';

/**
 * DNA完整结构
 */
export interface DNAData {
    // 23对染色体（46条）
    chromosomes: Chromosome[];
    
    // 性染色体类型
    sexChromosome: 'XX' | 'XY';
    
    // 表现型（由基因型计算得出）
    phenotype: Phenotype;
    
    // 父母ID
    fatherId?: string;
    motherId?: string;
    
    // 突变历史
    mutations: Mutation[];
    
    // 表观遗传标记
    epigeneticMarks: EpigeneticMark[];
    
    // 世代数
    generation: number;
}

/**
 * 表现型（外观+属性）
 */
export interface Phenotype {
    // === 体质属性（0-100）===
    strength: number;       // 力量
    agility: number;       // 敏捷
    intelligence: number;   // 智力
    perception: number;    // 感知
    constitution: number;  // 体质
    endurance: number;     // 耐力
    
    // === 性格属性（0-1）===
    bravery: number;       // 勇敢度
    curiosity: number;     // 好奇心
    aggression: number;    // 攻击性
    empathy: number;       // 同理心
    sociability: number;  // 社交能力
    patience: number;     // 耐心
    
    // === 需求相关DNA属性 ===
    hungerThreshold: number;      // 饥饿阈值
    hungerSensitivity: number;    // 饥饿敏感度
    thirstThreshold: number;      // 口渴阈值
    thirstSensitivity: number;    // 口渴敏感度
    fearResponse: number;        // 恐惧反应
    riskAversion: number;        // 风险规避
    socialNeed: number;          // 社交需求
    selfInterest: number;        // 自我利益倾向
    altruismTendency: number;    // 利他倾向
    
    // === 生理参数 ===
    metabolism: number;          // 代谢速度 (0.5-2.0)
    lifespan: number;            // 寿命（秒）
    fertility: number;           // 生育力 (0-1)
    immuneStrength: number;      // 免疫力 (0-1)
    
    // === 外观 ===
    skinTone: number;          // 肤色 0-1
    height: number;            // 身高 0.7-1.3
    hairColor: number;         // 发色 0-1
    eyeColor: number;          // 眼睛颜色 0-1
}

/**
 * DNA类 - 管理完整遗传信息
 */
export class DNA {
    private data: DNAData;
    
    constructor(data: DNAData) {
        this.data = data;
    }
    
    /**
     * 创建初始DNA（亚当和夏娃）
     */
    static createInitial(): DNA {
        const chromosomes: Chromosome[] = [];
        
        // 创建23对染色体
        for (let i = 1; i <= 23; i++) {
            chromosomes.push(new Chromosome(i));
        }
        
        const phenotype = DNA.expressPhenotype(chromosomes);
        
        return new DNA({
            chromosomes,
            sexChromosome: Math.random() > 0.5 ? 'XX' : 'XY',
            phenotype,
            mutations: [],
            epigeneticMarks: [],
            generation: 1
        });
    }
    
    /**
     * 从父母创建子代DNA
     */
    static inherit(mother: DNA, father: DNA): DNA {
        const childChromosomes: Chromosome[] = [];
        
        // 23对染色体
        for (let i = 0; i < 23; i++) {
            const maternalChromosome = mother.data.chromosomes[i];
            const paternalChromosome = father.data.chromosomes[i];
            
            // 减数分裂：每对随机选一条
            const maternalGamete = maternalChromosome.meiosis();
            const paternalGamete = paternalChromosome.meiosis();
            
            // 受精：组合成新的染色体对
            const childChromosome = Chromosome.combine(maternalGamete, paternalGamete, i + 1);
            childChromosomes.push(childChromosome);
        }
        
        // 性染色体
        const sexChromosome = DNA.determineSex(mother, father);
        
        const phenotype = DNA.expressPhenotype(childChromosomes);
        
        return new DNA({
            chromosomes: childChromosomes,
            sexChromosome,
            phenotype,
            fatherId: father.getId(),
            motherId: mother.getId(),
            mutations: [],
            epigeneticMarks: [],
            generation: Math.max(mother.data.generation, father.data.generation) + 1
        });
    }
    
    /**
     * 确定性别
     */
    private static determineSex(mother: DNA, father: DNA): 'XX' | 'XY' {
        // 母亲总是提供X
        // 父亲提供X或Y
        return Math.random() > 0.5 ? 'XX' : 'XY';
    }
    
    /**
     * 从基因型表达表现型
     */
    private static expressPhenotype(chromosomes: Chromosome[]): Phenotype {
        // 简化：从染色体中提取基因值并计算表现型
        // 真实实现需要更复杂的基因表达网络
        
        const geneValues = chromosomes.map(c => c.getGeneValues());
        
        return {
            // 体质属性（从多个基因取平均）
            strength: DNA.average(geneValues, 'strength'),
            agility: DNA.average(geneValues, 'agility'),
            intelligence: DNA.average(geneValues, 'intelligence'),
            perception: DNA.average(geneValues, 'perception'),
            constitution: DNA.average(geneValues, 'constitution'),
            endurance: DNA.average(geneValues, 'endurance'),
            
            // 性格
            bravery: DNA.average(geneValues, 'bravery'),
            curiosity: DNA.average(geneValues, 'curiosity'),
            aggression: DNA.average(geneValues, 'aggression'),
            empathy: DNA.average(geneValues, 'empathy'),
            sociability: DNA.average(geneValues, 'sociability'),
            patience: DNA.average(geneValues, 'patience'),
            
            // 需求相关
            hungerThreshold: 0.3,
            hungerSensitivity: DNA.average(geneValues, 'sensitivity'),
            thirstThreshold: 0.3,
            thirstSensitivity: DNA.average(geneValues, 'sensitivity'),
            fearResponse: DNA.average(geneValues, 'fearResponse'),
            riskAversion: DNA.average(geneValues, 'riskAversion'),
            socialNeed: DNA.average(geneValues, 'socialNeed'),
            selfInterest: DNA.average(geneValues, 'selfInterest'),
            altruismTendency: DNA.average(geneValues, 'altruism'),
            
            // 生理
            metabolism: 0.8 + DNA.average(geneValues, 'metabolism') * 1.2,
            lifespan: 600 + DNA.average(geneValues, 'lifespan') * 600,
            fertility: DNA.average(geneValues, 'fertility'),
            immuneStrength: DNA.average(geneValues, 'immunity'),
            
            // 外观
            skinTone: DNA.average(geneValues, 'skinTone'),
            height: 0.9 + DNA.average(geneValues, 'height') * 0.4,
            hairColor: DNA.average(geneValues, 'hairColor'),
            eyeColor: DNA.average(geneValues, 'eyeColor'),
        };
    }
    
    /**
     * 计算平均值
     */
    private static average(values: any[], trait: string): number {
        const relevant = values.filter(v => v[trait] !== undefined);
        if (relevant.length === 0) return 0.5;
        const sum = relevant.reduce((acc, v) => acc + v[trait], 0);
        return Math.max(0, Math.min(1, sum / relevant.length));
    }
    
    // Getter方法
    getData(): DNAData { return this.data; }
    getPhenotype(): Phenotype { return this.data.phenotype; }
    getChromosomes(): Chromosome[] { return this.data.chromosomes; }
    getSex(): 'XX' | 'XY' { return this.data.sexChromosome; }
    getGeneration(): number { return this.data.generation; }
    getFatherId(): string | undefined { return this.data.fatherId; }
    getMotherId(): string | undefined { return this.data.motherId; }
    
    /**
     * 获取唯一ID（用于追踪）
     */
    getId(): string {
        return `dna_${this.data.generation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * 克隆DNA
     */
    clone(): DNA {
        return new DNA(JSON.parse(JSON.stringify(this.data)));
    }
}

/**
 * 需求权重（用于AI决策）
 */
export interface NeedWeights {
    physiological: number;    // 生理需求权重
    safety: number;          // 安全需求权重
    social: number;          // 社交需求权重
    esteem: number;          // 尊重/地位权重
    selfActualization: number; // 自我实现权重
}

/**
 * 动态需求值
 */
export interface DynamicNeeds {
    hunger: number;          // 0=饱, 1=饿死
    thirst: number;         // 0=充足, 1=渴死
    energy: number;         // 0=精力充沛, 1=精疲力竭
    safety: number;         // 0=安全, 1=危险
    social: number;         // 0=社交满足, 1=孤独
    curiosity: number;       // 0=无聊, 1=好奇
    reproduction: number;    // 繁殖欲望 0-1
}

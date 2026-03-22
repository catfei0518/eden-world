/**
 * 染色体类 - 模拟真实染色体结构
 */

// 基因座位置
export interface GeneLocus {
    chromosome: number;    // 1-23
    band: string;        // 'p36', 'q31' 等
    position: number;    // 碱基对位置
    gene: string;        // 基因名
    effect: string;      // 影响特征
}

// 等位基因
export interface Allele {
    value: number;           // 基因值 (0-1)
    mutation?: Mutation;     // 突变信息
    methylated: boolean;    // 表观遗传沉默
}

// 基因
export interface Gene {
    locus: GeneLocus;
    paternalAllele: Allele;  // 来自父亲
    maternalAllele: Allele;  // 来自母亲
    dominance: Dominance;    // 显性类型
}

// 突变记录
export interface Mutation {
    locus: GeneLocus;
    originalValue: number;
    newValue: number;
    type: MutationType;
    generation: number;
}

// 表观遗传标记
export interface EpigeneticMark {
    locus: GeneLocus;
    level: number;           // 0-1, 1=完全沉默
    inherited: boolean;     // 是否遗传
}

// 显性类型
export enum Dominance {
    FULL_DOMINANT = 'full',       // 完全显性
    INCOMPLETE = 'incomplete',    // 不完全显性
    CODOMINANT = 'codominant',    // 共显性
    RECESSIVE = 'recessive'       // 隐性
}

// 突变类型
export enum MutationType {
    POINT = 'point',             // 点突变
    INSERTION = 'insertion',    // 插入
    DELETION = 'deletion',      // 缺失
    DUPLICATION = 'duplication'  // 重复
}

// 预设基因座（关键基因）
const PRESET_GENES: Record<string, GeneLocus> = {
    // 1号染色体 - 体质/力量
    ACTN3: { chromosome: 11, band: 'p11', position: 33000000, gene: 'ACTN3', effect: 'strength' },
    
    // 7号染色体 - 智力/学习
    BDNF: { chromosome: 7, band: 'p11', position: 27000000, gene: 'BDNF', effect: 'intelligence' },
    
    // 17号染色体 - 性格/情绪
    MAOA: { chromosome: 17, band: 'q11', position: 43000000, gene: 'MAOA', effect: 'aggression' },
    SLC6A4: { chromosome: 17, band: 'q11', position: 45000000, gene: 'SLC6A4', effect: 'empathy' },
    
    // DRD4 - 好奇心/多巴胺
    DRD4: { chromosome: 11, band: 'p15', position: 620000, gene: 'DRD4', effect: 'curiosity' },
    
    // OXT - 催产素受体
    OXT: { chromosome: 20, band: 'p13', position: 3100000, gene: 'OXT', effect: 'socialNeed' },
    
    // AVPR1a - 社会行为
    AVPR1a: { chromosome: 12, band: 'q14', position: 85000000, gene: 'AVPR1a', effect: 'sociability' },
};

/**
 * 染色体类
 */
export class Chromosome {
    readonly id: number;           // 1-23
    readonly type: 'autosome' | 'sex';
    private genes: Map<string, Gene>;
    
    // 等位基因值（简化存储）
    private paternalValues: Map<string, number>;
    private maternalValues: Map<string, number>;
    
    constructor(id: number) {
        this.id = id;
        this.type = id === 23 ? 'sex' : 'autosome';
        this.genes = new Map();
        this.paternalValues = new Map();
        this.maternalValues = new Map();
        this.initializeGenes();
    }
    
    /**
     * 初始化基因
     */
    private initializeGenes(): void {
        // 为每条染色体生成随机基因
        const geneCount = this.id === 23 ? 3 : 8; // 性染色体基因少一些
        
        for (let i = 0; i < geneCount; i++) {
            const geneName = `gene_${this.id}_${i}`;
            const effect = this.getRandomEffect();
            
            // 随机等位基因值（0-1）
            const paternalValue = this.randomAllele();
            const maternalValue = this.randomAllele();
            
            this.paternalValues.set(geneName, paternalValue);
            this.maternalValues.set(geneName, maternalValue);
            
            this.genes.set(geneName, {
                locus: {
                    chromosome: this.id,
                    band: this.randomBand(),
                    position: Math.floor(Math.random() * 100000000),
                    gene: geneName,
                    effect
                },
                paternalAllele: { value: paternalValue },
                maternalAllele: { value: maternalValue },
                dominance: this.randomDominance()
            });
        }
    }
    
    /**
     * 随机等位基因（0-1）
     * 包含少量极端值（模拟真实遗传多样性）
     */
    private randomAllele(): number {
        const r = Math.random();
        if (r < 0.1) return Math.random() * 0.3;      // 10% 低值
        if (r > 0.9) return 0.7 + Math.random() * 0.3; // 10% 高值
        return 0.3 + Math.random() * 0.4;              // 80% 中间值
    }
    
    /**
     * 随机显性类型
     */
    private randomDominance(): Dominance {
        const types = [Dominance.FULL_DOMINANT, Dominance.INCOMPLETE, Dominance.CODOMINANT, Dominance.RECESSIVE];
        return types[Math.floor(Math.random() * types.length)];
    }
    
    /**
     * 随机基因效果
     */
    private getRandomEffect(): string {
        const effects = [
            'strength', 'agility', 'intelligence', 'perception',
            'constitution', 'endurance',
            'bravery', 'curiosity', 'aggression', 'empathy',
            'sociability', 'patience',
            'sensitivity', 'fearResponse', 'riskAversion',
            'socialNeed', 'selfInterest', 'altruism',
            'metabolism', 'lifespan', 'fertility', 'immunity',
            'skinTone', 'height', 'hairColor', 'eyeColor'
        ];
        return effects[Math.floor(Math.random() * effects.length)];
    }
    
    /**
     * 随机染色体带
     */
    private randomBand(): string {
        const arms = ['p', 'q'];
        const arm = arms[Math.floor(Math.random() * arms.length)];
        const band = Math.floor(Math.random() * 37) + 1;
        return `${arm}${band}`;
    }
    
    /**
     * 获取基因值
     */
    getGeneValues(): Record<string, number> {
        const values: Record<string, number> = {};
        
        for (const [name, gene] of this.genes) {
            // 计算表达值
            values[gene.locus.effect] = this.calculateExpression(gene);
        }
        
        return values;
    }
    
    /**
     * 计算基因表达
     */
    private calculateExpression(gene: Gene): number {
        const pVal = gene.paternalAllele.value;
        const mVal = gene.maternalAllele.value;
        
        switch (gene.dominance) {
            case Dominance.FULL_DOMINANT:
                return Math.max(pVal, mVal);
            
            case Dominance.INCOMPLETE:
                return (pVal + mVal) / 2 * 0.8 + 0.1;
            
            case Dominance.CODOMINANT:
                return (pVal + mVal) / 2;
            
            case Dominance.RECESSIVE:
                return pVal === mVal ? pVal : (pVal + mVal) / 4;
            
            default:
                return (pVal + mVal) / 2;
        }
    }
    
    /**
     * 减数分裂 - 随机选择一条染色体传递给配子
     */
    meiosis(): Chromosome {
        const gamete = new Chromosome(this.id);
        
        // 清空并重新赋值
        gamete.paternalValues.clear();
        gamete.maternalValues.clear();
        
        for (const [name, gene] of this.genes) {
            // 随机选择父本或母本
            const fromPaternal = Math.random() > 0.5;
            const value = fromPaternal ? gene.paternalAllele.value : gene.maternalAllele.value;
            
            // 突变（1%概率）
            const mutatedValue = this.maybeMutate(value);
            
            gamete.paternalValues.set(name, mutatedValue);
        }
        
        return gamete;
    }
    
    /**
     * 突变
     */
    private maybeMutate(value: number): number {
        if (Math.random() < 0.01) { // 1%突变率
            const change = (Math.random() - 0.5) * 0.3; // ±15%
            return Math.max(0, Math.min(1, value + change));
        }
        return value;
    }
    
    /**
     * 组合两条配子染色体
     */
    static combine(maternal: Chromosome, paternal: Chromosome, id: number): Chromosome {
        const child = new Chromosome(id);
        
        // 复制基因值
        for (const [name, value] of maternal.paternalValues) {
            child.paternalValues.set(name, value);
        }
        for (const [name, value] of paternal.paternalValues) {
            child.maternalValues.set(name, value);
        }
        
        return child;
    }
    
    /**
     * 获取特定效果的基因值
     */
    getEffectValue(effect: string): number {
        let sum = 0;
        let count = 0;
        
        for (const gene of this.genes.values()) {
            if (gene.locus.effect === effect) {
                sum += this.calculateExpression(gene);
                count++;
            }
        }
        
        return count > 0 ? sum / count : 0.5;
    }
}

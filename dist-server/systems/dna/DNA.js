"use strict";
/**
 * DNA系统 - 完整染色体模拟
 *
 * 基于真实人类遗传学：
 * - 23对染色体
 * - 基因座精确定位
 * - 显性/隐性表达
 * - 突变机制
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DNA = void 0;
const Chromosome_1 = require("./Chromosome");
/**
 * DNA类 - 管理完整遗传信息
 */
class DNA {
    constructor(data) {
        this.data = data;
    }
    /**
     * 创建初始DNA（亚当和夏娃）
     */
    static createInitial() {
        const chromosomes = [];
        // 创建23对染色体
        for (let i = 1; i <= 23; i++) {
            chromosomes.push(new Chromosome_1.Chromosome(i));
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
    static inherit(mother, father) {
        const childChromosomes = [];
        // 23对染色体
        for (let i = 0; i < 23; i++) {
            const maternalChromosome = mother.data.chromosomes[i];
            const paternalChromosome = father.data.chromosomes[i];
            // 减数分裂：每对随机选一条
            const maternalGamete = maternalChromosome.meiosis();
            const paternalGamete = paternalChromosome.meiosis();
            // 受精：组合成新的染色体对
            const childChromosome = Chromosome_1.Chromosome.combine(maternalGamete, paternalGamete, i + 1);
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
    static determineSex(mother, father) {
        // 母亲总是提供X
        // 父亲提供X或Y
        return Math.random() > 0.5 ? 'XX' : 'XY';
    }
    /**
     * 从基因型表达表现型
     */
    static expressPhenotype(chromosomes) {
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
    static average(values, trait) {
        const relevant = values.filter(v => v[trait] !== undefined);
        if (relevant.length === 0)
            return 0.5;
        const sum = relevant.reduce((acc, v) => acc + v[trait], 0);
        return Math.max(0, Math.min(1, sum / relevant.length));
    }
    // Getter方法
    getData() { return this.data; }
    getPhenotype() { return this.data.phenotype; }
    getChromosomes() { return this.data.chromosomes; }
    getSex() { return this.data.sexChromosome; }
    getGeneration() { return this.data.generation; }
    getFatherId() { return this.data.fatherId; }
    getMotherId() { return this.data.motherId; }
    /**
     * 获取唯一ID（用于追踪）
     */
    getId() {
        return `dna_${this.data.generation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * 克隆DNA
     */
    clone() {
        return new DNA(JSON.parse(JSON.stringify(this.data)));
    }
}
exports.DNA = DNA;

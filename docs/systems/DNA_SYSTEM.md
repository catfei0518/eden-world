# 伊甸世界 - DNA系统技术文档

> 版本: v0.8.0-alpha
> 更新: 2026-03-23

---

## 目录

1. [系统概述](#系统概述)
2. [架构设计](#架构设计)
3. [DNA数据结构](#dna数据结构)
4. [染色体系统](#染色体系统)
5. [需求系统](#需求系统)
6. [AI决策系统](#ai决策系统)
7. [整合流程](#整合流程)
8. [文件清单](#文件清单)

---

## 系统概述

### 设计目标

DNA系统旨在为每个角色提供独特的遗传特征，影响其：
- 外观（肤色、身高、发色）
- 属性（力量、敏捷、智力）
- 性格（勇敢、好奇、攻击性）
- 需求敏感度（饥饿、口渴）
- 行为倾向

### 核心理念

```
基因型（DNA） → 表现型（Phenotype） → 需求（Needs） → AI决策（Actions）
```

---

## 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                      DNA系统                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    │
│  │    DNA      │───▶│  Phenotype  │───▶│   Needs     │    │
│  │  (基因型)    │    │  (表现型)   │    │  (需求)     │    │
│  └─────────────┘    └─────────────┘    └─────────────┘    │
│         │                                      │            │
│         │                                      ▼            │
│         │                              ┌─────────────┐      │
│         │                              │  AI Controller │    │
│         │                              │   (决策)      │    │
│         │                              └─────────────┘      │
│         │                                      │            │
│         ▼                                      ▼            │
│  ┌─────────────┐                      ┌─────────────┐      │
│  │ Chromosome  │                      │   Action    │      │
│  │  (染色体)    │                      │  (行为)     │      │
│  └─────────────┘                      └─────────────┘      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## DNA数据结构

### DNAData

```typescript
interface DNAData {
    chromosomes: Chromosome[];     // 23对染色体
    sexChromosome: 'XX' | 'XY';   // 性染色体
    phenotype: Phenotype;         // 表现型
    fatherId?: string;            // 父亲ID
    motherId?: string;            // 母亲ID
    mutations: Mutation[];        // 突变历史
    epigeneticMarks: EpigeneticMark[];
    generation: number;           // 世代数
}
```

### Phenotype（表现型）

```typescript
interface Phenotype {
    // 体质属性（0-100）
    strength: number;       // 力量
    agility: number;       // 敏捷
    intelligence: number;  // 智力
    perception: number;    // 感知
    constitution: number;  // 体质
    endurance: number;     // 耐力
    
    // 性格属性（0-1）
    bravery: number;       // 勇敢度
    curiosity: number;     // 好奇心
    aggression: number;    // 攻击性
    empathy: number;       // 同理心
    sociability: number;   // 社交能力
    patience: number;      // 耐心
    
    // 需求相关DNA属性
    hungerThreshold: number;      // 饥饿阈值
    hungerSensitivity: number;    // 饥饿敏感度
    thirstThreshold: number;      // 口渴阈值
    thirstSensitivity: number;    // 口渴敏感度
    fearResponse: number;        // 恐惧反应
    riskAversion: number;        // 风险规避
    socialNeed: number;          // 社交需求
    selfInterest: number;        // 自我利益倾向
    altruismTendency: number;    // 利他倾向
    
    // 生理参数
    metabolism: number;          // 代谢速度 (0.5-2.0)
    lifespan: number;            // 寿命（秒）
    fertility: number;           // 生育力 (0-1)
    immuneStrength: number;      // 免疫力 (0-1)
    
    // 外观
    skinTone: number;          // 肤色 0-1
    height: number;            // 身高 0.7-1.3
    hairColor: number;         // 发色 0-1
    eyeColor: number;          // 眼睛颜色 0-1
}
```

---

## 染色体系统

### 概述

模拟真实人类染色体：
- 23对染色体（46条）
- 每条染色体包含多个基因
- 基因有显性/隐性表达
- 突变机制

### Chromosome类

```typescript
class Chromosome {
    readonly id: number;           // 1-23
    readonly type: 'autosome' | 'sex';
    private genes: Map<string, Gene>;
    private paternalValues: Map<string, number>;
    private maternalValues: Map<string, number>;
}
```

### 关键方法

| 方法 | 说明 |
|------|------|
| `meiosis()` | 减数分裂，返回配子染色体 |
| `getGeneValues()` | 获取所有基因的表现值 |
| `getEffectValue(effect)` | 获取特定效果的基因值 |

### 显性类型

```typescript
enum Dominance {
    FULL_DOMINANT = 'full',       // 完全显性
    INCOMPLETE = 'incomplete',    // 不完全显性
    CODOMINANT = 'codominant',    // 共显性
    RECESSIVE = 'recessive'       // 隐性
}
```

### 遗传流程

```
父本染色体 ──┬──▶ meiosis() ──▶ 配子1
            │
            └──▶ meiosis() ──▶ 配子2

母本染色体 ──┬──▶ meiosis() ──▶ 配子3
            │
            └──▶ meiosis() ──▶ 配子4

配子1 + 配子3 ──▶ combine() ──▶ 子代染色体对
```

---

## 需求系统

### DynamicNeeds

```typescript
interface DynamicNeeds {
    hunger: number;          // 0=饱, 1=饿死
    thirst: number;         // 0=充足, 1=渴死
    energy: number;         // 0=精力充沛, 1=精疲力竭
    safety: number;         // 0=安全, 1=危险
    social: number;         // 0=社交满足, 1=孤独
    curiosity: number;       // 0=无聊, 1=好奇
    reproduction: number;    // 繁殖欲望 0-1
}
```

### 计算公式

```
最终需求 = 基础需求 × DNA敏感度 × 环境修正 × 时间累积

示例（饥饿）：
timeSinceMeal = 当前时间 - 上次进食时间
baseHunger = min(1, timeSinceMeal / 600 * metabolism)
bufferedHunger = max(0, baseHunger - storedFood * 0.1)
finalHunger = min(1, bufferedHunger * hungerSensitivity)
```

---

## AI决策系统

### 决策流程

```
1. 读取角色DNA → 性格权重
2. 计算当前需求 → DynamicNeeds
3. 评估所有可用行动 → ActionScore
4. Softmax选择 → 最终行动
```

### 评分公式

```
总分 = 需求满足度×0.4 + DNA契合度×0.25 + 风险评估×0.2 + 能量效率×0.15
```

### 行动效果表

| 行动 | 满足需求 | 能量消耗 | 风险 |
|------|----------|----------|------|
| FIND_FOOD | 饥饿0.5 | 0.2 | 低 |
| EAT | 饥饿0.9 | 0 | 无 |
| DRINK | 口渴0.95 | 0 | 无 |
| REST | 精力0.6 | 0 | 无 |
| FLEE | 安全0.9 | 0.35 | 中 |
| SOCIALIZE | 社交0.8 | 0.05 | 无 |
| EXPLORE | 好奇0.7 | 0.25 | 高 |

---

## 整合流程

### 角色生命周期

```typescript
// 1. 创建角色
const dna = DNA.createInitial();
const phenotype = dna.getPhenotype();

// 2. 每帧更新需求
const needs = needsCalculator.calculate(individual, worldState, phenotype);

// 3. AI决策
const ai = new AIController(phenotype);
const action = ai.decideAction(needs, individual, worldState);

// 4. 执行行动
executeAction(action, individual);

// 5. 繁殖
if (shouldReproduce(parents)) {
    const childDNA = DNA.inherit(mother, father);
}
```

---

## 文件清单

```
src/systems/
├── dna/
│   ├── index.ts           # 导出
│   ├── DNA.ts             # DNA主类
│   └── Chromosome.ts      # 染色体类
├── needs/
│   ├── index.ts           # 导出
│   └── NeedsCalculator.ts # 需求计算器
└── ai/
    ├── index.ts           # 导出
    └── AIController.ts    # AI决策控制器
```

---

## 使用示例

```typescript
import { DNA } from './systems/dna';
import { NeedsCalculator, IndividualState, WorldState } from './systems/needs';
import { AIController } from './systems/ai';

// 创建角色DNA
const adamDNA = DNA.createInitial();
const eveDNA = DNA.createInitial();

// 创建夏娃的后代
const childDNA = DNA.inherit(eveDNA, adamDNA);

// 获取表现型
const phenotype = childDNA.getPhenotype();
console.log(`力量: ${phenotype.strength}`);
console.log(`勇敢度: ${phenotype.bravery}`);

// 创建需求计算器
const calculator = new NeedsCalculator();

// 计算需求
const individual: IndividualState = { /* ... */ };
const worldState: WorldState = { /* ... */ };
const needs = calculator.calculate(individual, worldState, phenotype);

// AI决策
const ai = new AIController(phenotype);
const action = ai.decideAction(needs, individual, worldState);
console.log(`决定: ${action}`);
```

---

## 未来扩展

- [ ] 完整基因表达网络
- [ ] 表观遗传效应
- [ ] 基因连锁
- [ ] 更多行为类型
- [ ] 学习机制

---

*最后更新: 2026-03-23*

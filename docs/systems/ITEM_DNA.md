# 伊甸世界 - 物品DNA系统设计文档

> 版本：v1.0
> 日期：2026-03-27
> 状态：设计中

---

## 核心理念

> **「只定义物品基因规则，不定义物品命运」**

和宪法的人DNA一样，物品的「基因」决定潜力，环境决定表达。物品是活的，会随环境变异。

---

## 一、物品DNA结构

```typescript
/**
 * 物品基因模板 - 定义物种的基本特征
 */
interface ItemGeneTemplate {
    species_id: string;              // 物种ID："berry_001"
    species_name: string;             // 显示名称："浆果"
    category: ItemCategory;           // 分类：采集/狩猎/饮水/制作
    
    // 基础属性（100g标准）
    base_nutrition: {
        calories: number;              // 热量 (kcal)
        water: number;                // 水分 (ml)
        sugar: number;                // 糖分 (g)
        protein: number;              // 蛋白质 (g)
        fat: number;                  // 脂肪 (g)
        vitaminC: number;              // 维生素C (mg)
    };
    
    // 基因池（允许的变异范围）
    gene_pool: {
        quality: string[];            // 质量基因：["normal", "premium", "mutant"]
        color: string[];             // 颜色基因：["red", "purple", "green"]
        size_range: [number, number]; // 尺寸范围：[0.8, 1.2]
    };
}

/**
 * 物品DNA - 单个物品实例的完整基因
 */
interface ItemDNA {
    species_id: string;               // 物种ID
    genome: {
        chromosome_1: QualityGene;     // 质量染色体
        chromosome_2: NutritionGene;  // 营养染色体
        chromosome_3: AppearanceGene; // 外观染色体
        chromosome_4: FunctionGene;   // 功能染色体
    };
    mutations: MutationRecord[];      // 突变历史
    generation: number;               // 繁殖代数
    birth_season: Season;             // 生成季节
    birth_environment: EnvFactors;    // 生成环境
}

/**
 * 质量基因
 */
interface QualityGene {
    type: 'normal' | 'premium' | 'mutant';
    expression: number;               // 表达系数：0.8-1.2
}

/**
 * 营养基因
 */
interface NutritionGene {
    calories: number;                 // 热量系数：0.5-1.5
    water: number;                    // 水分系数
    sugar: number;                    // 糖分系数
    protein: number;                  // 蛋白质系数
    fat: number;                     // 脂肪系数
    vitaminC: number;                 // 维生素C系数
}

/**
 * 外观基因
 */
interface AppearanceGene {
    color: string;                    // 颜色
    size: number;                     // 尺寸系数：0.8-1.2
    shape: string;                    // 形状变体
}

/**
 * 功能基因
 */
interface FunctionGene {
    decay_rate: number;               // 腐坏速度：0.5-1.5（越高越快）
    aroma: number;                    // 香味强度：0-1
    spoilage: number;                 // 变质临界：新鲜度阈值
}

/**
 * 突变记录
 */
interface MutationRecord {
    generation: number;               // 突变代数
    gene: string;                     // 突变基因
    before: number;                   // 突变前值
    after: number;                    // 突变后值
    cause: 'cooking' | 'environment' | 'random';
}
```

---

## 二、物品类型定义（基因模板）

### 采集类

| 物种ID | 名称 | 热量 | 水分 | 果糖 | 维生素C | 基因池 |
|--------|------|------|------|------|---------|--------|
| berry_001 | 浆果 | 32kcal | 80ml | 5g | 12mg | 红/紫/青 |
| fruit_001 | 野果 | 50kcal | 90ml | 8g | 15mg | 黄/绿/橙 |
| herb_001 | 草药 | 20kcal | 60ml | 2g | 8mg | 绿/褐 |
| wood_001 | 木材 | 0kcal | 0ml | 0g | 0mg | 木色 |
| stone_001 | 石头 | 0kcal | 0ml | 0g | 0mg | 灰/褐 |

### 狩猎类

| 物种ID | 名称 | 热量 | 水分 | 蛋白质 | 脂肪 | 基因池 |
|--------|------|------|------|--------|------|--------|
| meat_raw | 生肉 | 150kcal | 0ml | 26g | 15g | 鲜/陈 |
| meat_cooked | 熟肉 | 200kcal | 0ml | 30g | 12g | 烤/煮 |
| egg_001 | 蛋 | 140kcal | 0ml | 13g | 10g | 白/褐 |
| fish_001 | 鱼 | 100kcal | 0ml | 20g | 3g | 鲜/干 |

### 饮水类

| 物种ID | 名称 | 热量 | 水分 | 疾病风险 | 基因池 |
|--------|------|------|------|----------|--------|
| water_dirty | 河水 | 0kcal | 100ml | 5% | 净/浊 |
| water_lake | 湖水 | 0kcal | 100ml | 3% | 净/浊 |
| water_clean | 净水 | 0kcal | 100ml | 0% | 净 |
| water_rain | 雨水 | 0kcal | 100ml | 1% | 净/微浊 |

### 制作类

| 物种ID | 名称 | 用途 | 耐久 | 效率加成 |
|--------|------|------|------|----------|
| tool_stone_axe | 石斧 | 砍树 | 50次 | +50% |
| tool_stone_knife | 石刀 | 切割 | 40次 | +30% |
| tool_wood_spear | 木矛 | 狩猎 | 30次 | +40% |
| rope_001 | 绳索 | 捆绑 | - | - |

---

## 三、基因表达系统

### 环境因素

```typescript
interface EnvFactors {
    soil_fertility: number;   // 土壤肥力：0.5-1.5
    water_quality: number;    // 水源质量：0.5-1.5
    sunlight: number;        // 日照时长：0.5-1.5
    season: Season;          // 当前季节
}

// 季节加成
const SEASON_BONUS = {
    spring: 0.8,
    summer: 1.2,
    autumn: 1.0,
    winter: 0.6
};
```

### 表达公式

```
最终属性 = 基础值 × 质量系数 × 环境系数 × 季节系数 × 随机变量

随机变量 = 0.9 + Math.random() * 0.2  // ±10%
```

### 示例：浆果最终属性计算

```
基础属性（100g）：
- 热量: 32 kcal
- 水分: 80 ml
- 维生素C: 12 mg

环境条件：
- 土壤肥力: 1.2（肥沃）
- 水源质量: 1.1（优质）
- 日照: 1.0（正常）
- 季节: 夏季(1.2)

质量基因: premium(×1.1)

计算结果：
- 热量: 32 × 1.1 × 1.2 × 1.1 × 1.0 × 0.95 ≈ 44 kcal
- 水分: 80 × 1.1 × 1.2 × 1.1 × 1.0 × 0.97 ≈ 111 ml
- 维生素C: 12 × 1.1 × 1.2 × 1.1 × 1.0 × 0.93 ≈ 16 mg
```

---

## 四、突变系统

### 突变类型

| 类型 | 触发条件 | 基因变化 |
|------|----------|----------|
| cooking | 烹饪加工 | chromosome_2随机变异±30% |
| environment | 极端环境 | chromosome_4适应变化 |
| random | 随机概率5% | 随机染色体±10% |

### 烹饪=繁殖

```
新物品基因 = 父母基因 × 70% + 随机变异 × 30%

示例：烧烤生肉
父母基因(生肉):
  - 蛋白质系数: 1.0
  - 脂肪系数: 1.2
  - 腐坏速度: 1.3

烹饪后(熟肉):
  - 蛋白质系数: 0.7 + 0.35 = 1.05 (继承+变异)
  - 脂肪系数: 0.84 - 0.25 = 0.59 (降低，油脂流失)
  - 腐坏速度: 0.65 (大幅降低，保鲜更久)
```

---

## 五、数据结构

### 物品实例

```typescript
interface ItemInstance {
    id: string;                      // 唯一ID
    dna: ItemDNA;                    // 物品DNA
    
    // 运行时数据
    quantity: number;                 // 数量
    freshness: number;                // 新鲜度 0-100
    
    // 位置
    position: {
        type: 'inventory' | 'hand' | 'ground' | 'world';
        slot?: number;               // 背包槽位
        holder_id?: string;          // 持有者ID
        world_pos?: { x: number; y: number }; // 地上/世界位置
    };
    
    // 状态
    equipped: boolean;               // 是否装备
    tradable: boolean;               // 是否可交易
}

/**
 * 灌木实例
 */
interface BushInstance {
    id: string;
    position: { x: number; y: number };
    season: Season;
    
    // 浆果数据
    berry_count: number;             // 当前浆果数：5-30
    max_berries: number;             // 最大承载量
    berries: BerryInstance[];        // 每个浆果独立DNA
    
    // 状态
    durability: number;              // 耐久度
    last_harvest: number;           // 上次采集时间
    regrow_timer: number;           // 重生计时
}

/**
 * 浆果实例
 */
interface BerryInstance {
    id: string;
    dna: ItemDNA;                   // 每个浆果独立基因
    freshness: number;               // 新鲜度 0-100
    size: number;                   // 尺寸 0.8-1.2
}
```

---

## 六、背包系统

```typescript
interface Inventory {
    slots: InventorySlot[];         // 5个槽位
    max_weight: number;             // 最大负重
    current_weight: number;         // 当前负重
}

interface InventorySlot {
    index: number;                  // 0-4
    item: ItemInstance | null;      // 物品或空
    count: number;                 // 数量
}

/**
 * 堆叠规则
 * 同物种ID + 基因哈希相似 → 可堆叠
 */
function canStack(item1: ItemInstance, item2: ItemInstance): boolean {
    return item1.dna.species_id === item2.dna.species_id
        && geneHashSimilar(item1.dna, item2.dna);
}
```

---

## 七、宪法的对应设计

| 宪法条款 | 物品DNA实现 |
|---------|-----------|
| 第六条DNA | 物品genome系统，完全复制人类DNA理念 |
| 第三条环境 | 环境系数影响表达 |
| 第九条生存 | 饥饿/口渴用营养DNA计算 |
| 第十四条工具 | 工具也有DNA，制作=变异 |
| 第二十七条农业 | 可培育特殊品种=人工选择基因 |
| 第一条涌现 | 物品基因+环境→复杂表现 |

---

## 八、实施检查清单

### Phase 1: 浆果采集（立即）
- [ ] 灌木数据结构
- [ ] 浆果随机数量5-30
- [ ] 浆果固定属性（32kcal/80ml/5g/12mg）
- [ ] 采集距离判定
- [ ] 5格背包UI
- [ ] 季节显示

### Phase 2: DNA基础
- [ ] ItemDNA接口
- [ ] 基因模板表
- [ ] 基因哈希系统

### Phase 3: 环境表达
- [ ] 环境系数计算
- [ ] 季节加成
- [ ] 随机变量

### Phase 4: 背包完整
- [ ] 物品使用（吃/喝）
- [ ] 丢弃物品
- [ ] 手持物品切换

### Phase 5: 采集+工具
- [ ] AI采集行为
- [ ] 工具加成系统

### Phase 6: 烹饪变异
- [ ] 烹饪配方
- [ ] 基因变异逻辑
- [ ] 突变记录

---

*设计：2026-03-27*

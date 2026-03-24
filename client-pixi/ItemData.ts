/**
 * 物品数据系统 - 元素级物品属性
 */

export interface NutritionalElements {
    calories: number;    // 热量 (kcal)
    water: number;       // 水分 (ml)
    vitamins: number;    // 维生素 (mg)
    protein: number;     // 蛋白质 (g)
    fat: number;        // 脂肪 (g)
}

export interface ItemData {
    name: string;           // 显示名称
    nutrition: NutritionalElements;  // 营养元素
    lifePenalty: number;   // 寿命惩罚 (0-1)
}

// 物品属性表
export const ITEM_DATA: Record<string, ItemData> = {
    // 浆果
    'berry': {
        name: '浆果',
        nutrition: { calories: 30, water: 5, vitamins: 10, protein: 0.5, fat: 0.1 },
        lifePenalty: 0,
    },
    // 野果
    'wild_fruit': {
        name: '野果',
        nutrition: { calories: 50, water: 10, vitamins: 15, protein: 1, fat: 0.2 },
        lifePenalty: 0,
    },
    // 生肉 (100g)
    'raw_meat': {
        name: '生肉',
        nutrition: { calories: 250, water: 0, vitamins: 0, protein: 26, fat: 15 },
        lifePenalty: 0.05,  // 寄生虫风险
    },
    // 熟肉 (100g)
    'cooked_meat': {
        name: '熟肉',
        nutrition: { calories: 300, water: 0, vitamins: 0, protein: 30, fat: 12 },
        lifePenalty: 0,
    },
    // 河水 (100ml)
    'river_water': {
        name: '河水',
        nutrition: { calories: 0, water: 100, vitamins: 0, protein: 0, fat: 0 },
        lifePenalty: 0.01,  // 疾病风险
    },
    // 净水 (100ml)
    'clean_water': {
        name: '净水',
        nutrition: { calories: 0, water: 100, vitamins: 0, protein: 0, fat: 0 },
        lifePenalty: 0,
    },
};

// 获取物品数据
export function getItemData(itemType: string): ItemData | null {
    return ITEM_DATA[itemType] || null;
}

// 计算物品热量
export function getItemCalories(itemType: string): number {
    return ITEM_DATA[itemType]?.nutrition.calories || 0;
}

// 计算物品水分
export function getItemWater(itemType: string): number {
    return ITEM_DATA[itemType]?.nutrition.water || 0;
}

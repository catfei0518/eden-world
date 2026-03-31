"use strict";
/**
 * 物品数据系统 - 元素级物品属性
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ITEM_DATA = void 0;
exports.getItemData = getItemData;
exports.getItemCalories = getItemCalories;
exports.getItemWater = getItemWater;
// 物品属性表
exports.ITEM_DATA = {
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
        lifePenalty: 0.05, // 寄生虫风险
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
        lifePenalty: 0.01, // 疾病风险
    },
    // 净水 (100ml)
    'clean_water': {
        name: '净水',
        nutrition: { calories: 0, water: 100, vitamins: 0, protein: 0, fat: 0 },
        lifePenalty: 0,
    },
};
// 获取物品数据
function getItemData(itemType) {
    return exports.ITEM_DATA[itemType] || null;
}
// 计算物品热量
function getItemCalories(itemType) {
    return exports.ITEM_DATA[itemType]?.nutrition.calories || 0;
}
// 计算物品水分
function getItemWater(itemType) {
    return exports.ITEM_DATA[itemType]?.nutrition.water || 0;
}

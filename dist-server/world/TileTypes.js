"use strict";
/**
 * 地形类型定义
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TILE_ATTRIBUTES = exports.TileType = void 0;
// 地形类型枚举
var TileType;
(function (TileType) {
    // 基础地形
    TileType["PLAIN"] = "plain";
    TileType["GRASS"] = "grass";
    TileType["DESERT"] = "desert";
    TileType["FOREST"] = "forest";
    // 水域
    TileType["OCEAN"] = "ocean";
    TileType["LAKE"] = "lake";
    TileType["RIVER"] = "river";
    TileType["SWAMP"] = "swamp";
    // 山地
    TileType["MOUNTAIN"] = "mountain";
    TileType["HILL"] = "hill";
    TileType["CLIFF"] = "cliff";
    // 特殊
    TileType["CAVE"] = "cave";
})(TileType || (exports.TileType = TileType = {}));
// 地形属性表
exports.TILE_ATTRIBUTES = {
    [TileType.PLAIN]: { type: TileType.PLAIN, walkable: true, speedFactor: 1.0, frictionFactor: 1.0 },
    [TileType.GRASS]: { type: TileType.GRASS, walkable: true, speedFactor: 0.9, frictionFactor: 0.9 },
    [TileType.DESERT]: { type: TileType.DESERT, walkable: true, speedFactor: 0.6, frictionFactor: 0.7 },
    [TileType.FOREST]: { type: TileType.FOREST, walkable: true, speedFactor: 0.7, frictionFactor: 0.9 },
    [TileType.OCEAN]: { type: TileType.OCEAN, walkable: false, speedFactor: 0, frictionFactor: 1.0 },
    [TileType.LAKE]: { type: TileType.LAKE, walkable: false, speedFactor: 0, frictionFactor: 1.0 },
    [TileType.RIVER]: { type: TileType.RIVER, walkable: false, speedFactor: 0, frictionFactor: 1.0 },
    [TileType.SWAMP]: { type: TileType.SWAMP, walkable: true, speedFactor: 0.5, frictionFactor: 0.6 },
    [TileType.MOUNTAIN]: { type: TileType.MOUNTAIN, walkable: false, speedFactor: 0, frictionFactor: 1.0 },
    [TileType.HILL]: { type: TileType.HILL, walkable: true, speedFactor: 0.5, frictionFactor: 1.0 },
    [TileType.CLIFF]: { type: TileType.CLIFF, walkable: false, speedFactor: 0, frictionFactor: 1.0 },
    [TileType.CAVE]: { type: TileType.CAVE, walkable: true, speedFactor: 0.7, frictionFactor: 1.0 },
};
exports.default = TileType;

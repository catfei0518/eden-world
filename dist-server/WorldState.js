"use strict";
/**
 * 伊甸世界 - 世界状态管理 v1.2
 *
 * Phase 1: 浆果采集系统
 * 使用 simplex-noise 与客户端保持一致
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorldState = void 0;
const simplex_noise_1 = require("simplex-noise");
const MAP_WIDTH = 300;
const MAP_HEIGHT = 150;
const TILE_SIZE = 64;
const WORLD_SEED = 12345;
/**
 * 创建与客户端一致的 RNG
 * 使用与 simplex-noise 相同的线性同余生成器
 */
function createRNG(seed) {
    return function () {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
    };
}
class WorldState {
    constructor(seed = WORLD_SEED) {
        this.tiles = [];
        this.groundObjects = [];
        this.bushes = []; // 灌木数据（包含浆果）
        this.bushReservations = new Map(); // 灌木预留：bushId -> characterId
        this.season = 'spring';
        this.tick = 0;
        this.seed = seed;
        // 使用与客户端一致的 RNG 创建噪声函数
        const elevationRNG = createRNG(seed);
        const moistureRNG = createRNG(seed + 100);
        const riverRNG = createRNG(seed + 500);
        const lakeRNG = createRNG(seed + 600);
        const itemRNG = createRNG(seed + 200); // 物品生成专用 RNG
        const regionRNG = createRNG(seed + 700); // 大区域 RNG
        const detailRNG = createRNG(seed + 800); // 细节 RNG
        this.elevationNoise = (0, simplex_noise_1.createNoise2D)(elevationRNG);
        this.moistureNoise = (0, simplex_noise_1.createNoise2D)(moistureRNG);
        this.riverNoise = (0, simplex_noise_1.createNoise2D)(riverRNG);
        this.lakeNoise = (0, simplex_noise_1.createNoise2D)(lakeRNG);
        this.itemNoise = (0, simplex_noise_1.createNoise2D)(itemRNG);
        this.regionNoise = (0, simplex_noise_1.createNoise2D)(regionRNG);
        this.detailNoise = (0, simplex_noise_1.createNoise2D)(detailRNG);
        this.generateWorld();
    }
    /**
     * 简化版多层噪声 - 性能优化
     */
    fbm(x, y, noise) {
        // 2层噪声叠加，平衡质量和性能
        return noise(x, y) * 0.7 + noise(x * 2, y * 2) * 0.3;
    }
    generateWorld() {
        // 第一遍：生成所有水体（海洋、河流、湖泊）
        this.generateWaterBodies();
        // 第二遍：生成其他地形（利用第一遍的水体数据进行isNearWater判断）
        this.generateLandTerrain();
        // 生成地面物品
        this.generateGroundObjects();
    }
    // 第一遍：生成所有水体
    generateWaterBodies() {
        // 调试：计算海岸线高度分布
        console.log('\n🌊 海岸线高度分布 (MAP_HEIGHT=' + MAP_HEIGHT + '):');
        const coastlineHeights = [];
        for (let x = 0; x < MAP_WIDTH; x++) {
            const coastlineNoise = this.regionNoise(x * 0.06, 0);
            const normalizedNoise = (coastlineNoise + 1) / 2;
            const coastlineVariation = Math.floor(normalizedNoise * 3); // 0-2 格变化
            const coastlineHeight = MAP_HEIGHT - 5 + coastlineVariation; // 从 y=145 开始变化，海洋2-5格
            coastlineHeights.push(coastlineHeight);
        }
        const minHeight = Math.min(...coastlineHeights);
        const maxHeight = Math.max(...coastlineHeights);
        console.log('  最小高度: ' + minHeight + ', 最大高度: ' + maxHeight);
        // 统计各高度的格子数
        const heightCounts = {};
        for (const h of coastlineHeights) {
            heightCounts[h] = (heightCounts[h] || 0) + 1;
        }
        console.log('  各高度分布: ' + JSON.stringify(heightCounts));
        let oceanCount = 0;
        let beachCount = 0;
        for (let y = 0; y < MAP_HEIGHT; y++) {
            for (let x = 0; x < MAP_WIDTH; x++) {
                // 垂直海拔偏差：北部高，南部低
                const verticalBias = (1 - y / MAP_HEIGHT) * 0.35;
                // 1. 海洋 - 地图底部 2-5 格 + 不规则海岸线
                const coastlineNoise = this.regionNoise(x * 0.06, 0);
                const normalizedNoise = (coastlineNoise + 1) / 2;
                const coastlineVariation = Math.floor(normalizedNoise * 3); // 0-2 格变化
                const coastlineHeight = MAP_HEIGHT - 5 + coastlineVariation; // 从 y=145 开始
                if (y >= coastlineHeight) {
                    this.tiles.push({ x, y, type: 'ocean' });
                    oceanCount++;
                    continue;
                }
                // 1.5 沙滩 - 海岸线上方 1-2 格
                if (y >= coastlineHeight - 2 && y < coastlineHeight) {
                    this.tiles.push({ x, y, type: 'beach' });
                    beachCount++;
                    continue;
                }
                // 2. 河流 - 扩大范围
                const riverTile = this.isRiverTile(x, y);
                if (riverTile && y > 5 && y < MAP_HEIGHT - 5) {
                    this.tiles.push({ x, y, type: 'river' });
                    continue;
                }
                // 3. 湖泊 - 扩大范围，增加数量
                const lakeTile = this.isLakeAreaNew(x, y);
                if (lakeTile && y > 8 && y < MAP_HEIGHT - 8) {
                    this.tiles.push({ x, y, type: 'lake' });
                    continue;
                }
                // 非水体格子，先用占位符
                this.tiles.push({ x, y, type: 'grass' });
            }
        }
        console.log(`🌊 水体生成完成: 海洋 ${oceanCount} 格, 沙滩 ${beachCount} 格`);
    }
    // 第二遍：生成陆地地形（使用第一遍的水体数据）
    generateLandTerrain() {
        // 统计地形分布
        const stats = {};
        let beachCount = 0;
        for (let y = 0; y < MAP_HEIGHT; y++) {
            for (let x = 0; x < MAP_WIDTH; x++) {
                const tileIndex = y * MAP_WIDTH + x;
                const tile = this.tiles[tileIndex];
                // 跳过水体和沙滩
                if (tile.type === 'ocean' || tile.type === 'river' || tile.type === 'lake' || tile.type === 'beach') {
                    stats[tile.type] = (stats[tile.type] || 0) + 1;
                    continue;
                }
                // 垂直海拔偏差：北部高，南部低
                const verticalBias = (1 - y / MAP_HEIGHT) * 0.35;
                // 计算噪声值
                const rawRegionValue = this.regionNoise(x * 0.015, y * 0.015);
                const regionValue = (rawRegionValue + 1) / 2; // 归一化到 0-1
                const elevation = this.fbm(x * 0.03, y * 0.03, this.elevationNoise);
                const moisture = this.fbm(x * 0.04, y * 0.04, this.moistureNoise);
                const detail = this.detailNoise(x * 0.1, y * 0.1);
                // 合并噪声并加入垂直海拔梯度
                const combinedElevation = elevation * 0.6 + (regionValue - 0.5) * 0.4 + detail * 0.2 + verticalBias;
                const combinedMoisture = moisture * 0.7 + (regionValue - 0.5) * 0.6;
                // 根据地形规则决定地形类型
                const terrain = this.getTerrainTypeNew(combinedElevation, combinedMoisture, regionValue, detail, x, y);
                this.tiles[tileIndex].type = terrain;
                stats[terrain] = (stats[terrain] || 0) + 1;
            }
        }
        // 输出完整地形统计（包括水体）
        console.log('\n🗺️ 完整地形统计 (共 ' + Object.values(stats).reduce((a, b) => a + b, 0) + ' 格):');
        for (const [type, count] of Object.entries(stats).sort((a, b) => b[1] - a[1])) {
            const total = MAP_WIDTH * MAP_HEIGHT;
            const percent = ((count / total) * 100).toFixed(1);
            console.log('  ' + type + ': ' + count + '格 (' + percent + '%)');
        }
    }
    // 打印 region 噪声值分布
    printRegionDistribution() {
        const buckets = {
            '0.0-0.1': 0, '0.1-0.2': 0, '0.2-0.3': 0, '0.3-0.4': 0, '0.4-0.5': 0,
            '0.5-0.6': 0, '0.6-0.7': 0, '0.7-0.8': 0, '0.8-0.9': 0, '0.9-1.0': 0
        };
        let minR = Infinity, maxR = -Infinity;
        let sampleCount = 0;
        for (let y = 0; y < MAP_HEIGHT; y++) {
            for (let x = 0; x < MAP_WIDTH; x++) {
                const rawNoise = this.regionNoise(x * 0.015, y * 0.015);
                const r = (rawNoise + 1) / 2; // 归一化到 0-1
                minR = Math.min(minR, r);
                maxR = Math.max(maxR, r);
                const bucket = Math.min(9, Math.floor(r * 10));
                const rangeKeys = Object.keys(buckets);
                if (rangeKeys[bucket]) {
                    buckets[rangeKeys[bucket]]++;
                }
                sampleCount++;
            }
        }
        console.log('\n📊 Region 噪声值范围: min=' + minR.toFixed(3) + ', max=' + maxR.toFixed(3));
        console.log('📊 Region 噪声值分布 (归一化到 0-1):');
        for (const [range, count] of Object.entries(buckets)) {
            const percent = ((count / (MAP_WIDTH * MAP_HEIGHT)) * 100).toFixed(1);
            console.log('  ' + range + ': ' + count + '格 (' + percent + '%)');
        }
    }
    // 打印完整地形统计
    printFullTerrainStats() {
        const stats = {};
        for (const tile of this.tiles) {
            stats[tile.type] = (stats[tile.type] || 0) + 1;
        }
        console.log('\n🗺️ 完整地图地形统计 (共 ' + this.tiles.length + ' 格):');
        const sortedStats = Object.entries(stats).sort((a, b) => b[1] - a[1]);
        for (const [type, count] of sortedStats) {
            const percent = ((count / this.tiles.length) * 100).toFixed(1);
            console.log('  ' + type + ': ' + count + '格 (' + percent + '%)');
        }
    }
    // 检查是否为沙滩格子（只在海洋正上方）
    isBeachTile(x, y) {
        // 检查正下方是否是海洋
        if (y + 1 < MAP_HEIGHT) {
            const belowTile = this.tiles[(y + 1) * MAP_WIDTH + x];
            if (belowTile && belowTile.type === 'ocean') {
                return true;
            }
        }
        // 检查左下方是否是海洋
        if (y + 1 < MAP_HEIGHT && x - 1 >= 0) {
            const belowLeftTile = this.tiles[(y + 1) * MAP_WIDTH + (x - 1)];
            if (belowLeftTile && belowLeftTile.type === 'ocean') {
                return true;
            }
        }
        // 检查右下方是否是海洋
        if (y + 1 < MAP_HEIGHT && x + 1 < MAP_WIDTH) {
            const belowRightTile = this.tiles[(y + 1) * MAP_WIDTH + (x + 1)];
            if (belowRightTile && belowRightTile.type === 'ocean') {
                return true;
            }
        }
        return false;
    }
    // 检测是否为河流格子
    isRiverTile(x, y) {
        // 从顶部到底部的河流，稍微窄一点
        const riverX = 0.5 + this.riverNoise(y * 0.05, 0) * 0.2 - 0.1;
        const dist = Math.abs(x / MAP_WIDTH - riverX);
        return dist < 0.015;
    }
    // 新湖泊检测 - 使用区域噪声
    isLakeAreaNew(x, y) {
        // 使用区域噪声创建更自然的湖泊
        const lakeCenter1 = this.regionNoise(50, 50) * 0.3 + 0.35;
        const lakeCenter2 = this.regionNoise(150, 80) * 0.3 + 0.65;
        const dx1 = x / MAP_WIDTH - lakeCenter1;
        const dy1 = y / MAP_HEIGHT - 0.5;
        const dist1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
        const dx2 = x / MAP_WIDTH - lakeCenter2;
        const dy2 = y / MAP_HEIGHT - 0.6;
        const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
        return dist1 < 0.04 || dist2 < 0.03;
    }
    // 新的地形类型决定函数 - 多样化区域型
    getTerrainTypeNew(elevation, moisture, region, detail, x, y) {
        // 归一化到0-1
        const e = (elevation + 1) / 2;
        const m = (moisture + 1) / 2;
        const d = (detail + 1) / 2;
        // 注意：region 参数已经是 0-1 范围（来自 (regionNoise + 1) / 2）
        const r = region; // 直接使用，已经是 0-1 范围
        // 根据区域调整湿度和海拔
        const regionMoisture = m + (r - 0.5) * 0.5;
        const regionElevation = e + (r - 0.5) * 0.25;
        // 垂直梯度：地图上部（y小）海拔更高
        const verticalGradient = (1 - y / MAP_HEIGHT) * 0.35;
        const adjustedElevation = Math.min(1, regionElevation + verticalGradient);
        // ====== 基于区域噪声的大区域划分 ======
        // 使用 region 噪声划分大区域（调整比例）
        // 0-0.15=沙漠, 0.15-0.3=平原, 0.3-0.5=森林, 0.5-0.7=草地, 0.7-0.85=丘陵, 0.85-1=山地
        const regionType = r; // 0-1 范围的 region 值
        // 1. 沙漠大区域 (regionType < 0.15)
        if (regionType < 0.15) {
            if (adjustedElevation > 0.7) {
                return 'badlands';
            }
            if (detail > 0.8 && this.isNearWater(x, y)) {
                return 'grass';
            }
            return 'desert';
        }
        // 2. 平原大区域 (0.15 <= regionType < 0.3)
        if (regionType < 0.3) {
            if (regionMoisture > 0.75 && adjustedElevation < 0.4) {
                return 'marsh';
            }
            if (detail > 0.8) {
                return 'grass';
            }
            if (detail < 0.2) {
                return 'plains';
            }
            return 'grass';
        }
        // 3. 森林大区域 (0.3 <= regionType < 0.5)
        if (regionType < 0.5) {
            if (adjustedElevation > 0.8) {
                return 'hill';
            }
            if (regionMoisture > 0.8 && adjustedElevation < 0.35) {
                return 'swamp';
            }
            if (detail > 0.8) {
                return 'grass';
            }
            return 'forest';
        }
        // 4. 草地大区域 (0.5 <= regionType < 0.7)
        if (regionType < 0.7) {
            if (detail > 0.9) {
                return 'forest';
            }
            if (detail < 0.1) {
                return 'plains';
            }
            return 'grass';
        }
        // 5. 丘陵大区域 (0.7 <= regionType < 0.85)
        if (regionType < 0.85) {
            if (adjustedElevation > 0.85) {
                return 'mountain';
            }
            if (regionMoisture < 0.35) {
                return 'badlands';
            }
            return 'hill';
        }
        // 6. 山地大区域 (regionType >= 0.85)
        if (regionType >= 0.85) {
            if (adjustedElevation > 0.85) {
                return 'mountain';
            }
            if (regionMoisture < 0.35) {
                return 'badlands';
            }
            if (adjustedElevation > 0.65) {
                return 'hill';
            }
            return 'forest';
        }
        return 'grass';
    }
    // 检查是否靠近水体
    isNearWater(x, y) {
        // 检查周围8个格子是否有水
        for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx < 0 || nx >= MAP_WIDTH || ny < 0 || ny >= MAP_HEIGHT)
                    continue;
                const tileIndex = ny * MAP_WIDTH + nx;
                const tile = this.tiles[tileIndex];
                if (tile && (tile.type === 'lake' || tile.type === 'river' || tile.type === 'ocean')) {
                    return true;
                }
            }
        }
        return false;
    }
    generateGroundObjects() {
        // 使用 simplex-noise 生成物品
        for (let y = 0; y < MAP_HEIGHT; y++) {
            for (let x = 0; x < MAP_WIDTH; x++) {
                // 直接从 tiles 数组中查找（使用确定性索引）
                const tileIndex = y * MAP_WIDTH + x;
                const tile = this.tiles[tileIndex];
                if (!tile || tile.x !== x || tile.y !== y)
                    continue;
                // 跳过水域地形
                if (tile.type === 'lake' || tile.type === 'river' || tile.type === 'ocean') {
                    continue;
                }
                // 森林地形：每个格子都生成树（100%覆盖）
                if (tile.type === 'forest') {
                    // 确定性随机选择树种（1:5比例）
                    const hash = (x * 12345 + y * 67890 + this.seed) % 100;
                    const treeType = hash < 17 ? 'tree' : 'forest_tree';
                    this.groundObjects.push({
                        id: `tree_${x}_${y}`,
                        type: treeType,
                        x: x,
                        y: y,
                        terrain: 'forest'
                    });
                }
                else if (tile.type === 'grass' && Math.abs(this.itemNoise(x * 0.3, y * 0.3)) < 0.05) {
                    // 灌木 - 5%概率
                    const bushId = `bush_${x}_${y}`;
                    this.groundObjects.push({
                        id: bushId,
                        type: 'bush',
                        x: x,
                        y: y,
                        terrain: 'grass'
                    });
                    const berryCount = Math.floor(Math.abs(this.itemNoise(x * 0.5, y * 0.5)) * 26) + 5;
                    this.bushes.push({
                        id: bushId,
                        x: x,
                        y: y,
                        berryCount: berryCount,
                        maxBerries: 30,
                        durability: 100,
                        lastHarvest: 0,
                        hasBerries: true
                    });
                }
                else if (tile.type === 'mountain' && Math.abs(this.itemNoise(x * 0.4, y * 0.4)) < 0.08) {
                    // 石头 - 山地8%概率
                    this.groundObjects.push({
                        id: `rock_${x}_${y}`,
                        type: 'rock',
                        x: x,
                        y: y,
                        terrain: 'mountain'
                    });
                }
                else if ((tile.type === 'hill' || tile.type === 'badlands') && Math.abs(this.itemNoise(x * 0.4, y * 0.4)) < 0.05) {
                    // 石头 - 丘陵/荒原5%概率
                    this.groundObjects.push({
                        id: `rock_${x}_${y}`,
                        type: 'rock',
                        x: x,
                        y: y,
                        terrain: tile.type
                    });
                }
                else if (tile.type === 'beach' && Math.abs(this.itemNoise(x * 0.6, y * 0.6)) < 0.02) {
                    // 贝壳 - 沙滩2%概率
                    this.groundObjects.push({
                        id: `shell_${x}_${y}`,
                        type: 'shell',
                        x: x,
                        y: y,
                        terrain: 'beach'
                    });
                }
                else if (tile.type === 'grass' && Math.abs(this.itemNoise(x * 0.5, y * 0.5)) < 0.03) {
                    // 树枝 - 草地3%概率
                    const qty = Math.floor(Math.abs(this.itemNoise(x * 0.7, y * 0.7)) * 3) + 2;
                    this.groundObjects.push({
                        id: `twig_${x}_${y}`,
                        type: 'twig',
                        x: x,
                        y: y,
                        terrain: 'grass',
                        quantity: qty
                    });
                }
                else if ((tile.type === 'grass' || tile.type === 'plains') && Math.abs(this.itemNoise(x * 0.8, y * 0.8)) < 0.02) {
                    // 石头 - 草地/平原2%概率
                    const qty = Math.floor(Math.abs(this.itemNoise(x * 0.9, y * 0.9)) * 2) + 1;
                    this.groundObjects.push({
                        id: `stone_${x}_${y}`,
                        type: 'stone',
                        x: x,
                        y: y,
                        terrain: tile.type,
                        quantity: qty
                    });
                }
            }
        }
    }
    getTile(x, y) {
        if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT)
            return undefined;
        const index = y * MAP_WIDTH + x;
        const tile = this.tiles[index];
        if (tile && tile.x === x && tile.y === y)
            return tile;
        return undefined;
    }
    getAllTiles() {
        return this.tiles;
    }
    // 获取2D格式的地形（用于网络传输）
    getTiles2D() {
        const result = [];
        for (let y = 0; y < MAP_HEIGHT; y++) {
            const row = [];
            for (let x = 0; x < MAP_WIDTH; x++) {
                const tile = this.tiles.find(t => t.x === x && t.y === y);
                row.push(tile || { x, y, type: 'grass' });
            }
            result.push(row);
        }
        return result;
    }
    getAllGroundObjects() {
        // 合并浆果数据到灌木
        const result = this.groundObjects.map(obj => {
            if (obj.type === 'bush') {
                const bush = this.bushes.find(b => b.x === obj.x && b.y === obj.y);
                if (bush) {
                    return {
                        ...obj,
                        berryCount: bush.berryCount,
                        maxBerries: bush.maxBerries,
                        hasBerries: bush.hasBerries
                    };
                }
            }
            // 其他物品（树枝、石头）返回quantity
            return obj;
        });
        return result;
    }
    addGroundObject(item) {
        this.groundObjects.push(item);
    }
    getSeason() {
        return this.season;
    }
    // 检查地形是否可通行
    isWalkable(x, y) {
        const tile = this.tiles.find(t => t.x === Math.floor(x) && t.y === Math.floor(y));
        if (!tile)
            return false;
        // 可通行地形
        const walkable = ['grass', 'plains', 'forest', 'desert', 'beach'];
        return walkable.includes(tile.type);
    }
    /**
     * 获取水源位置（用于AI决策）
     */
    getWaterSources() {
        const water = [];
        // 从地形找水源
        for (const tile of this.tiles) {
            if (tile.type === 'river' || tile.type === 'lake') {
                water.push({ x: tile.x, y: tile.y });
            }
        }
        return water;
    }
    // 获取指定位置的地形类型
    getTerrainAt(x, y) {
        const tile = this.tiles.find(t => t.x === Math.floor(x) && t.y === Math.floor(y));
        return tile?.type || null;
    }
    setSeason(season) {
        this.season = season;
    }
    getTick() {
        return this.tick;
    }
    incrementTick() {
        this.tick++;
    }
    getSeed() {
        return this.seed;
    }
    getWidth() {
        return MAP_WIDTH;
    }
    getHeight() {
        return MAP_HEIGHT;
    }
    getTileSize() {
        return TILE_SIZE;
    }
    // ========== Phase 1: 浆果采集系统 ==========
    /**
     * 获取所有灌木
     */
    getAllBushes() {
        return this.bushes;
    }
    /**
     * 获取有浆果的灌木
     */
    getBushesWithBerries() {
        return this.bushes.filter(b => b.hasBerries && b.berryCount > 0);
    }
    /**
     * 获取指定位置的灌木
     */
    getBushAt(x, y) {
        return this.bushes.find(b => b.x === x && b.y === y);
    }
    /**
     * 采集浆果
     * @param x 灌木位置x
     * @param y 灌木位置y
     * @returns 采集到的浆果数量
     */
    harvestBerry(x, y) {
        const bush = this.getBushAt(x, y);
        if (!bush || !bush.hasBerries || bush.berryCount <= 0) {
            return 0;
        }
        // 采集1-3个浆果（随机）
        const harvestAmount = Math.min(bush.berryCount, Math.floor(Math.random() * 3) + 1);
        bush.berryCount -= harvestAmount;
        bush.lastHarvest = this.tick;
        // 采完后自动释放预留
        if (bush.berryCount <= 0) {
            this.bushReservations.delete(bush.id);
        }
        return harvestAmount;
    }
    /**
     * 预留采集点
     */
    reserveBush(bushId, characterId) {
        if (this.bushReservations.has(bushId)) {
            return false; // 已被预留
        }
        this.bushReservations.set(bushId, characterId);
        return true;
    }
    /**
     * 释放采集点预留
     */
    releaseBush(bushId, characterId) {
        if (this.bushReservations.get(bushId) === characterId) {
            this.bushReservations.delete(bushId);
        }
    }
    /**
     * 检查采集点是否可用
     */
    isBushAvailable(bushId) {
        return !this.bushReservations.has(bushId);
    }
    /**
     * 检查灌木是否可以采集（距离判定）
     */
    canHarvest(x, y, targetX, targetY) {
        const dx = Math.abs(x - targetX);
        const dy = Math.abs(y - targetY);
        return dx <= 1 && dy <= 1; // 1格内可采集
    }
    /**
     * 更新季节对灌木的影响
     * 春：开花（无浆果）
     * 夏：有浆果
     * 秋：有浆果
     * 冬：无浆果
     */
    updateSeasonForBushes(season) {
        this.season = season;
        for (const bush of this.bushes) {
            if (season === 'spring') {
                bush.hasBerries = false; // 春天开花，不结果
                bush.berryCount = 0;
            }
            else if (season === 'summer' || season === 'autumn') {
                bush.hasBerries = true;
                // 重新生成浆果（如果之前没有的话）
                if (bush.berryCount === 0) {
                    bush.berryCount = Math.floor(Math.random() * 26) + 5; // 5-30
                }
            }
            else if (season === 'winter') {
                bush.hasBerries = false;
                bush.berryCount = 0;
            }
        }
    }
    /**
     * 获取食物来源位置（用于AI决策）
     * 只返回有浆果的灌木位置
     */
    getFoodSources() {
        const sources = [];
        // 添加有浆果的灌木
        const bushesWithBerries = this.getBushesWithBerries();
        for (const bush of bushesWithBerries) {
            sources.push({
                id: bush.id,
                x: bush.x,
                y: bush.y,
                type: 'bush',
                berryCount: bush.berryCount,
                maxBerries: bush.maxBerries,
                hasBerries: bush.hasBerries
            });
        }
        return sources;
    }
    /**
     * 获取指定位置的地面物品
     */
    getItemAt(x, y) {
        return this.groundObjects.find(obj => obj.x === x && obj.y === y);
    }
    /**
     * 拾取物品（树枝、石头等）
     * @param x 位置x
     * @param y 位置y
     * @returns 拾取到的物品信息，如果位置没有可拾取物品返回null
     */
    pickupItem(x, y) {
        const item = this.getItemAt(x, y);
        if (!item)
            return null;
        // 只有可拾取物品类型才能被拾取
        if (!['twig', 'stone', 'shell', 'herb'].includes(item.type)) {
            return null;
        }
        const qty = item.quantity || 1;
        // 从地面移除
        this.groundObjects = this.groundObjects.filter(obj => !(obj.x === x && obj.y === y));
        return { type: item.type, quantity: qty };
    }
    /**
     * 导出存档数据
     */
    toJSON() {
        return {
            groundObjects: this.groundObjects,
            bushes: this.bushes
        };
    }
    /**
     * 从存档数据恢复
     */
    fromJSON(data) {
        if (data.groundObjects) {
            this.groundObjects = data.groundObjects;
        }
        if (data.bushes) {
            this.bushes = data.bushes;
        }
    }
}
exports.WorldState = WorldState;

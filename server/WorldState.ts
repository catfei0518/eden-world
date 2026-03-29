/**
 * 伊甸世界 - 世界状态管理 v1.1
 * 
 * Phase 1: 浆果采集系统
 */

import type { TerrainType, TileData, GroundItemData, Season, BushData, ItemType } from './types/Protocol';

const MAP_WIDTH = 200;
const MAP_HEIGHT = 100;
const TILE_SIZE = 64;
const WORLD_SEED = 12345;

// Simplex噪声简化实现
function createNoise(seed: number) {
    // 简化的确定性噪声
    const permutation = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
    
    // 复制置换表
    const p = [...permutation, ...permutation];
    
    function fade(t: number) { return t * t * t * (t * (t * 6 - 15) + 10); }
    function lerp(a: number, b: number, t: number) { return a + t * (b - a); }
    function grad(hash: number, x: number, y: number) {
        const h = hash & 3;
        const u = h < 2 ? x : y;
        const v = h < 2 ? y : x;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }
    
    return function noise2D(x: number, y: number) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        x -= Math.floor(x);
        y -= Math.floor(y);
        
        const u = fade(x);
        const v = fade(y);
        
        const A = p[X] + Y;
        const B = p[X + 1] + Y;
        
        return lerp(
            lerp(grad(p[A], x, y), grad(p[B], x - 1, y), u),
            lerp(grad(p[A + 1], x, y - 1), grad(p[B + 1], x - 1, y - 1), u),
            v
        );
    };
}

interface NoiseResult {
    elevation: number;
    moisture: number;
}

export class WorldState {
    private tiles: TileData[] = [];
    private groundObjects: GroundItemData[] = [];
    private bushes: BushData[] = [];  // 灌木数据（包含浆果）
    private bushReservations: Map<string, string> = new Map(); // 灌木预留：bushId -> characterId
    private season: Season = 'spring';
    private tick: number = 0;
    private seed: number;
    
    constructor(seed: number = WORLD_SEED) {
        this.seed = seed;
        this.generateWorld();
    }
    
    private generateWorld(): void {
        const noise = createNoise(this.seed);
        const noise2 = createNoise(this.seed + 100);
        
        for (let y = 0; y < MAP_HEIGHT; y++) {
            for (let x = 0; x < MAP_WIDTH; x++) {
                // 只用一层基础噪声，不用detail
                const elevation = noise(x * 0.04, y * 0.04);
                const moisture = noise2(x * 0.06, y * 0.06);
                
                // 只在底部3行放置海洋
                if (y >= MAP_HEIGHT - 3) {
                    this.tiles.push({ x, y, type: 'ocean' });
                    continue;
                }
                
                // 河流检测（只在中间区域）
                const riverTile = this.isRiverTile(x, y);
                if (riverTile && y > 5 && y < MAP_HEIGHT - 5) {
                    this.tiles.push({ x, y, type: 'river' });
                    continue;
                }
                
                // 湖泊检测（只在中间区域）
                const lakeTile = this.isLakeArea(x, y);
                if (lakeTile && y > 10 && y < MAP_HEIGHT - 10) {
                    this.tiles.push({ x, y, type: 'lake' });
                    continue;
                }
                
                const terrain = this.getTerrainType(elevation, moisture);
                
                this.tiles.push({
                    x,
                    y,
                    type: terrain
                });
            }
        }
        
        // 生成地面物品
        this.generateGroundObjects();
    }
    
    // 检测是否为河流格子
    private isRiverTile(x: number, y: number): boolean {
        const noise = createNoise(this.seed + 500);
        // 从顶部到底部的河流，稍微窄一点
        const riverX = 0.5 + noise(y * 0.05, 0) * 0.2 - 0.1;
        const dist = Math.abs(x / MAP_WIDTH - riverX);
        return dist < 0.02;
    }
    
    // 检测是否为湖泊区域
    private isLakeArea(x: number, y: number): boolean {
        const noise = createNoise(this.seed + 600);
        // 湖泊位置
        const lakeX = 0.3 + noise(0, 0) * 0.4;
        const lakeY = 0.5 + noise(100, 100) * 0.3;
        const dx = x / MAP_WIDTH - lakeX;
        const dy = y / MAP_HEIGHT - lakeY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        return dist < 0.06;
    }
    
    private getTerrainType(elevation: number, moisture: number): TerrainType {
        // 归一化到0-1
        const e = (elevation + 1) / 2;
        const m = (moisture + 1) / 2;
        
        // 不再在这里产生海洋（海洋只在底部）
        if (e < 0.20) return 'beach';
        if (e > 0.80) return 'mountain';
        if (e > 0.70) return 'hill';
        
        if (m > 0.6 && e > 0.4) return 'forest';
        if (m < 0.3) return 'desert';
        if (m > 0.7 && e > 0.35) return 'swamp';
        
        return e > 0.45 ? 'grass' : 'plains';
    }
    
    private generateGroundObjects(): void {
        // 确定性随机
        const noise = createNoise(this.seed + 200);
        
        for (let y = 0; y < MAP_HEIGHT; y++) {
            for (let x = 0; x < MAP_WIDTH; x++) {
                const tile = this.getTile(x, y);
                if (!tile) continue;
                
                // 森林地形：每个格子都生成树（100%覆盖）
                if (tile.type === 'forest') {
                    // 确定性随机选择树种（1:5比例）
                    // 使用坐标生成确定性随机数
                    const hash = (x * 12345 + y * 67890 + this.seed) % 100;
                    // 约17%是果树(tree)，83%是森林树(forest_tree)
                    const treeType = hash < 17 ? 'tree' : 'forest_tree';
                    
                    this.groundObjects.push({
                        id: `tree_${x}_${y}`,
                        type: treeType,
                        x: x,
                        y: y,
                        terrain: 'forest'
                    });
                } else if (tile.type === 'grass' && Math.abs(noise(x * 0.3, y * 0.3)) < 0.05) {
                    // 灌木 - 保持在格子内（5%概率）
                    const bushId = `bush_${x}_${y}`;
                    this.groundObjects.push({
                        id: bushId,
                        type: 'bush',
                        x: x,
                        y: y,
                        terrain: 'grass'
                    });
                    
                    // 创建灌木浆果数据（Phase 1）
                    // 浆果数量：5-30个随机
                    const berryCount = Math.floor(Math.random() * 26) + 5; // 5-30
                    const maxBerries = 30; // 最大承载量
                    this.bushes.push({
                        id: bushId,
                        x: x,
                        y: y,
                        berryCount: berryCount,
                        maxBerries: maxBerries,
                        durability: 100,
                        lastHarvest: 0,
                        hasBerries: true  // 春夏秋有浆果
                    });
                } else if ((tile.type === 'mountain' || tile.type === 'hill') && Math.abs(noise(x * 0.4, y * 0.4)) < 0.08) {
                    // 石头 - 保持在格子内（8%概率）
                    this.groundObjects.push({
                        id: `rock_${x}_${y}`,
                        type: 'rock',
                        x: x,
                        y: y,
                        terrain: tile.type
                    });
                } else if (tile.type === 'beach' && Math.abs(noise(x * 0.6, y * 0.6)) < 0.02) {
                    // 贝壳 - 保持在格子内（2%概率）
                    this.groundObjects.push({
                        id: `shell_${x}_${y}`,
                        type: 'shell',
                        x: x,
                        y: y,
                        terrain: 'beach'
                    });
                } else if (tile.type === 'grass' && Math.abs(noise(x * 0.5, y * 0.5)) < 0.03) {
                    // 树枝 - 3%概率出现在草地上
                    const qty = Math.floor(Math.random() * 3) + 2; // 2-4个
                    this.groundObjects.push({
                        id: `twig_${x}_${y}`,
                        type: 'twig',
                        x: x,
                        y: y,
                        terrain: 'grass',
                        quantity: qty
                    });
                } else if ((tile.type === 'grass' || tile.type === 'plains') && Math.abs(noise(x * 0.7, y * 0.7)) < 0.02) {
                    // 石头 - 2%概率出现在草地/平原
                    const qty = Math.floor(Math.random() * 2) + 1; // 1-2个
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
    
    getTile(x: number, y: number): TileData | undefined {
        return this.tiles.find(t => t.x === x && t.y === y);
    }
    
    getAllTiles(): TileData[] {
        return this.tiles;
    }
    
    // 获取2D格式的地形（用于网络传输）
    getTiles2D(): TileData[][] {
        const result: TileData[][] = [];
        for (let y = 0; y < MAP_HEIGHT; y++) {
            const row: TileData[] = [];
            for (let x = 0; x < MAP_WIDTH; x++) {
                const tile = this.tiles.find(t => t.x === x && t.y === y);
                row.push(tile || { x, y, type: 'grass' as TerrainType });
            }
            result.push(row);
        }
        return result;
    }
    
    getAllGroundObjects(): GroundItemData[] {
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
    
    addGroundObject(item: GroundItemData): void {
        this.groundObjects.push(item);
    }
    
    getSeason(): Season {
        return this.season;
    }
    
    // 检查地形是否可通行
    isWalkable(x: number, y: number): boolean {
        const tile = this.tiles.find(t => t.x === Math.floor(x) && t.y === Math.floor(y));
        if (!tile) return false;
        
        // 可通行地形
        const walkable = ['grass', 'plains', 'forest', 'desert', 'beach'];
        return walkable.includes(tile.type);
    }
    
    // 获取指定位置的地形类型
    getTerrainAt(x: number, y: number): TerrainType | null {
        const tile = this.tiles.find(t => t.x === Math.floor(x) && t.y === Math.floor(y));
        return tile?.type || null;
    }
    
    setSeason(season: Season): void {
        this.season = season;
    }
    
    getTick(): number {
        return this.tick;
    }
    
    incrementTick(): void {
        this.tick++;
    }
    
    getSeed(): number {
        return this.seed;
    }
    
    getWidth(): number {
        return MAP_WIDTH;
    }
    
    getHeight(): number {
        return MAP_HEIGHT;
    }
    
    getTileSize(): number {
        return TILE_SIZE;
    }
    
    // ========== Phase 1: 浆果采集系统 ==========
    
    /**
     * 获取所有灌木
     */
    getAllBushes(): BushData[] {
        return this.bushes;
    }
    
    /**
     * 获取有浆果的灌木
     */
    getBushesWithBerries(): BushData[] {
        return this.bushes.filter(b => b.hasBerries && b.berryCount > 0);
    }
    
    /**
     * 获取指定位置的灌木
     */
    getBushAt(x: number, y: number): BushData | undefined {
        return this.bushes.find(b => b.x === x && b.y === y);
    }
    
    /**
     * 采集浆果
     * @param x 灌木位置x
     * @param y 灌木位置y
     * @returns 采集到的浆果数量
     */
    harvestBerry(x: number, y: number): number {
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
    reserveBush(bushId: string, characterId: string): boolean {
        if (this.bushReservations.has(bushId)) {
            return false; // 已被预留
        }
        this.bushReservations.set(bushId, characterId);
        return true;
    }
    
    /**
     * 释放采集点预留
     */
    releaseBush(bushId: string, characterId: string): void {
        if (this.bushReservations.get(bushId) === characterId) {
            this.bushReservations.delete(bushId);
        }
    }
    
    /**
     * 检查采集点是否可用
     */
    isBushAvailable(bushId: string): boolean {
        return !this.bushReservations.has(bushId);
    }
    
    /**
     * 检查灌木是否可以采集（距离判定）
     */
    canHarvest(x: number, y: number, targetX: number, targetY: number): boolean {
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
    updateSeasonForBushes(season: Season): void {
        this.season = season;
        for (const bush of this.bushes) {
            if (season === 'spring') {
                bush.hasBerries = false; // 春天开花，不结果
                bush.berryCount = 0;
            } else if (season === 'summer' || season === 'autumn') {
                bush.hasBerries = true;
                // 重新生成浆果（如果之前没有的话）
                if (bush.berryCount === 0) {
                    bush.berryCount = Math.floor(Math.random() * 26) + 5; // 5-30
                }
            } else if (season === 'winter') {
                bush.hasBerries = false;
                bush.berryCount = 0;
            }
        }
    }
    
    /**
     * 获取食物来源位置（用于AI决策）
     * 只返回有浆果的灌木位置
     */
    getFoodSources(): { id: string; x: number; y: number; type: string; berryCount?: number; maxBerries?: number; hasBerries?: boolean }[] {
        const sources: { id: string; x: number; y: number; type: string; berryCount?: number; maxBerries?: number; hasBerries?: boolean }[] = [];
        
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
    getItemAt(x: number, y: number): GroundItemData | undefined {
        return this.groundObjects.find(obj => obj.x === x && obj.y === y);
    }
    
    /**
     * 拾取物品（树枝、石头等）
     * @param x 位置x
     * @param y 位置y
     * @returns 拾取到的物品信息，如果位置没有可拾取物品返回null
     */
    pickupItem(x: number, y: number): { type: ItemType; quantity: number } | null {
        const item = this.getItemAt(x, y);
        if (!item) return null;
        
        // 只有可拾取物品类型才能被拾取
        if (!['twig', 'stone', 'shell', 'herb'].includes(item.type)) {
            return null;
        }
        
        const qty = item.quantity || 1;
        
        // 从地面移除
        this.groundObjects = this.groundObjects.filter(obj => !(obj.x === x && obj.y === y));
        
        return { type: item.type, quantity: qty };
    }
}

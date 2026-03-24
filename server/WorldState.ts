/**
 * 伊甸世界 - 世界状态管理
 */

import type { TerrainType, TileData, GroundItemData, Season } from './types/Protocol';

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
                    this.groundObjects.push({
                        id: `bush_${x}_${y}`,
                        type: 'bush',
                        x: x,
                        y: y,
                        terrain: 'grass'
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
        return this.groundObjects;
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
}

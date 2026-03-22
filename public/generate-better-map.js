/**
 * 生成更清晰的地图 - 使用大块区域
 */

const fs = require('fs');
const { GameMap } = require('../dist/MapGenerator');

// 地形颜色 (RGB)
const COLORS = {
    'ocean': [25, 80, 170],
    'lake': [40, 100, 190],
    'swamp': [50, 80, 60],
    'plain': [200, 180, 130],
    'grass': [80, 150, 60],
    'desert': [210, 180, 80],
    'forest': [25, 80, 30],
    'mountain': [100, 100, 100],
    'hill': [70, 90, 50],
    'cave': [50, 45, 45],
    'river': [50, 100, 180],
};

function generatePPM(map, TILE_SIZE) {
    const size = map.getSize();
    const width = size.width * TILE_SIZE;
    const height = size.height * TILE_SIZE;
    
    // PPM头
    let header = `P6\n${width} ${height}\n255\n`;
    let data = Buffer.alloc(width * height * 3);
    
    for (let y = 0; y < size.height; y++) {
        for (let py = 0; py < TILE_SIZE; py++) {
            for (let x = 0; x < size.width; x++) {
                const tile = map.getTile(x, y);
                const color = COLORS[tile.type] || [128, 128, 128];
                
                for (let px = 0; px < TILE_SIZE; px++) {
                    const idx = ((y * TILE_SIZE + py) * width + (x * TILE_SIZE + px)) * 3;
                    data[idx] = color[0];
                    data[idx + 1] = color[1];
                    data[idx + 2] = color[2];
                }
            }
        }
    }
    
    return Buffer.concat([Buffer.from(header), data]);
}

// 生成更大的地图，用更低的频率
const map = new GameMap(80, 40, 99999);
map.generate();

console.log('生成地图...');
console.log(map.printASCII());

// 生成PPM
const ppm = generatePPM(map, 10);

// 写入
fs.writeFileSync('public/better-map.ppm', ppm);
console.log('PPM已生成');

// 转换
const { execSync } = require('child_process');
try {
    execSync('ffmpeg -i public/better-map.ppm -y -frames:v 1 -pix_fmt rgb24 public/better-map.png 2>/dev/null', { stdio: 'pipe' });
    console.log('PNG已生成: public/better-map.png');
} catch (e) {}

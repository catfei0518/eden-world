/**
 * 生成PPM格式图片
 */

const fs = require('fs');
const { GameMap } = require('../dist/MapGenerator');

// 地形颜色 (RGB)
const COLORS = {
    'ocean': [30, 80, 180],
    'lake': [50, 100, 200],
    'swamp': [60, 90, 60],
    'plain': [220, 200, 150],
    'grass': [100, 180, 80],
    'desert': [230, 200, 100],
    'forest': [30, 100, 30],
    'mountain': [120, 120, 120],
    'hill': [90, 110, 60],
    'cave': [60, 50, 50],
    'river': [60, 120, 200],
};

function generatePPM(map, TILE_SIZE) {
    const size = map.getSize();
    const width = size.width * TILE_SIZE;
    const height = size.height * TILE_SIZE;
    
    // PPM头
    let header = `P6\n${width} ${height}\n255\n`;
    let data = Buffer.alloc(width * height * 3);
    
    let offset = 0;
    for (let y = 0; y < size.height; y++) {
        for (let py = 0; py < TILE_SIZE; py++) {
            for (let x = 0; x < size.width; x++) {
                const tile = map.getTile(x, y);
                const color = COLORS[tile.type] || [128, 128, 128];
                
                for (let px = 0; px < TILE_SIZE; px++) {
                    data[offset++] = color[0];
                    data[offset++] = color[1];
                    data[offset++] = color[2];
                }
            }
        }
    }
    
    return Buffer.concat([Buffer.from(header), data]);
}

// 生成地图
const map = new GameMap(100, 50, 12345);
map.generate();

console.log('生成地图...');

// 生成PPM
const ppm = generatePPM(map, 8);

// 写入
fs.writeFileSync('public/map-preview.ppm', ppm);

// 转换
const { execSync } = require('child_process');
try {
    execSync('ffmpeg -i public/map-preview.ppm -y -frames:v 1 public/map-preview.png', { stdio: 'pipe' });
    console.log('PNG已生成: public/map-preview.png');
} catch (e) {
    console.log('PPM已生成: public/map-preview.ppm');
}

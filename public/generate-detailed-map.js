/**
 * 生成细腻地图 - 每格2像素，更平滑
 */

const fs = require('fs');
const { GameMap } = require('../dist/MapGenerator');

// 地形颜色 (RGB) - 更细腻的渐变
const COLORS = {
    'ocean': [30, 90, 180],
    'lake': [50, 110, 200],
    'swamp': [60, 100, 70],
    'plain': [210, 190, 140],
    'grass': [90, 160, 70],
    'desert': [220, 190, 100],
    'forest': [35, 100, 40],
    'mountain': [110, 110, 110],
    'hill': [80, 100, 55],
    'cave': [55, 50, 50],
    'river': [60, 130, 210],
};

// 添加纹理变体
function getTileColor(type, x, y) {
    const base = COLORS[type] || [128, 128, 128];
    
    // 添加细微变化让地图更自然
    const variation = ((x * 7 + y * 13) % 20) - 10;
    
    return [
        Math.max(0, Math.min(255, base[0] + variation)),
        Math.max(0, Math.min(255, base[1] + variation)),
        Math.max(0, Math.min(255, base[2] + variation))
    ];
}

function generatePNG(map, TILE_SIZE) {
    const size = map.getSize();
    // 每格 TILE_SIZE 像素
    const width = size.width * TILE_SIZE;
    const height = size.height * TILE_SIZE;
    
    // PNG header
    const header = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
        (width >> 24) & 0xFF, (width >> 16) & 0xFF, (width >> 8) & 0xFF, width & 0xFF,
        (height >> 24) & 0xFF, (height >> 16) & 0xFF, (height >> 8) & 0xFF, height & 0xFF,
        0x08, 0x02, 0x00, 0x00, 0x00
    ]);
    
    // 简单未压缩PNG
    const raw = [];
    for (let y = 0; y < height; y++) {
        raw.push(0); // filter byte
        for (let x = 0; x < width; x++) {
            const tileX = Math.floor(x / TILE_SIZE);
            const tileY = Math.floor(y / TILE_SIZE);
            const tile = map.getTile(tileX, tileY);
            const color = getTileColor(tile.type, x, y);
            raw.push(color[0], color[1], color[2]);
        }
    }
    
    const zlib = require('zlib');
    const compressed = zlib.deflateSync(Buffer.from(raw));
    
    // 计算CRC
    function crc32(buf) {
        let crc = 0xFFFFFFFF;
        const table = [];
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            table[n] = c;
        }
        for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }
    
    function makeChunk(type, data) {
        const len = Buffer.alloc(4);
        len.writeUInt32BE(data.length);
        const typeData = Buffer.concat([Buffer.from(type), data]);
        const crc = Buffer.alloc(4);
        crc.writeUInt32BE(crc32(typeData));
        return Buffer.concat([len, typeData, crc]);
    }
    
    const idat = makeChunk('IDAT', compressed);
    const iend = makeChunk('IEND', Buffer.alloc(0));
    
    return Buffer.concat([header, idat, iend]);
}

// 生成地图 - 更大的地图，更细腻
const map = new GameMap(200, 100, 88888);
map.generate();

console.log('生成细腻地图...');

// 生成PNG - 每格4像素
const png = generatePNG(map, 4);

fs.writeFileSync('public/detailed-map.png', png);
console.log('PNG已生成: public/detailed-map.png');
console.log('尺寸: 800 x 400 像素');

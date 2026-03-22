/**
 * 地图预览生成器
 * 生成地图PNG图片
 */

const fs = require('fs');

// 地形颜色
const COLORS = {
    'ocean': [30, 144, 255],
    'lake': [65, 105, 225],
    'swamp': [47, 79, 79],
    'plain': [245, 222, 179],
    'grass': [144, 238, 144],
    'desert': [255, 215, 0],
    'forest': [34, 139, 34],
    'mountain': [128, 128, 128],
    'hill': [107, 142, 35],
    'cave': [74, 74, 74],
    'river': [0, 191, 255],
};

// 简单的PNG生成器
function createPNG(width, height, pixels) {
    // PNG文件头
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    
    // IHDR chunk
    const ihdr = createIHDR(width, height);
    
    // IDAT chunk (压缩的图像数据)
    const idat = createIDAT(width, height, pixels);
    
    // IEND chunk
    const iend = createIEND();
    
    return Buffer.concat([signature, ihdr, idat, iend]);
}

function createIHDR(width, height) {
    const data = Buffer.alloc(13);
    data.writeUInt32BE(width, 0);
    data.writeUInt32BE(height, 4);
    data[8] = 8;  // bit depth
    data[9] = 2;  // color type (RGB)
    data[10] = 0; // compression
    data[11] = 0; // filter
    data[12] = 0;  // interlace
    
    return createChunk('IHDR', data);
}

function createIDAT(width, height, pixels) {
    // 添加过滤字节和压缩
    const rawData = Buffer.alloc((width * 3 + 1) * height);
    
    for (let y = 0; y < height; y++) {
        rawData[y * (width * 3 + 1)] = 0; // 过滤字节
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            const pixel = pixels[idx];
            rawData[y * (width * 3 + 1) + 1 + x * 3] = pixel[0];
            rawData[y * (width * 3 + 1) + 1 + x * 3 + 1] = pixel[1];
            rawData[y * (width * 3 + 1) + 1 + x * 3 + 2] = pixel[2];
        }
    }
    
    const zlib = require('zlib');
    const compressed = zlib.deflateSync(rawData);
    
    return createChunk('IDAT', compressed);
}

function createIEND() {
    return createChunk('IEND', Buffer.alloc(0));
}

function createChunk(type, data) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    
    const typeBuffer = Buffer.from(type);
    const crcData = Buffer.concat([typeBuffer, data]);
    const crc = crc32(crcData);
    
    const crcBuffer = Buffer.alloc(4);
    crcBuffer.writeUInt32BE(crc >>> 0, 0);
    
    return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

// CRC32计算
function crc32(data) {
    let crc = 0xffffffff;
    const table = makeCRCTable();
    
    for (let i = 0; i < data.length; i++) {
        crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xff];
    }
    
    return crc ^ 0xffffffff;
}

function makeCRCTable() {
    const table = new Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = ((c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1));
        }
        table[n] = c;
    }
    return table;
}

// 测试生成
const width = 100;
const height = 50;
const pixels = [];

for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
        // 简单的噪声模拟
        const noise = Math.sin(x * 0.1) * Math.cos(y * 0.1) * 0.5 + 0.5;
        if (noise < 0.3) {
            pixels.push(COLORS.ocean);
        } else if (noise < 0.4) {
            pixels.push(COLORS.swamp);
        } else if (noise < 0.5) {
            pixels.push(COLORS.plain);
        } else if (noise < 0.7) {
            pixels.push(COLORS.grass);
        } else if (noise < 0.8) {
            pixels.push(COLORS.forest);
        } else if (noise < 0.9) {
            pixels.push(COLORS.hill);
        } else {
            pixels.push(COLORS.mountain);
        }
    }
}

const png = createPNG(width, height, pixels);
fs.writeFileSync('public/map-preview.png', png);

console.log('地图预览已生成: public/map-preview.png');

/**
 * 地图生成测试
 */

import { GameMap } from '../src/world/MapGenerator';

console.log('=== 地图生成测试 ===\n');

// 测试1：生成地图
console.log('测试1：生成地图');
const map = new GameMap(100, 50, 12345);
map.generate();
console.log('地图尺寸:', map.getSize());
console.log('');

// 测试2：打印ASCII预览
console.log('测试2：ASCII地图预览');
console.log(map.printASCII());
console.log('');

// 测试3：获取特定位置
console.log('测试3：获取特定位置');
const tile = map.getTile(50, 25);
if (tile) {
  console.log('位置(50,25):');
  console.log('  类型:', tile.type);
  console.log('  高度:', tile.height.toFixed(3));
  console.log('  湿度:', tile.moisture.toFixed(3));
  console.log('  温度:', tile.temperature.toFixed(3));
}
console.log('');

// 测试4：不同seed
console.log('测试4：不同seed');
const map2 = new GameMap(50, 20, 54321);
map2.generate();
console.log('Seed 54321:');
console.log(map2.printASCII());

console.log('=== 测试完成 ===');

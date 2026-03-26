/**
 * 确定性随机数生成
 * 用于客户端和服务器生成相同的地形/物品
 */

export function seededRandom(seed: number, x: number, y: number): number {
    const s = seed + x * 10000 + y;
    const rand = Math.sin(s) * 10000;
    return rand - Math.floor(rand);
}

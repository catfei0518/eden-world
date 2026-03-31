"use strict";
/**
 * 伊甸世界 - 游戏循环 v2.0
 *
 * 集成AI自动移动系统
 * 固定20 TPS (Tick Per Second)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameLoop = void 0;
class GameLoop {
    constructor(characterManager, worldState) {
        this.tickRate = 20; // 每秒20次
        this.tickInterval = 1000 / this.tickRate; // 50ms
        this.currentTick = 0;
        this.isRunning = false;
        this.intervalId = null;
        this.aiWorldState = null;
        this.tickCallbacks = [];
        // AI处理间隔（每2个tick处理一次，约10次/秒）
        this.aiProcessInterval = 2;
        this.characterManager = characterManager;
        this.worldState = worldState;
    }
    start() {
        if (this.isRunning)
            return;
        console.log(`🎮 游戏循环启动: ${this.tickRate} TPS (${this.tickInterval}ms/tick)`);
        this.isRunning = true;
        // 创建AI世界状态（地形+物品）
        this.aiWorldState = this.characterManager.createAIWorldState(this.worldState);
        this.intervalId = setInterval(() => {
            this.tick();
        }, this.tickInterval);
    }
    stop() {
        if (!this.isRunning)
            return;
        console.log('🛑 游戏循环停止');
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
    }
    tick() {
        this.currentTick++;
        // 1️⃣ AI决策 + 移动（每2个tick一次）
        if (this.currentTick % this.aiProcessInterval === 0 && this.aiWorldState) {
            this.characterManager.processAI(this.aiWorldState);
            // 调试：每100tick打印一次位置
            if (this.currentTick % 200 === 0) {
                const chars = this.characterManager.getAll();
                for (const char of chars) {
                    console.log(`📍 ${char.name}: (${char.x.toFixed(2)}, ${char.y.toFixed(2)}) - ${char.state} - 口渴:${char.thirst.toFixed(1)} 饥饿:${char.hunger.toFixed(1)}`);
                }
            }
        }
        // 2️⃣ 更新世界状态tick
        this.worldState.incrementTick();
        // 3️⃣ 触发回调（广播状态等）
        for (const callback of this.tickCallbacks) {
            callback(this.currentTick);
        }
    }
    /**
     * 刷新AI世界状态（当地图数据变化时调用）
     */
    refreshAIWorldState() {
        if (this.worldState) {
            this.aiWorldState = this.characterManager.createAIWorldState(this.worldState);
            console.log('🔄 AI世界状态已刷新');
        }
    }
    getCurrentTick() {
        return this.currentTick;
    }
    getTickRate() {
        return this.tickRate;
    }
    isActive() {
        return this.isRunning;
    }
    onTick(callback) {
        this.tickCallbacks.push(callback);
    }
    removeTickCallback(callback) {
        const index = this.tickCallbacks.indexOf(callback);
        if (index > -1) {
            this.tickCallbacks.splice(index, 1);
        }
    }
}
exports.GameLoop = GameLoop;

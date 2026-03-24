"use strict";
/**
 * 伊甸世界 - 游戏循环
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
        this.tickCallbacks = [];
        this.characterManager = characterManager;
        this.worldState = worldState;
    }
    start() {
        if (this.isRunning)
            return;
        console.log(`🎮 游戏循环启动: ${this.tickRate} TPS (${this.tickInterval}ms/tick)`);
        this.isRunning = true;
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
        // 1. 处理角色资源消耗
        this.processResourceConsumption();
        // 2. 执行AI决策（预留接口）
        // this.processAI();
        // 3. 触发回调（广播状态等）
        for (const callback of this.tickCallbacks) {
            callback(this.currentTick);
        }
        // 4. 更新世界状态tick
        this.worldState.incrementTick();
    }
    processResourceConsumption() {
        // 模拟资源消耗
        const characters = this.characterManager.getAll();
        for (const char of characters) {
            // 基础消耗
            const hungerDelta = -0.05;
            const thirstDelta = -0.08;
            const energyDelta = -0.01;
            this.characterManager.consumeResources(char.id, hungerDelta, thirstDelta, energyDelta);
            // 饥饿时动作变化
            if (char.hunger < 20) {
                this.characterManager.updateCharacterAction(char.id, 'hungry');
            }
            if (char.thirst < 20) {
                this.characterManager.updateCharacterAction(char.id, 'thirsty');
            }
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

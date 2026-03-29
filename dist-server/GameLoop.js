"use strict";
/**
 * 伊甸世界 - 游戏循环 v3.0
 * 
 * 集成时间管理系统 (宪法时间系统)
 * - 1 现实秒 = 1 游戏分钟
 * - 支持时间档位: 1x / 10x / 60x / 暂停
 * - 集成季节和昼夜系统
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameLoop = void 0;
const TimeManager_1 = require("./TimeManager");
class GameLoop {
    constructor(characterManager, worldState) {
        this.characterManager = characterManager;
        this.worldState = worldState;
        this.tickRate = 20; // 固定20 TPS作为心跳
        this.tickInterval = 1000 / this.tickRate; // 50ms
        this.currentTick = 0;
        this.isRunning = false;
        this.intervalId = null;
        this.aiWorldState = null;
        this.tickCallbacks = [];
        this.aiProcessInterval = 2;
        // 时间管理器
        this.timeManager = new TimeManager_1.TimeManager();
        // 注册时间事件
        this.setupTimeEvents();
    }

    setupTimeEvents() {
        // 季节变化事件 - 更新WorldState
        this.timeManager.on('onSeasonChange', (data) => {
            console.log(`🍃 游戏循环收到季节变化: ${data.season}`);
            if (this.worldState) {
                this.worldState.setSeason(data.season);
            }
        });
    }

    start() {
        if (this.isRunning)
            return;
        console.log(`🎮 游戏循环启动: ${this.tickRate} TPS (${this.tickInterval}ms/tick)`);
        console.log(`⏰ 时间系统: ${this.timeManager.getFullTimeString().seasonName} 第${this.timeManager.getFullTimeString().day}天 ${this.timeManager.getTimeString()}`);
        this.isRunning = true;
        // 创建AI世界状态
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
        // 计算真实流逝时间
        const now = Date.now();
        const deltaMs = now - (this.lastTickTime || now);
        this.lastTickTime = now;
        
        // 更新游戏时间
        this.timeManager.advance(deltaMs);
        
        // AI决策 + 移动（每2个tick一次）
        if (this.currentTick % this.aiProcessInterval === 0 && this.aiWorldState) {
            this.characterManager.processAI(this.aiWorldState);
            // 调试：每100tick打印一次时间
            if (this.currentTick % 200 === 0) {
                const timeInfo = this.timeManager.getFullTimeString();
                const chars = this.characterManager.getAll();
                console.log(`⏰ ${timeInfo.seasonEmoji} ${timeInfo.seasonName}第${timeInfo.day}天 ${timeInfo.timeString} ${timeInfo.periodEmoji}${timeInfo.periodName}`);
                for (const char of chars) {
                    console.log(`  📍 ${char.name}: (${char.x.toFixed(1)}, ${char.y.toFixed(1)}) ${char.state} 饥饿:${char.hunger?.toFixed?.(1) || 'N/A'} 口渴:${char.thirst?.toFixed?.(1) || 'N/A'}`);
                }
            }
        }
        
        // 更新世界状态tick
        this.worldState.incrementTick();
        
        // 触发回调
        for (const callback of this.tickCallbacks) {
            callback(this.currentTick);
        }
    }

    /**
     * 设置时间档位
     * @param {number} speed - 1=正常, 10=10倍, 60=60倍, 0=暂停
     */
    setTimeSpeed(speed) {
        this.timeManager.setTimeSpeed(speed);
    }

    /**
     * 获取当前时间档位
     */
    getTimeSpeed() {
        return this.timeManager.getTimeSpeed();
    }

    /**
     * 获取时间管理器
     */
    getTimeManager() {
        return this.timeManager;
    }

    /**
     * 获取完整时间信息
     */
    getTimeInfo() {
        return this.timeManager.getFullTimeString();
    }

    /**
     * 刷新AI世界状态
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

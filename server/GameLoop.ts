/**
 * 伊甸世界 - 游戏循环
 * 固定20 TPS (Tick Per Second)
 */

import type { CharacterManager } from './CharacterManager';
import type { WorldState } from './WorldState';

export type TickCallback = (tick: number) => void;

export class GameLoop {
    private tickRate: number = 20;  // 每秒20次
    private tickInterval: number = 1000 / this.tickRate;  // 50ms
    private currentTick: number = 0;
    private isRunning: boolean = false;
    private intervalId: NodeJS.Timeout | null = null;
    
    private characterManager: CharacterManager;
    private worldState: WorldState;
    private tickCallbacks: TickCallback[] = [];
    
    constructor(characterManager: CharacterManager, worldState: WorldState) {
        this.characterManager = characterManager;
        this.worldState = worldState;
    }
    
    start(): void {
        if (this.isRunning) return;
        
        console.log(`🎮 游戏循环启动: ${this.tickRate} TPS (${this.tickInterval}ms/tick)`);
        this.isRunning = true;
        
        this.intervalId = setInterval(() => {
            this.tick();
        }, this.tickInterval);
    }
    
    stop(): void {
        if (!this.isRunning) return;
        
        console.log('🛑 游戏循环停止');
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
    }
    
    private tick(): void {
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
    
    private processResourceConsumption(): void {
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
    
    getCurrentTick(): number {
        return this.currentTick;
    }
    
    getTickRate(): number {
        return this.tickRate;
    }
    
    isActive(): boolean {
        return this.isRunning;
    }
    
    onTick(callback: TickCallback): void {
        this.tickCallbacks.push(callback);
    }
    
    removeTickCallback(callback: TickCallback): void {
        const index = this.tickCallbacks.indexOf(callback);
        if (index > -1) {
            this.tickCallbacks.splice(index, 1);
        }
    }
}

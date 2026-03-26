/**
 * 伊甸世界 - 游戏循环 v2.0
 * 
 * 集成AI自动移动系统
 * 固定20 TPS (Tick Per Second)
 */

import type { CharacterManager } from './CharacterManager';
import type { WorldState } from './WorldState';
import type { ServerWorldState } from './AICharacter';

export type TickCallback = (tick: number) => void;

export class GameLoop {
    private tickRate: number = 20;  // 每秒20次
    private tickInterval: number = 1000 / this.tickRate;  // 50ms
    private currentTick: number = 0;
    private isRunning: boolean = false;
    private intervalId: NodeJS.Timeout | null = null;
    
    private characterManager: CharacterManager;
    private worldState: WorldState;
    private aiWorldState: ServerWorldState | null = null;
    private tickCallbacks: TickCallback[] = [];
    
    // AI处理间隔（每2个tick处理一次，约10次/秒）
    private aiProcessInterval: number = 2;
    
    constructor(characterManager: CharacterManager, worldState: WorldState) {
        this.characterManager = characterManager;
        this.worldState = worldState;
    }
    
    start(): void {
        if (this.isRunning) return;
        
        console.log(`🎮 游戏循环启动: ${this.tickRate} TPS (${this.tickInterval}ms/tick)`);
        this.isRunning = true;
        
        // 创建AI世界状态（地形+物品）
        this.aiWorldState = this.characterManager.createAIWorldState(this.worldState);
        
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
    refreshAIWorldState(): void {
        if (this.worldState) {
            this.aiWorldState = this.characterManager.createAIWorldState(this.worldState);
            console.log('🔄 AI世界状态已刷新');
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

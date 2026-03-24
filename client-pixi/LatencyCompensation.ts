/**
 * Latency Compensation 客户端实现
 * 
 * 1. Client-Side Prediction: 立即响应玩家输入
 * 2. Server Reconciliation: 收到服务器确认后校正
 * 3. Entity Interpolation: 其他玩家平滑移动
 */

// 确定性随机（与服务器相同）
export function seededRandom(seed: number, x: number, y: number): number {
    const s = seed + x * 10000 + y;
    const rand = Math.sin(s) * 10000;
    return rand - Math.floor(rand);
}

// 位置历史记录（用于插值）
export interface PositionRecord {
    timestamp: number;
    x: number;
    y: number;
    targetX: number | null;
    targetY: number | null;
}

// 输入记录
export interface InputRecord {
    seq: number;
    input: any;
    timestamp: number;
    predictedX: number;
    predictedY: number;
}

// Latency Compensation 管理器
export class LatencyCompensation {
    // 序列号
    private inputSequence: number = 0;
    
    // 本地玩家输入队列（待确认）
    private pendingInputs: InputRecord[] = [];
    
    // 其他玩家位置历史
    private positionHistory: Map<string, PositionRecord[]> = new Map();
    
    // 最后确认的服务器状态
    private lastConfirmedState: any = null;
    
    // 插值延迟（ms）- 显示其他玩家"过去"的位置
    private INTERPOLATION_DELAY: number = 100;
    
    // 序列号计时器
    public getNextSeq(): number {
        return ++this.inputSequence;
    }
    
    // 保存待确认的输入
    public saveInput(input: any, predictedX: number, predictedY: number): number {
        const seq = this.getNextSeq();
        this.pendingInputs.push({
            seq,
            input,
            timestamp: Date.now(),
            predictedX,
            predictedY
        });
        return seq;
    }
    
    // 处理服务器输入确认
    public acknowledgeInput(seq: number): void {
        // 丢弃已确认的输入
        this.pendingInputs = this.pendingInputs.filter(i => i.seq > seq);
    }
    
    // 服务器状态更新 - 用于协调
    public updateWithServerState(state: any): void {
        if (!state) return;
        
        this.lastConfirmedState = state;
        
        // 确认输入
        if (state.lastProcessedInput !== undefined) {
            this.acknowledgeInput(state.lastProcessedInput);
        }
        
        // 记录其他玩家位置历史
        for (const char of state.characters || []) {
            if (char.id === this.localPlayerId) continue;  // 跳过本地玩家
            
            const history = this.positionHistory.get(char.id) || [];
            history.push({
                timestamp: state.timestamp || Date.now(),
                x: char.x,
                y: char.y,
                targetX: char.targetX,
                targetY: char.targetY
            });
            
            // 只保留最近2秒数据
            const cutoff = Date.now() - 2000;
            while (history.length > 0 && history[0].timestamp < cutoff) {
                history.shift();
            }
            
            this.positionHistory.set(char.id, history);
        }
    }
    
    // 获取校正后的本地玩家位置
    public getReconciledPosition(currentX: number, currentY: number): { x: number, y: number } {
        if (!this.lastConfirmedState) {
            return { x: currentX, y: currentY };
        }
        
        // 从最后确认的状态开始
        let x = this.lastConfirmedState.x;
        let y = this.lastConfirmedState.y;
        
        // 重放未确认的输入
        for (const record of this.pendingInputs) {
            if (record.input && record.input.action === 'move') {
                x = record.input.targetX;
                y = record.input.targetY;
            }
        }
        
        return { x, y };
    }
    
    // 获取插值后的其他玩家位置
    public getInterpolatedPosition(playerId: string): { x: number, y: number, targetX: number | null, targetY: number | null } | null {
        const history = this.positionHistory.get(playerId);
        if (!history || history.length < 2) return null;
        
        // 显示"过去"的位置
        const renderTime = Date.now() - this.INTERPOLATION_DELAY;
        
        // 找到时间窗口
        let before: PositionRecord | null = null;
        let after: PositionRecord | null = null;
        
        for (let i = 0; i < history.length; i++) {
            if (history[i].timestamp <= renderTime) {
                before = history[i];
            }
            if (history[i].timestamp > renderTime && !after) {
                after = history[i];
                break;
            }
        }
        
        if (!before) before = history[0];
        if (!after) after = before;
        
        // 线性插值
        const timeSpan = after.timestamp - before.timestamp;
        const t = timeSpan > 0 ? (renderTime - before.timestamp) / timeSpan : 0;
        
        return {
            x: before.x + (after.x - before.x) * t,
            y: before.y + (after.y - before.y) * t,
            targetX: after.targetX,
            targetY: after.targetY
        };
    }
    
    // 预测移动（与服务器相同逻辑）
    public predictMove(
        x: number, 
        y: number, 
        targetX: number | null, 
        targetY: number | null, 
        speed: number,
        deltaTime: number
    ): { x: number, y: number, targetX: number | null, targetY: number | null } {
        if (targetX === null || targetY === null) {
            return { x, y, targetX: null, targetY: null };
        }
        
        const dx = targetX - x;
        const dy = targetY - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 0.1) {
            return { x: targetX, y: targetY, targetX: null, targetY: null };
        }
        
        const moveSpeed = speed * deltaTime * 20;  // 标准化速度
        if (dist <= moveSpeed) {
            return { x: targetX, y: targetY, targetX: null, targetY: null };
        }
        
        return {
            x: x + (dx / dist) * moveSpeed,
            y: y + (dy / dist) * moveSpeed,
            targetX,
            targetY
        };
    }
    
    public setLocalPlayerId(id: string): void {
        this.localPlayerId = id;
    }
    
    private localPlayerId: string = '';
    
    // 重置状态（用于重连时）
    public reset(): void {
        this.pendingInputs = [];
        this.positionHistory.clear();
        this.lastConfirmedState = null;
    }
}

// 导出单例
export const latencyComp = new LatencyCompensation();

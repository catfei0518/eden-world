/**
 * LLM角色控制器
 * 管理使用LLM控制的角色（亚当、夏娃等）
 */

import { Character } from '../entities/Character';

interface LLMAction {
    action: string;
    reason?: string;
}

export class LLMController {
    private ollamaUrl: string = '/api/llm';
    private model: string = 'qwen3.5:2b';
    private characters: Map<string, Character> = new Map();
    private lastDecision: Map<string, number> = new Map();
    private decisionInterval: number = 3000;  // 3秒决策一次
    
    // 可用动作
    private actions = [
        '寻找食物', '寻找水源', '吃东西', '喝水', 
        '休息', '探索', '闲置'
    ];
    
    /**
     * 添加角色到LLM控制
     */
    addCharacter(char: Character): void {
        char.useLLM = true;
        this.characters.set(char.id, char);
        
        // 美化的启动日志
        console.log('%c╔═══════════════════════════════════════╗', 'color: #4CAF50; font-weight: bold');
        console.log(`%c║  🤖 ${char.name} 已启用LLM控制             ║`, 'color: #4CAF50; font-weight: bold');
        console.log('%c╚═══════════════════════════════════════╝', 'color: #4CAF50; font-weight: bold');
        console.log('%c   模型: qwen3.5:2b --think=false', 'color: #888');
        console.log('%c   决策间隔: 3秒/次', 'color: #888');
        console.log('%c─────────────────────────────────────────', 'color: #333');
    }
    
    /**
     * 移除角色从LLM控制
     */
    removeCharacter(charId: string): void {
        const char = this.characters.get(charId);
        if (char) {
            char.useLLM = false;
            this.characters.delete(charId);
        }
    }
    
    /**
     * 更新所有LLM角色
     */
    async update(world: any): Promise<void> {
        const now = Date.now();
        
        for (const [id, char] of this.characters) {
            // 检查冷却
            const last = this.lastDecision.get(id) || 0;
            if (now - last < this.decisionInterval) {
                continue;
            }
            
            // 调用LLM决策
            try {
                const decision = await this.getDecision(char, world);
                if (decision) {
                    this.executeDecision(char, decision, world);
                    this.lastDecision.set(id, now);
                }
            } catch (error) {
                console.error(`LLM决策失败 for ${char.name}:`, error);
            }
        }
    }
    
    /**
     * 获取LLM决策
     */
    private async getDecision(char: Character, world: any): Promise<LLMAction | null> {
        const prompt = this.buildPrompt(char, world);
        
        // 记录思考开始
        const startTime = Date.now();
        console.log(`%c🤖 ${char.name} → 思考中...`, 'color: #4CAF50; font-weight: bold');
        console.log(`%c   📊 状态: 饥饿${char.hungerPercent}% | 口渴${char.thirstPercent}% | 精力${Math.round(char.energy/5*100)}%`, 'color: #666');
        
        try {
            // 超时控制：30秒（Ollama响应较慢）
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);
            
            const response = await fetch(`${this.ollamaUrl}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.model,
                    prompt: prompt,
                    think: false,
                    options: {
                        temperature: 0.1,
                        num_predict: 50
                    },
                    stream: false
                }),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`Ollama错误: ${response.status}`);
            }
            
            const data = await response.json();
            const elapsed = Date.now() - startTime;
            const result = this.parseResponse(data.response, char);
            
            // 记录思考结果
            console.log(`%c✅ ${char.name} → 决策: ${result.action} (${elapsed}ms)`, 'color: #2196F3; font-weight: bold');
            console.log(`%c   📝 原始响应: ${data.response.substring(0, 80)}`, 'color: #888');
            
            return result;
        } catch (error: any) {
            const elapsed = Date.now() - startTime;
            if (error.name === 'AbortError') {
                console.log(`%c⏱️ ${char.name} → LLM超时 (${elapsed}ms)`, 'color: #FF9800');
            } else {
                console.error(`%c❌ ${char.name} → LLM失败: ${error.message}`, 'color: #f44336');
            }
            return null;
        }
    }
    
    /**
     * 构建提示词
     */
    private buildPrompt(char: Character, world: any): string {
        const dna = char.dna.getPhenotype();
        const hunger = char.hungerPercent;
        const thirst = char.thirstPercent;
        const energy = Math.round(char.energy / 5 * 100);
        const health = Math.round(char.health);
        
        // 性格描述
        const bravery = dna.bravery > 0.6 ? '勇敢' : '谨慎';
        const aggression = dna.aggression > 0.6 ? '冲动' : '冷静';
        
        // 附近资源
        const foods = world.nearbyFood || [];
        const waters = world.nearbyWater || [];
        
        let foodInfo = '无';
        if (foods.length > 0) {
            const nearest = foods[0];
            const dist = Math.sqrt(
                Math.pow(nearest.position.x - char.x, 2) + 
                Math.pow(nearest.position.y - char.y, 2)
            ).toFixed(1);
            foodInfo = `${nearest.type} (距离${dist})`;
        }
        
        let waterInfo = '无';
        if (waters.length > 0) {
            const nearest = waters[0];
            const dist = Math.sqrt(
                Math.pow(nearest.position.x - char.x, 2) + 
                Math.pow(nearest.position.y - char.y, 2)
            ).toFixed(1);
            waterInfo = `${nearest.type} (距离${dist})`;
        }
        
        return `你是${char.name}，一个${bravery}而${aggression}的原始人。

当前状态：
- 饥饿：${hunger}% (0%=饿死, 100%=吃饱)
- 口渴：${thirst}% (0%=渴死, 100%=喝足)
- 精力：${energy}%
- 生命：${health}%

环境信息：
- 最近食物：${foodInfo}
- 最近水源：${waterInfo}

可选动作：寻找食物、寻找水源、吃东西、喝水、休息、探索、闲置

根据当前状态选择最合适的动作。只输出JSON：
{"action":"动作名"}`;
    }
    
    /**
     * 解析响应
     */
    private parseResponse(response: string, char: Character): LLMAction {
        // 提取JSON
        const jsonMatch = response.match(/\{[^}]+\}/);
        if (jsonMatch) {
            try {
                const json = JSON.parse(jsonMatch[0]);
                if (json.action && this.actions.includes(json.action)) {
                    char.lastLLMDecision = `${json.action}: ${json.reason || ''}`;
                    return { action: json.action };
                }
            } catch (e) {
                // 解析失败
            }
        }
        
        // 回退：关键词匹配
        const lower = response.toLowerCase();
        for (const action of this.actions) {
            if (lower.includes(action)) {
                char.lastLLMDecision = `${action}`;
                return { action };
            }
        }
        
        return { action: '闲置' };
    }
    
    /**
     * 执行决策
     */
    private executeDecision(char: Character, decision: LLMAction, world: any): void {
        char.action = decision.action;
        
        switch (decision.action) {
            case '寻找食物':
                this.goToNearest(char, world.nearbyFood);
                const foodTarget = char.target ? ` → (${char.target.x.toFixed(1)}, ${char.target.y.toFixed(1)})` : ' (无目标)';
                console.log(`%c   📍 目标: 食物${foodTarget}`, 'color: #FF9800');
                break;
            case '寻找水源':
                this.goToNearest(char, world.nearbyWater);
                const waterTarget = char.target ? ` → (${char.target.x.toFixed(1)}, ${char.target.y.toFixed(1)})` : ' (无目标)';
                console.log(`%c   📍 目标: 水源${waterTarget}`, 'color: #2196F3');
                break;
            case '休息':
                console.log(`%c   💤 休息恢复精力`, 'color: #9C27B0');
                break;
            case '吃东西':
                console.log(`%c   🍖 吃东西`, 'color: #E91E63');
                break;
            case '喝水':
                console.log(`%c   💧 喝水`, 'color: #03A9F4');
                break;
            case '探索':
                console.log(`%c   🧭 探索周围`, 'color: #4CAF50');
                break;
            case '闲置':
            default:
                char.target = null;
                console.log(`%c   ⏸️ 闲置`, 'color: #757575');
                break;
        }
        
        // 记录动作变化
        console.log(`%c─────────────────────────────────`, 'color: #333');
    }
    
    /**
     * 前往最近的物品
     */
    private goToNearest(char: Character, items: any[]): void {
        if (!items || items.length === 0) {
            char.target = null;
            return;
        }
        
        // 找最近的一个
        let nearest = items[0];
        let minDist = Infinity;
        
        for (const item of items) {
            const dist = Math.sqrt(
                Math.pow(item.position.x - char.x, 2) + 
                Math.pow(item.position.y - char.y, 2)
            );
            if (dist < minDist) {
                minDist = dist;
                nearest = item;
            }
        }
        
        if (nearest) {
            char.target = { x: nearest.position.x, y: nearest.position.y };
        }
    }
}

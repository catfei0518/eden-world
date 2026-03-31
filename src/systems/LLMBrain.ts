/**
 * LLM大脑系统 - 使用Ollama控制角色决策
 */

import { Character } from '../entities/Character';
import { WorldState } from './needs/NeedsCalculator';

interface LLMDecision {
    action: string;
    targetX?: number;
    targetY?: number;
    reason?: string;
}

export class LLMBrain {
    private ollamaUrl: string = 'http://localhost:11434';
    private model: string = 'qwen3.5:2b';
    private cooldown: Map<string, number> = new Map();  // 角色决策冷却
    private cooldowMs: number = 5000;  // 5秒决策一次
    
    // 可用动作列表
    private availableActions = [
        '寻找食物', '寻找水源', '吃东西', '喝水', 
        '休息', '探索', '攻击', '逃跑', '闲置'
    ];
    
    // 动作翻译映射（英文→中文）
    private actionTranslations: Record<string, string> = {
        'find_food': '寻找食物',
        'find water': '寻找水源',
        'seek_food': '寻找食物',
        'seek_water': '寻找水源',
        'seek water': '寻找水源',
        'seek food': '寻找食物',
        'find food': '寻找食物',
        'eat': '吃东西',
        'eating': '吃东西',
        'drink': '喝水',
        'drinking': '喝水',
        'rest': '休息',
        'resting': '休息',
        'explore': '探索',
        'exploring': '探索',
        'wander': '探索',
        'wandering': '探索',
        'idle': '闲置',
        'idling': '闲置',
        'attack': '攻击',
        'attacking': '攻击',
        'flee': '逃跑',
        'fleeing': '逃跑',
        'run': '逃跑',
        'running': '逃跑'
    };
    
    /**
     * 翻译动作（确保中文显示）
     */
    private translateAction(action: string): string {
        // 如果已经是中文动作，直接返回
        if (this.availableActions.includes(action)) {
            return action;
        }
        // 尝试翻译
        const translated = this.actionTranslations[action.toLowerCase()];
        if (translated) {
            return translated;
        }
        // 无法翻译，返回默认
        console.warn(`⚠️ 未知动作: ${action}，使用默认"闲置"`);
        return '闲置';
    }
    
    /**
     * 决定角色动作
     */
    async decide(char: Character, world: WorldState): Promise<LLMDecision | null> {
        // 冷却检查
        const lastDecide = this.cooldown.get(char.id) || 0;
        if (Date.now() - lastDecide < this.cooldowMs) {
            return null;  // 还在冷却中
        }
        
        // 构建提示
        const prompt = this.buildPrompt(char, world);
        
        try {
            const response = await this.callOllama(prompt);
            const decision = this.parseResponse(response);
            
            // 设置冷却
            this.cooldown.set(char.id, Date.now());
            
            return decision;
        } catch (error) {
            console.error(`LLM决策失败: ${error}`);
            return null;
        }
    }
    
    /**
     * 构建提示词
     */
    private buildPrompt(char: Character, world: WorldState): string {
        // 获取性格描述
        const personality = this.getPersonality(char);
        const hunger = char.hungerPercent;
        const thirst = char.thirstPercent;
        const energy = Math.round(char.energy / 5 * 100);
        const health = Math.round(char.health);
        
        // 附近资源
        const nearbyFood = world.nearbyFood.length;
        const nearbyWater = world.nearbyWater.length;
        const nearbyPlayers = world.nearbyIndividuals;
        const threats = world.threats?.length || 0;
        
        // 手中物品
        const heldItem = char.heldItem || '无';
        
        return `你是${char.name}，一个${personality}的人。

当前状态：
- 饥饿：${hunger}%
- 口渴：${thirst}%
- 精力：${energy}%
- 生命：${health}%
- 手中物品：${heldItem}

环境：
- 附近食物：${nearbyFood}处
- 附近水源：${nearbyWater}处
- 附近威胁：${threats}个
- 附近其他角色：${nearbyPlayers}个

可选动作：${this.availableActions.join('、')}

请根据当前状态做出决策。只输出JSON格式：
{"action":"动作名","reason":"原因"}`;
    }
    
    /**
     * 调用Ollama
     */
    private async callOllama(prompt: string): Promise<string> {
        const response = await fetch(`${this.ollamaUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: this.model,
                prompt: prompt,
                options: {
                    temperature: 0.1,
                    num_predict: 100  // 限制输出长度
                },
                stream: false
            })
        });
        
        if (!response.ok) {
            throw new Error(`Ollama API错误: ${response.status}`);
        }
        
        const data = await response.json();
        return data.response;
    }
    
    /**
     * 解析响应
     */
    private parseResponse(response: string): LLMDecision {
        try {
            // 尝试提取JSON
            const jsonMatch = response.match(/\{[^}]+\}/);
            if (jsonMatch) {
                const json = JSON.parse(jsonMatch[0]);
                return {
                    action: json.action || '闲置',
                    reason: json.reason || ''
                };
            }
        } catch (e) {
            // JSON解析失败，尝试匹配动作关键词
        }
        
        // 回退：关键词匹配
        const lowerResponse = response.toLowerCase();
        for (const action of this.availableActions) {
            if (lowerResponse.includes(action)) {
                return { action, reason: response };
            }
        }
        
        return { action: '闲置', reason: response };
    }
    
    /**
     * 获取角色性格描述
     */
    private getPersonality(char: Character): string {
        const dna = char.dna.getPhenotype();
        
        const bravery = dna.bravery > 0.6 ? '勇敢' : '胆小';
        const aggression = dna.aggression > 0.6 ? '攻击性强' : '温和';
        const curiosity = dna.curiosity > 0.6 ? '好奇心强' : '保守';
        
        return `${bravery}、${aggression}、${curiosity}的`;
    }
    
    /**
     * 执行决策
     */
    executeDecision(char: Character, decision: LLMDecision): void {
        // 翻译动作确保中文显示
        char.action = this.translateAction(decision.action);
        
        // 根据动作设置目标
        switch (char.action) {
            case '寻找食物':
                this.goToFood(char);
                break;
            case '寻找水源':
                this.goToWater(char);
                break;
            case '休息':
                char.energy = Math.min(5, char.energy + 1);
                break;
            case '闲置':
            case '吃东西':
            case '喝水':
            default:
                // 不设置移动目标
                break;
        }
    }
    
    /**
     * 前往食物
     */
    private goToFood(char: Character): void {
        // 这个需要访问world，但decide方法里有
        // 暂时留空，在GameApp层处理
    }
    
    /**
     * 前往水源
     */
    private goToWater(char: Character): void {
        // 同上
    }
}

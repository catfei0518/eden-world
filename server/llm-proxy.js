/**
 * LLM代理 - 调用Ollama
 */

const OLLAMA_URL = 'http://localhost:11434';

class LLMProxy {
    constructor() {
        this.cache = new Map();
    }
    
    async generate({ model = 'qwen3.5:2b', prompt, think = false, options = {} }) {
        const startTime = Date.now();
        
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);
            
            const response = await fetch(`${OLLAMA_URL}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: model,
                    prompt: prompt,
                    think: think,
                    options: {
                        temperature: options.temperature || 0.1,
                        num_predict: options.num_predict || 100
                    },
                    stream: false
                }),
                signal: controller.signal
            });
            
            clearTimeout(timeout);
            
            if (!response.ok) {
                throw new Error(`Ollama错误: ${response.status}`);
            }
            
            const data = await response.json();
            
            return {
                success: true,
                response: data.response,
                duration: Date.now() - startTime,
                model: model
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                duration: Date.now() - startTime
            };
        }
    }
    
    // 角色决策
    async decide(character, worldState) {
        const prompt = this.buildPrompt(character, worldState);
        const result = await this.generate({
            prompt: prompt,
            think: false,
            options: { num_predict: 50 }
        });
        
        if (result.success) {
            return this.parseDecision(result.response);
        }
        
        return { action: '闲置', reason: 'LLM失败' };
    }
    
    buildPrompt(character, worldState) {
        const dna = character.dna;
        const hunger = character.hungerPercent;
        const thirst = character.thirstPercent;
        const energy = Math.round((character.energy / 5) * 100);
        
        const bravery = dna.bravery > 0.6 ? '勇敢' : '谨慎';
        const aggression = dna.aggression > 0.6 ? '冲动' : '冷静';
        
        let nearestFood = '无';
        if (worldState.nearbyFood?.length > 0) {
            nearestFood = worldState.nearbyFood[0].type;
        }
        
        let nearestWater = '无';
        if (worldState.nearbyWater?.length > 0) {
            nearestWater = worldState.nearbyWater[0].type;
        }
        
        return `你是${character.name}，一个${bravery}而${aggression}的原始人。

当前状态：
- 饥饿：${hunger}%
- 口渴：${thirst}%
- 精力：${energy}%
- 生命：${Math.round(character.health)}%

环境：
- 最近食物：${nearestFood}
- 最近水源：${nearestWater}

可选动作：寻找食物、寻找水源、吃东西、喝水、休息、探索、闲置

根据当前状态选择最合适的动作。只输出JSON：
{"action":"动作名"}`;
    }
    
    parseDecision(response) {
        try {
            const match = response.match(/\{[^}]+\}/);
            if (match) {
                const json = JSON.parse(match[0]);
                if (json.action) {
                    return {
                        action: json.action,
                        reason: json.reason || ''
                    };
                }
            }
        } catch (e) {}
        
        // 关键词匹配
        const lower = response.toLowerCase();
        const actions = ['寻找食物', '寻找水源', '吃东西', '喝水', '休息', '探索', '闲置'];
        
        for (const action of actions) {
            if (lower.includes(action)) {
                return { action, reason: '' };
            }
        }
        
        return { action: '闲置', reason: response };
    }
}

module.exports = { LLMProxy };

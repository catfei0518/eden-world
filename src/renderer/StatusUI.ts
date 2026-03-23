/**
 * 状态UI - 点击角色时显示的属性面板
 */

import { Character } from '../entities/Character';

export class StatusUI {
    private panel: HTMLElement;
    private selectedChar: Character | null = null;
    private characters: Character[] = [];
    private justSelected: boolean = false; // 防止立即关闭
    
    constructor() {
        this.createPanel();
        this.setupClickOutside();
        this.setupEscKey();
    }
    
    // ESC键关闭
    private setupEscKey(): void {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.selectedChar) {
                this.hide();
            }
        });
    }
    
    private createPanel(): void {
        this.panel = document.getElementById('status-panel')!;
        this.panel.style.display = 'none';
    }
    
    // 点击角色时调用
    showCharacter(char: Character): void {
        this.selectedChar = char;
        this.panel.style.display = 'block';
        this.justSelected = true; // 防止事件冒泡立即关闭
        this.update();
        
        // 300ms后重置标志
        setTimeout(() => {
            this.justSelected = false;
        }, 300);
    }
    
    // 关闭面板
    hide(): void {
        this.selectedChar = null;
        this.panel.style.display = 'none';
    }
    
    // 点击空白处关闭
    private setupClickOutside(): void {
        document.addEventListener('pointerdown', (e) => {
            const target = e.target as HTMLElement;
            
            // 如果刚选中角色（300ms内），不关闭
            if (this.justSelected) return;
            
            // 如果点击的是角色（hitbox），不关闭
            if (target.classList.contains('char-hitbox')) return;
            
            // 如果点击的是面板内部，不关闭
            if (this.panel.contains(target)) return;
            
            // 如果有选中的角色，关闭
            if (this.selectedChar) {
                this.hide();
            }
        });
    }
    
    // 更新角色数据
    updateCharacters(chars: Character[]): void {
        this.characters = chars;
        if (this.selectedChar) {
            // 检查选中的角色是否还在
            if (!chars.includes(this.selectedChar)) {
                this.hide();
            } else {
                this.update();
            }
        }
    }
    
    update(): void {
        if (!this.selectedChar) return;
        
        const char = this.selectedChar;
        const dna = char.phenotype;
        
        // 更新名字和类型
        const nameElem = document.getElementById('panel-name');
        const typeElem = document.getElementById('panel-type');
        if (nameElem) nameElem.textContent = char.name;
        if (typeElem) typeElem.textContent = char.type === 'adam' ? '亚当' : '夏娃';
        
        // 头像颜色
        const avatarElem = document.getElementById('panel-avatar');
        if (avatarElem) {
            avatarElem.className = `avatar ${char.type === 'adam' ? 'adam' : 'eve'}`;
            avatarElem.textContent = char.type === 'adam' ? '♂' : '♀';
        }
        
        // 状态图标
        const statusIcon = document.getElementById('status-icon');
        if (statusIcon) {
            statusIcon.textContent = this.getStatusIcon(char);
        }
        
        // 坐标
        const posElem = document.getElementById('panel-position');
        if (posElem) posElem.textContent = `(${char.x.toFixed(1)}, ${char.y.toFixed(1)})`;
        
        // 进度条
        const foodPct = Math.round((char.food / 5) * 100);
        const waterPct = Math.round((char.water / 5) * 100);
        const energyPct = Math.round((char.energy / 5) * 100);
        
        const foodBar = document.getElementById('panel-food-bar');
        const waterBar = document.getElementById('panel-water-bar');
        const energyBar = document.getElementById('panel-energy-bar');
        const foodVal = document.getElementById('panel-food-val');
        const waterVal = document.getElementById('panel-water-val');
        const energyVal = document.getElementById('panel-energy-val');
        
        if (foodBar) foodBar.style.width = `${foodPct}%`;
        if (waterBar) waterBar.style.width = `${waterPct}%`;
        if (energyBar) energyBar.style.width = `${energyPct}%`;
        if (foodVal) foodVal.textContent = `${foodPct}%`;
        if (waterVal) waterVal.textContent = `${waterPct}%`;
        if (energyVal) energyVal.textContent = `${energyPct}%`;
        
        // 当前行动
        const actionElem = document.getElementById('panel-action');
        if (actionElem) actionElem.textContent = char.action;
        
        // DNA属性 - 完整列表
        const dnaContainer = document.getElementById('panel-dna-attrs');
        if (dnaContainer) {
            // 获取性格类型
            const personality = (char as any).getPersonality ? (char as any).getPersonality() : '普通人';
            
            dnaContainer.innerHTML = `
                <div class="dna-row" style="background: rgba(74, 169, 74, 0.3); font-weight: bold;">
                    <span>🎭 性格</span><span>${personality}</span>
                </div>
                <div class="dna-row">
                    <span>⚔️ 胆量</span><span>${(dna.bravery * 100).toFixed(0)}</span>
                </div>
                <div class="dna-row">
                    <span>😨 恐惧阈值</span><span>${(dna.fearResponse * 100).toFixed(0)}</span>
                </div>
                <div class="dna-row">
                    <span>⚔️ 攻击性</span><span>${(dna.aggression * 100).toFixed(0)}</span>
                </div>
                <div class="dna-row">
                    <span>🏃 敏捷</span><span>${(dna.agility * 100).toFixed(0)}</span>
                </div>
                <div class="dna-row">
                    <span>🔥 代谢</span><span>${dna.metabolism.toFixed(2)}</span>
                </div>
                <div class="dna-row">
                    <span>❓ 好奇</span><span>${(dna.curiosity * 100).toFixed(0)}</span>
                </div>
                <div class="dna-row">
                    <span>🛡️ 风险规避</span><span>${(dna.riskAversion * 100).toFixed(0)}</span>
                </div>
                <div class="dna-row">
                    <span>❤️ 同理心</span><span>${(dna.empathy * 100).toFixed(0)}</span>
                </div>
                <div class="dna-row">
                    <span>🤝 社交</span><span>${(dna.sociability * 100).toFixed(0)}</span>
                </div>
                <div class="dna-row">
                    <span>⏳ 耐心</span><span>${(dna.patience * 100).toFixed(0)}</span>
                </div>
                <div class="dna-row">
                    <span>🧠 智力</span><span>${(dna.intelligence * 100).toFixed(0)}</span>
                </div>
                <div class="dna-row">
                    <span>👁️ 感知</span><span>${(dna.perception * 100).toFixed(0)}</span>
                </div>
                <div class="dna-row">
                    <span>💪 力量</span><span>${(dna.strength * 100).toFixed(0)}</span>
                </div>
                <div class="dna-row">
                    <span>🏋️ 体质</span><span>${(dna.constitution * 100).toFixed(0)}</span>
                </div>
            `;
        }
    }
    
    private getStatusIcon(char: Character): string {
        if (char.water < 2) return '💧口渴';
        if (char.food < 2) return '🍖饥饿';
        if (char.energy < 2) return '😴疲惫';
        if (char.action.includes('寻找')) return '🔍探索';
        if (char.action === '休息中') return '💤休息';
        if (char.action === '闲置') return '🧘待机';
        return '🚶移动';
    }
    
    getSelectedCharacter(): Character | null {
        return this.selectedChar;
    }
}

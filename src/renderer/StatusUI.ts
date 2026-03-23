/**
 * 角色状态UI - 点击角色时显示的属性面板
 */

import { Character } from '../entities/Character';

export class StatusUI {
    private panel: HTMLElement;
    private selectedChar: Character | null = null;
    private characters: Character[] = [];
    private lastClickTime: number = 0;
    private deathPanelShown: boolean = false;
    
    constructor() {
        this.createPanel();
        this.setupClickOutside();
        this.setupEscKey();
    }
    
    private createPanel(): void {
        this.panel = document.getElementById('status-panel')!;
        this.panel.style.display = 'none';
    }
    
    // 点击角色时调用
    showCharacter(char: Character): void {
        this.selectedChar = char;
        this.deathPanelShown = false;
        this.panel.style.display = 'block';
        this.lastClickTime = Date.now();
        this.update();
    }
    
    // 关闭面板
    hide(): void {
        this.selectedChar = null;
        this.deathPanelShown = false;
        this.panel.style.display = 'none';
    }
    
    // 更新角色数据
    updateCharacters(chars: Character[]): void {
        this.characters = chars;
        if (this.selectedChar) {
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
        const charAny = char as any;
        
        // 检查DNA
        if (!char.phenotype) {
            console.error('Character has no phenotype!');
            return;
        }
        
        // 如果角色已死亡，显示死亡面板
        if (charAny.isDead) {
            this.showDeathPanel(char);
            return;
        }
        
        // 如果角色不在characters列表中，关闭面板
        if (!this.characters.includes(char)) {
            this.hide();
            return;
        }
        
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
        
        // 生命值
        const healthVal = document.getElementById('panel-health-val');
        const healthBar = document.getElementById('panel-health-bar');
        if (healthBar && healthVal) {
            const maxHealth = char.maxHealth; // getter是属性访问
            const health = char.health !== undefined ? char.health : 100;
            const healthPct = maxHealth > 0 ? Math.round((health / maxHealth) * 100) : 0;
            healthBar.style.width = `${healthPct}%`;
            healthVal.textContent = `${healthPct}%`;
        }
        
        // 当前行动
        const actionElem = document.getElementById('panel-action');
        if (actionElem) actionElem.textContent = char.action;
        
        // DNA属性
        const dnaContainer = document.getElementById('panel-dna-attrs');
        if (dnaContainer) {
            const personality = charAny.getPersonality ? charAny.getPersonality() : '普通人';
            const lifestyle = charAny.getLifestyleStatus ? charAny.getLifestyleStatus() : '-';
            
            dnaContainer.innerHTML = `
                <div class="dna-row" style="background: rgba(74, 169, 74, 0.3); font-weight: bold;">
                    <span>🎭 性格</span><span>${personality}</span>
                </div>
                <div class="dna-row" style="background: rgba(74, 169, 74, 0.2);">
                    <span>🌿 生活状态</span><span>${lifestyle}</span>
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
                    <span>💪 力量</span><span>${(dna.strength * 100).toFixed(0)}</span>
                </div>
                <div class="dna-row">
                    <span>🏋️ 体质</span><span>${(dna.constitution * 100).toFixed(0)}</span>
                </div>
                <div class="dna-row">
                    <span>🛡️ 免疫力</span><span>${(dna.immuneStrength * 100).toFixed(0)}</span>
                </div>
            `;
        }
    }
    
    private showDeathPanel(char: Character): void {
        const charAny = char as any;
        
        if (this.deathPanelShown) return;
        this.deathPanelShown = true;
        
        // 更新标题
        const titleElem = document.querySelector('#status-panel h3 span:first-child');
        if (titleElem) titleElem.textContent = '💀 已死亡';
        
        // 头像变灰
        const avatarElem = document.getElementById('panel-avatar');
        if (avatarElem) {
            (avatarElem as HTMLElement).style.background = '#666';
            avatarElem.textContent = '💀';
        }
        
        // 名字变灰
        const nameElem = document.getElementById('panel-name');
        if (nameElem) nameElem.textContent = char.name + ' (已死亡)';
        
        // 显示死亡信息
        const posElem = document.getElementById('panel-position');
        if (posElem) posElem.textContent = charAny.deathCause || '未知原因';
        
        // 清空状态条
        const healthBar = document.getElementById('panel-health-bar');
        const healthVal = document.getElementById('panel-health-val');
        if (healthBar) healthBar.style.width = '0%';
        if (healthVal) healthVal.textContent = '0%';
        
        // 显示死亡信息
        const actionElem = document.getElementById('panel-action');
        if (actionElem) actionElem.textContent = charAny.deathCause || '未知原因';
        
        // DNA区域显示死亡时间
        const dnaContainer = document.getElementById('panel-dna-attrs');
        if (dnaContainer) {
            const deathTime = charAny.deathTime ? new Date(charAny.deathTime).toLocaleString() : '未知';
            dnaContainer.innerHTML = `
                <div class="dna-row" style="background: rgba(231, 76, 60, 0.3);">
                    <span>💀 死因</span><span>${charAny.deathCause || '未知'}</span>
                </div>
                <div class="dna-row">
                    <span>⏰ 死亡时间</span><span>${deathTime}</span>
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
    
    // 点击空白处关闭
    private setupClickOutside(): void {
        document.addEventListener('pointerdown', (e) => {
            const target = e.target as HTMLElement;
            
            if (Date.now() - this.lastClickTime < 200) return;
            if (this.panel.contains(target)) return;
            if (this.selectedChar) {
                this.hide();
            }
        });
    }
    
    // ESC键关闭
    private setupEscKey(): void {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.selectedChar) {
                this.hide();
            }
        });
    }
    
    getSelectedCharacter(): Character | null {
        return this.selectedChar;
    }
}

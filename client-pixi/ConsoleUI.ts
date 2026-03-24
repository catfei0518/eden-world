/**
 * 控制台UI - 按~打开
 */

import { commandSystem } from './CommandSystem';

export class ConsoleUI {
    private container: HTMLElement;
    private input: HTMLInputElement;
    private logs: HTMLElement;
    private isOpen: boolean = false;
    private onCommandExecute: ((cmd: string) => void) | null = null;
    
    constructor() {
        this.createUI();
        this.setupKeyboard();
        this.log('伊甸世界控制台已启动', 'info');
        this.log('按 ~ 或 / 打开控制台', 'info');
        this.log('输入 help 查看命令', 'info');
    }
    
    private createUI(): void {
        // 创建容器
        this.container = document.createElement('div');
        this.container.id = 'game-console';
        this.container.innerHTML = `
            <div class="console-header">
                <span>⚡ 伊甸控制台</span>
                <span class="console-hint">按 ~ 关闭</span>
            </div>
            <div class="console-logs" id="console-logs"></div>
            <div class="console-input-row">
                <span class="console-prompt">></span>
                <input type="text" id="console-input" placeholder="输入命令..." autocomplete="off" />
            </div>
        `;
        this.container.style.display = 'none';
        document.body.appendChild(this.container);
        
        this.input = document.getElementById('console-input') as HTMLInputElement;
        this.logs = document.getElementById('console-logs') as HTMLElement;
        
        // 输入事件
        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const cmd = this.input.value;
                if (cmd.trim()) {
                    this.execute(cmd);
                }
                this.input.value = '';
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.input.value = commandSystem.getHistory('up');
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.input.value = commandSystem.getHistory('down');
            } else if (e.key === 'Escape') {
                this.close();
            }
        });
        
        this.addStyles();
    }
    
    private addStyles(): void {
        const style = document.createElement('style');
        style.textContent = `
            #game-console {
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                height: 300px;
                background: rgba(10, 10, 20, 0.95);
                border-top: 2px solid #4a9;
                font-family: 'Consolas', 'Monaco', monospace;
                font-size: 13px;
                z-index: 9999;
                display: flex;
                flex-direction: column;
            }
            
            #game-console.open {
                display: flex;
            }
            
            .console-header {
                display: flex;
                justify-content: space-between;
                padding: 8px 15px;
                background: rgba(74, 169, 74, 0.2);
                border-bottom: 1px solid #4a9;
                color: #4a9;
                font-weight: bold;
            }
            
            .console-hint {
                font-size: 11px;
                color: #666;
                font-weight: normal;
            }
            
            .console-logs {
                flex: 1;
                overflow-y: auto;
                padding: 10px 15px;
                color: #ccc;
            }
            
            .console-logs .log {
                margin: 3px 0;
                line-height: 1.4;
            }
            
            .console-logs .log-info { color: #888; }
            .console-logs .log-success { color: #4a9; }
            .console-logs .log-error { color: #e74c3c; }
            .console-logs .log-cmd { color: #f1c40f; }
            
            .console-input-row {
                display: flex;
                align-items: center;
                padding: 10px 15px;
                background: rgba(0,0,0,0.3);
                border-top: 1px solid #333;
            }
            
            .console-prompt {
                color: #4a9;
                font-weight: bold;
                margin-right: 10px;
                font-size: 16px;
            }
            
            #console-input {
                flex: 1;
                background: transparent;
                border: none;
                outline: none;
                color: #fff;
                font-family: inherit;
                font-size: 14px;
            }
            
            #console-input::placeholder {
                color: #555;
            }
        `;
        document.head.appendChild(style);
    }
    
    private setupKeyboard(): void {
        document.addEventListener('keydown', (e) => {
            // ~ 或 / 打开控制台
            if (e.key === '`' || e.key === '~' || (e.key === '/' && !e.ctrlKey && !e.altKey && !e.metaKey)) {
                // 如果焦点在输入框，不处理
                if (document.activeElement === this.input) return;
                e.preventDefault();
                this.toggle();
            }
        });
    }
    
    toggle(): void {
        this.isOpen = !this.isOpen;
        this.container.style.display = this.isOpen ? 'flex' : 'none';
        if (this.isOpen) {
            this.input.focus();
        }
    }
    
    open(): void {
        this.isOpen = true;
        this.container.style.display = 'flex';
        this.input.focus();
    }
    
    close(): void {
        this.isOpen = false;
        this.container.style.display = 'none';
    }
    
    private execute(cmd: string): void {
        this.log(`> ${cmd}`, 'cmd');
        
        // 设置输出回调
        commandSystem.setOutputCallback((lines) => {
            for (const line of lines) {
                this.log(line, 'info');
            }
        });
        
        const result = commandSystem.execute(cmd);
        if (result && !result.startsWith('✓')) {
            this.log(result, result.startsWith('✓') ? 'success' : 'error');
        }
        if (this.onCommandExecute) {
            this.onCommandExecute(cmd);
        }
    }
    
    log(message: string, type: 'info' | 'success' | 'error' | 'cmd' = 'info'): void {
        const div = document.createElement('div');
        div.className = `log log-${type}`;
        div.textContent = message;
        this.logs.appendChild(div);
        this.logs.scrollTop = this.logs.scrollHeight;
    }
    
    // 设置命令执行回调
    setOnCommandExecute(callback: (cmd: string) => void): void {
        this.onCommandExecute = callback;
    }
    
    isVisible(): boolean {
        return this.isOpen;
    }
}

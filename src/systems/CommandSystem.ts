/**
 * 命令系统 - 支持自定义命令注册
 */

export interface Command {
    name: string;
    desc: string;
    usage: string;
    execute: (args: string[]) => void;
}

class CommandSystem {
    private commands: Map<string, Command> = new Map();
    private history: string[] = [];
    private historyIndex: number = -1;
    
    constructor() {
        this.registerBuiltIn();
    }
    
    // 注册命令
    register(cmd: Command): void {
        this.commands.set(cmd.name.toLowerCase(), cmd);
    }
    
    // 注销命令
    unregister(name: string): boolean {
        return this.commands.delete(name.toLowerCase());
    }
    
    // 输出收集器
    private outputBuffer: string[] = [];
    private outputCallback: ((lines: string[]) => void) | null = null;
    
    // 设置输出回调
    setOutputCallback(callback: (lines: string[]) => void): void {
        this.outputCallback = callback;
    }
    
    // 打印输出（内部使用）
    print(line: string): void {
        this.outputBuffer.push(line);
    }
    
    // 执行命令
    execute(input: string): string {
        const trimmed = input.trim();
        if (!trimmed) return '';
        
        // 添加到历史
        this.history.push(trimmed);
        this.historyIndex = this.history.length;
        
        // 清空输出缓冲
        this.outputBuffer = [];
        
        const parts = trimmed.split(/\s+/);
        const name = parts[0].toLowerCase();
        const args = parts.slice(1);
        
        const cmd = this.commands.get(name);
        if (!cmd) {
            const result = `未知命令: ${name}，输入 help 查看可用命令`;
            this.outputBuffer.push(result);
            return result;
        }
        
        try {
            cmd.execute(args);
            // 调用输出回调
            if (this.outputCallback && this.outputBuffer.length > 0) {
                this.outputCallback([...this.outputBuffer]);
            }
            return `✓ 执行: ${name}`;
        } catch (e: any) {
            const result = `✗ 错误: ${e.message}`;
            this.outputBuffer.push(result);
            return result;
        }
    }
    
    // 获取所有命令
    getCommands(): Command[] {
        return Array.from(this.commands.values());
    }
    
    // 获取历史
    getHistory(direction: 'up' | 'down'): string {
        if (this.history.length === 0) return '';
        
        if (direction === 'up') {
            this.historyIndex = Math.max(0, this.historyIndex - 1);
        } else {
            this.historyIndex = Math.min(this.history.length, this.historyIndex + 1);
        }
        
        if (this.historyIndex >= this.history.length) return '';
        return this.history[this.historyIndex];
    }
    
    // 内置命令
    private registerBuiltIn(): void {
        // help
        this.register({
            name: 'help',
            desc: '显示帮助',
            usage: 'help [命令名]',
            execute: (args) => {
                if (args[0]) {
                    const cmd = this.commands.get(args[0].toLowerCase());
                    if (cmd) {
                        this.print(`📝 ${cmd.name}`);
                        this.print(`   用法: ${cmd.usage}`);
                        this.print(`   说明: ${cmd.desc}`);
                    } else {
                        this.print(`未知命令: ${args[0]}`);
                    }
                } else {
                    this.print('📜 可用命令:');
                    this.print('');
                    this.print('🌿 季节控制:');
                    this.print('  切换季节-春  切换到春天');
                    this.print('  切换季节-夏  切换到夏天');
                    this.print('  切换季节-秋  切换到秋天');
                    this.print('  切换季节-冬  切换到冬天');
                    this.print('');
                    this.print('📊 信息查看:');
                    for (const cmd of this.commands.values()) {
                        if (cmd.name.startsWith('char') || cmd.name.startsWith('day') || cmd.name.startsWith('info')) {
                            this.print(`  ${cmd.name.padEnd(12)} - ${cmd.desc}`);
                        }
                    }
                    this.print('');
                    this.print('🛠️ 其他:');
                    this.print('  help         显示帮助');
                    this.print('  clear        清屏');
                }
            }
        });
        
        // clear
        this.register({
            name: 'clear',
            desc: '清屏',
            usage: 'clear',
            execute: () => {
                // 清除日志 - 通过事件通知UI
            }
        });
        
        // 切换季节 - 格式: 切换季节-春/夏/秋/冬
        this.register({
            name: '切换季节-春',
            desc: '切换到春天',
            usage: '切换季节-春',
            execute: () => {
                window.dispatchEvent(new CustomEvent('console-season', { detail: 'spring' }));
                this.print('✓ 切换到春天 🌸');
            }
        });
        
        this.register({
            name: '切换季节-夏',
            desc: '切换到夏天',
            usage: '切换季节-夏',
            execute: () => {
                window.dispatchEvent(new CustomEvent('console-season', { detail: 'summer' }));
                this.print('✓ 切换到夏天 ☀️');
            }
        });
        
        this.register({
            name: '切换季节-秋',
            desc: '切换到秋天',
            usage: '切换季节-秋',
            execute: () => {
                window.dispatchEvent(new CustomEvent('console-season', { detail: 'autumn' }));
                this.print('✓ 切换到秋天 🍂');
            }
        });
        
        this.register({
            name: '切换季节-冬',
            desc: '切换到冬天',
            usage: '切换季节-冬',
            execute: () => {
                window.dispatchEvent(new CustomEvent('console-season', { detail: 'winter' }));
                this.print('✓ 切换到冬天 ❄️');
            }
        });
        
        // char - 显示角色信息
        this.register({
            name: 'char',
            desc: '显示角色信息',
            usage: 'char [名字]',
            execute: (args) => {
                window.dispatchEvent(new CustomEvent('console-char', { detail: args }));
                this.print('📊 正在查询角色信息...');
            }
        });
        
        // day - 显示天数
        this.register({
            name: 'day',
            desc: '显示当前天数',
            usage: 'day',
            execute: () => {
                window.dispatchEvent(new CustomEvent('console-day'));
                this.print('📅 正在查询时间...');
            }
        });
        
        // info - 显示游戏信息
        this.register({
            name: 'info',
            desc: '显示游戏信息',
            usage: 'info',
            execute: () => {
                window.dispatchEvent(new CustomEvent('console-info'));
                this.print('🌍 正在查询游戏信息...');
            }
        });
    }
}

export const commandSystem = new CommandSystem();

/**
 * 服务器WebSocket客户端
 */

type Callback = (data: any) => void;

export class EdenServerClient {
    private ws: WebSocket | null = null;
    private url: string;
    private callbacks: Map<string, Callback[]> = new Map();
    private reconnectDelay = 3000;
    private reconnectTimer: number | null = null;
    
    constructor(url?: string) {
        // 从当前页面URL推断服务器地址
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        this.url = url || `${protocol}//${host}`;
    }
    
    on(event: string, callback: Callback) {
        if (!this.callbacks.has(event)) {
            this.callbacks.set(event, []);
        }
        this.callbacks.get(event)!.push(callback);
    }
    
    private emit(event: string, data: any) {
        const callbacks = this.callbacks.get(event) || [];
        callbacks.forEach(cb => cb(data));
    }
    
    connect() {
        console.log(`🔌 连接服务器: ${this.url}`);
        
        try {
            this.ws = new WebSocket(this.url);
            
            this.ws.onopen = () => {
                console.log('✅ WebSocket连接成功');
                this.emit('connect', null);
                
                // 清除重连计时器
                if (this.reconnectTimer) {
                    clearTimeout(this.reconnectTimer);
                    this.reconnectTimer = null;
                }
            };
            
            this.ws.onclose = (event) => {
                console.log('❌ WebSocket断开:', event.code, event.reason);
                this.emit('disconnect', { code: event.code, reason: event.reason });
                this.scheduleReconnect();
            };
            
            this.ws.onerror = (error) => {
                console.error('⚠️ WebSocket错误:', error);
                this.emit('error', error);
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleMessage(message);
                } catch (e) {
                    console.error('消息解析错误:', e);
                }
            };
            
        } catch (error) {
            console.error('连接失败:', error);
            this.scheduleReconnect();
        }
    }
    
    private handleMessage(message: { type: string; data?: any }) {
        console.log('📨 收到消息:', message.type);
        
        switch (message.type) {
            case 'init':
                this.emit('init', message.data);
                break;
            case 'state':
                this.emit('state', message.data);
                break;
            case 'sync':
                this.emit('sync', message.data);
                break;
            default:
                console.log('未知消息类型:', message.type);
        }
    }
    
    private scheduleReconnect() {
        if (this.reconnectTimer) return;
        
        console.log(`🔄 ${this.reconnectDelay/1000}秒后重连...`);
        this.reconnectTimer = window.setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, this.reconnectDelay);
    }
    
    disconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
    
    send(message: any) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }
}

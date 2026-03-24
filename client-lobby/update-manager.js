/**
 * 资源更新管理器
 * 使用 IndexedDB 进行本地缓存，支持资源下载和版本管理
 */

const DB_NAME = 'eden_world_cache';
const DB_VERSION = 2;
const STORE_NAME = 'resources';

class UpdateManager {
    constructor() {
        this.db = null;
        this.currentVersion = 'v0.13.0';      // 游戏版本
        this.resourceVersion = 'v0.12.0';        // 资源包版本（跟随游戏版本）
        this.resources = [];
        this.downloadProgress = 0;
        this.onProgress = null;
    }
    
    // 初始化 IndexedDB
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            
            request.onerror = () => reject(request.error);
            
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
                    store.createIndex('type', 'type', { unique: false });
                    store.createIndex('version', 'version', { unique: false });
                }
            };
        });
    }
    
    // 保存资源到本地
    async saveResource(key, data, type = 'asset', version = null, hash = null) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            
            const request = store.put({
                key,
                data,
                type,
                version: version || this.currentVersion,
                hash,  // 文件哈希
                updatedAt: Date.now()
            });
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
    
    // 获取本地资源
    async getResource(key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(key);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    // 检查本地资源的哈希是否匹配
    async hasLocalResource(key, expectedHash = null) {
        if (!expectedHash) {
            // 不检查哈希，只检查是否存在
            const resource = await this.getResource(key);
            return resource !== undefined;
        }
        // 检查哈希
        const resource = await this.getResource(key);
        return resource && resource.hash === expectedHash;
    }
    
    // 清除所有缓存
    async clearCache() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
    
    // 获取缓存大小
    async getCacheSize() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();
            
            request.onsuccess = () => {
                const items = request.result || [];
                let totalSize = 0;
                for (const item of items) {
                    if (item.data) {
                        if (typeof item.data === 'string') {
                            totalSize += item.data.length * 2;
                        } else if (item.data instanceof Blob) {
                            totalSize += item.data.size;
                        } else if (item.data.arrayBuffer) {
                            totalSize += item.data.arrayBuffer().then ? 0 : item.data.size;
                        }
                    }
                }
                resolve(totalSize);
            };
            request.onerror = () => reject(request.error);
        });
    }
    
    // 获取缓存的资源列表
    async getCachedResources() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }
    
    // 格式化字节大小
    formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
    
    // 获取资源列表
    async getResourceList() {
        try {
            const response = await fetch(`${API_BASE}/api/resources`);
            if (response.ok) {
                const data = await response.json();
                return data.resources || [];
            }
        } catch (e) {
            console.error('获取资源列表失败:', e);
        }
        return [];
    }
    
    // 下载单个资源
    async downloadResource(url, key, type = 'asset', hash = null) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const contentType = response.headers.get('content-type');
            let data;
            
            if (contentType && contentType.startsWith('image/')) {
                // 图片转为 Blob
                data = await response.blob();
            } else {
                // 其他转为文本
                data = await response.text();
            }
            
            await this.saveResource(key, data, type, null, hash);
            console.log(`✅ 下载完成: ${key}`);
            return true;
        } catch (e) {
            console.error(`❌ 下载失败: ${key}`, e);
            return false;
        }
    }
    
    // 下载所有资源（支持增量更新+清理废弃资源）
    async downloadAllResources(onProgress = null) {
        this.onProgress = onProgress;
        
        // 获取服务端资源列表（含哈希）
        const response = await fetch(`${API_BASE}/api/resources`);
        if (!response.ok) {
            console.log('无法获取资源列表，使用默认资源');
            await this.downloadDefaultResources();
            return;
        }
        
        const serverData = await response.json();
        const resourceList = serverData.resources || [];
        const serverResourceVersion = serverData.resourceVersion;
        
        if (resourceList.length === 0) {
            console.log('资源列表为空，使用默认资源');
            await this.downloadDefaultResources();
            return;
        }
        
        // 构建服务端资源key集合
        const serverKeys = new Set(resourceList.map(r => r.key));
        
        // 清理废弃资源：删除本地有但服务端清单没有的资源
        await this.cleanupOldResources(serverKeys);
        
        // 增量更新：检查每个资源的哈希
        const toDownload = [];
        for (const resource of resourceList) {
            const localResource = await this.getResource(resource.key);
            // 如果本地没有，或者哈希不匹配，需要下载
            if (!localResource || localResource.hash !== resource.hash) {
                toDownload.push(resource);
            }
        }
        
        console.log(`📦 增量更新: 需要下载 ${toDownload.length}/${resourceList.length} 个文件`);
        
        if (toDownload.length === 0) {
            // 全部已有，跳过下载
            await this.saveResource('resource_manifest', resourceList, 'manifest');
            await this.saveResource('version', this.currentVersion, 'version');
            await this.saveResource('resource_version', serverResourceVersion, 'version');
            if (onProgress) {
                onProgress({ progress: 100, completed: resourceList.length, failed: 0, total: resourceList.length, current: '完成' });
            }
            return;
        }
        
        // 保存资源列表（带哈希）
        await this.saveResource('resource_manifest', resourceList, 'manifest');
        
        const total = toDownload.length;
        let completed = 0;
        let failed = 0;
        
        // 下载需要更新的资源
        for (const resource of toDownload) {
            const url = resource.url.startsWith('http') ? resource.url : `${API_BASE}${resource.url}`;
            const success = await this.downloadResource(url, resource.key, resource.type, resource.hash);
            
            if (success) {
                completed++;
            } else {
                failed++;
            }
            
            // 更新进度
            this.downloadProgress = Math.round(((completed + failed) / total) * 100);
            if (onProgress) {
                onProgress({
                    progress: this.downloadProgress,
                    completed,
                    failed,
                    total,
                    current: resource.key
                });
            }
        }
        
        // 保存版本信息
        await this.saveResource('version', this.currentVersion, 'version');
        await this.saveResource('resource_version', serverResourceVersion, 'version');
        
        console.log(`📦 下载完成: 成功 ${completed}, 失败 ${failed}`);
    }
    
    // 清理废弃资源（删除服务端不再需要的资源）
    async cleanupOldResources(serverKeys) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.openCursor();
            
            let deletedCount = 0;
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const { key } = cursor.value;
                    // 如果本地有这个资源，但服务端不需要了，删除它
                    // 跳过 manifest、version 等元数据
                    if (!key.startsWith('img/') || serverKeys.has(key)) {
                        // 保留（是img但在清单中，或者不是img）
                    } else {
                        // 废弃资源，删除
                        cursor.delete();
                        deletedCount++;
                    }
                    cursor.continue();
                } else {
                    // 完成
                    if (deletedCount > 0) {
                        console.log(`🗑️ 清理了 ${deletedCount} 个废弃资源`);
                    }
                    resolve(deletedCount);
                }
            };
            
            request.onerror = () => reject(request.error);
        });
    }
    
    // 下载默认资源（当API不可用时）
    async downloadDefaultResources() {
        const defaultResources = [
            // 地形纹理
            { key: 'img/64x64像素草地春夏.png', url: '/img/64x64像素草地春夏.png', type: 'image' },
            { key: 'img/64x64像素草平原.png', url: '/img/64x64像素草平原.png', type: 'image' },
            { key: 'img/64x64像素森林春夏.png', url: '/img/64x64像素森林春夏.png', type: 'image' },
            { key: 'img/64x64像素森林秋.png', url: '/img/64x64像素森林秋.png', type: 'image' },
            { key: 'img/64x64像素森林冬.png', url: '/img/64x64像素森林冬.png', type: 'image' },
            { key: 'img/64x64像素沙漠.png', url: '/img/64x64像素沙漠.png', type: 'image' },
            { key: 'img/海洋.png', url: '/img/海洋.png', type: 'image' },
            { key: 'img/沙滩.png', url: '/img/沙滩.png', type: 'image' },
            { key: 'img/河流.png', url: '/img/河流.png', type: 'image' },
            { key: 'img/湖泊春夏秋.png', url: '/img/湖泊春夏秋.png', type: 'image' },
            { key: 'img/沼泽.png', url: '/img/沼泽.png', type: 'image' },
            { key: 'img/山地.png', url: '/img/山地.png', type: 'image' },
            { key: 'img/山丘.png', url: '/img/山丘.png', type: 'image' },
            // 角色纹理
            { key: 'img/亚当.png', url: '/img/亚当.png', type: 'image' },
            { key: 'img/夏娃.png', url: '/img/夏娃.png', type: 'image' },
            // 物品纹理
            { key: 'img/树.png', url: '/img/树.png', type: 'image' },
            { key: 'img/石头.png', url: '/img/石头.png', type: 'image' },
            { key: 'img/灌木.png', url: '/img/灌木.png', type: 'image' },
            { key: 'img/灌木果.png', url: '/img/灌木果.png', type: 'image' },
            { key: 'img/灌木花.png', url: '/img/灌木花.png', type: 'image' },
            { key: 'img/井.png', url: '/img/井.png', type: 'image' },
        ];
        
        const total = defaultResources.length;
        let completed = 0;
        
        // 保存资源列表
        await this.saveResource('resource_manifest', defaultResources, 'manifest');
        
        for (const resource of defaultResources) {
            const url = `${API_BASE}${resource.url}`;
            const success = await this.downloadResource(url, resource.key, resource.type);
            
            if (success) completed++;
            
            this.downloadProgress = Math.round((completed / total) * 100);
            if (this.onProgress) {
                this.onProgress({
                    progress: this.downloadProgress,
                    completed,
                    failed: total - completed,
                    total,
                    current: resource.key
                });
            }
        }
        
        // 保存版本信息
        await this.saveResource('version', this.currentVersion, 'version');
        await this.saveResource('resource_version', this.resourceVersion, 'version');
        
        console.log(`📦 默认资源下载完成: ${completed}/${total}`);
    }
    
    // 检查更新
    async checkUpdate() {
        try {
            const response = await fetch(`${API_BASE}/api/version`);
            if (response.ok) {
                const data = await response.json();
                const serverVersion = data.version;
                const serverResourceVersion = data.resourceVersion || 'v1.0.0';
                return {
                    needsUpdate: serverVersion !== this.currentVersion,
                    resourceNeedsUpdate: serverResourceVersion !== this.resourceVersion,
                    currentVersion: this.currentVersion,
                    serverVersion: serverVersion,
                    resourceVersion: this.resourceVersion,
                    serverResourceVersion: serverResourceVersion
                };
            }
        } catch (e) {
            console.error('检查更新失败:', e);
        }
        return { needsUpdate: false, resourceNeedsUpdate: false, currentVersion: this.currentVersion, serverVersion: null, resourceVersion: this.resourceVersion, serverResourceVersion: null };
    }
    
    // 获取本地版本
    async getLocalVersion() {
        const version = await this.getResource('version');
        return version ? version.data : null;
    }
    
    // 获取本地资源版本
    async getLocalResourceVersion() {
        const version = await this.getResource('resource_version');
        return version ? version.data : null;
    }
    
    // 检查是否有完整缓存（且版本匹配）
    async hasFullCache() {
        // 检查资源版本是否匹配
        const localResVersion = await this.getLocalResourceVersion();
        if (localResVersion !== this.resourceVersion) {
            console.log(`资源版本不匹配: 本地${localResVersion} vs 当前${this.resourceVersion}`);
            return false;
        }
        
        const manifest = await this.getResource('resource_manifest');
        if (!manifest) return false;
        
        const resources = manifest.data;
        for (const resource of resources) {
            const cached = await this.hasLocalResource(resource.key);
            if (!cached) return false;
        }
        return true;
    }
}

// 导出单例
window.updateManager = new UpdateManager();

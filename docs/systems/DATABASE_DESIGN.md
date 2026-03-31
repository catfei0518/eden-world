# 伊甸世界 - 数据库设计文档

> 版本: v1.0
> 更新: 2026-03-23
> 数据库: PostgreSQL 15+

---

## 目录

1. [ER图](#er图)
2. [表结构](#表结构)
3. [索引设计](#索引设计)
4. [Redis缓存设计](#redis缓存设计)

---

## ER图

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  accounts   │────▶│ characters  │◀────│  families   │
│  玩家账户    │     │   角色      │     │    家族     │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
       ┌───────────┐ ┌───────────┐ ┌───────────┐
       │ inventories│ │ DNA_records│ │  events   │
       │   物品     │ │   DNA档案  │ │   事件    │
       └───────────┘ └───────────┘ └───────────┘
```

---

## 表结构

### 1. accounts - 玩家账户表

```sql
CREATE TABLE accounts (
    id SERIAL PRIMARY KEY,
    
    -- 账户信息
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    
    -- 状态
    status VARCHAR(20) DEFAULT 'active',  -- active, banned, deleted
    last_login_at TIMESTAMP,
    last_login_ip INET,
    
    -- 统计
    total_characters INT DEFAULT 0,
    total_play_time BIGINT DEFAULT 0,  -- 秒
    
    -- 时间戳
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX idx_accounts_username ON accounts(username);
CREATE INDEX idx_accounts_email ON accounts(email);
CREATE INDEX idx_accounts_status ON accounts(status);
```

### 2. characters - 角色表

```sql
CREATE TABLE characters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id INT NOT NULL REFERENCES accounts(id),
    
    -- 基础信息
    name VARCHAR(100) NOT NULL,
    role VARCHAR(20) DEFAULT 'descendant',  -- adam, eve, descendant
    generation INT DEFAULT 1,
    sex VARCHAR(10) NOT NULL,  -- male, female
    
    -- DNA数据（JSON存储）
    dna_data JSONB NOT NULL,
    phenotype JSONB NOT NULL,
    
    -- 当前位置
    position_x DECIMAL(10, 2) NOT NULL,
    position_y DECIMAL(10, 2) NOT NULL,
    
    -- 状态属性
    health DECIMAL(5, 2) DEFAULT 100.00,  -- 0-100
    hunger DECIMAL(5, 2) DEFAULT 0.00,   -- 0-100
    thirst DECIMAL(5, 2) DEFAULT 0.00,   -- 0-100
    energy DECIMAL(5, 2) DEFAULT 100.00, -- 0-100
    
    -- 数值属性
    strength DECIMAL(5, 2) DEFAULT 50.00,
    agility DECIMAL(5, 2) DEFAULT 50.00,
    intelligence DECIMAL(5, 2) DEFAULT 50.00,
    
    -- 库存（JSON存储物品）
    inventory JSONB DEFAULT '[]',
    
    -- 装备（JSON）
    equipment JSONB DEFAULT '{}',
    
    -- 世系
    family_id UUID,
    father_id UUID REFERENCES characters(id),
    mother_id UUID REFERENCES characters(id),
    
    -- 状态
    status VARCHAR(20) DEFAULT 'alive',  -- alive, dead, offline
    death_cause VARCHAR(100),
    
    -- 游戏时间
    age_seconds BIGINT DEFAULT 0,  -- 年龄（秒）
    born_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    died_at TIMESTAMP,
    
    -- 统计
    total_distance DECIMAL(12, 2) DEFAULT 0,
    foods_gathered INT DEFAULT 0,
    children_born INT DEFAULT 0,
    
    -- 时间戳
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE INDEX idx_characters_account ON characters(account_id);
CREATE INDEX idx_characters_status ON characters(status);
CREATE INDEX idx_characters_generation ON characters(generation);
CREATE INDEX idx_characters_family ON characters(family_id);
CREATE INDEX idx_characters_parents ON characters(father_id, mother_id);
CREATE INDEX idx_characters_position ON characters(position_x, position_y);
```

### 3. families - 家族表

```sql
CREATE TABLE families (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 家族信息
    name VARCHAR(100) NOT NULL,
    founder_id UUID NOT NULL REFERENCES characters(id),
    
    -- 统计
    member_count INT DEFAULT 1,
    max_generation INT DEFAULT 1,
    total_members INT DEFAULT 1,
    
    -- 家族资产
    resources JSONB DEFAULT '{"food": 0, "water": 0, "stone": 0, "wood": 0}',
    
    -- 解散状态
    dissolved_at TIMESTAMP,
    dissolve_reason VARCHAR(100),
    
    -- 时间戳
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_families_name ON families(name);
CREATE INDEX idx_families_founder ON families(founder_id);
```

### 4. inventories - 物品表（可选，详细物品记录）

```sql
CREATE TABLE inventories (
    id SERIAL PRIMARY KEY,
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    
    -- 物品信息
    item_type VARCHAR(50) NOT NULL,
    item_name VARCHAR(100) NOT NULL,
    item_data JSONB DEFAULT '{}',  -- 额外数据
    
    -- 数量
    quantity INT DEFAULT 1,
    
    -- 位置
    slot_index INT,  -- 背包槽位
    
    -- 状态
    equipped BOOLEAN DEFAULT FALSE,
    is_tradable BOOLEAN DEFAULT TRUE,
    
    -- 时间戳
    acquired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_inventories_character ON inventories(character_id);
CREATE INDEX idx_inventories_type ON inventories(item_type);
CREATE INDEX idx_inventories_equipped ON inventories(character_id, equipped);
```

### 5. events - 事件日志表

```sql
CREATE TABLE events (
    id BIGSERIAL PRIMARY KEY,
    
    -- 事件关联
    character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
    family_id UUID REFERENCES families(id) ON DELETE SET NULL,
    
    -- 事件类型
    event_type VARCHAR(50) NOT NULL,
    
    -- 事件数据
    event_data JSONB DEFAULT '{}',
    
    -- 位置（可选）
    position_x DECIMAL(10, 2),
    position_y DECIMAL(10, 2),
    
    -- 服务器时间
    server_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- 客户端时间（防作弊）
    client_time TIMESTAMP
);

-- 事件类型索引
CREATE INDEX idx_events_character ON events(character_id);
CREATE INDEX idx_events_family ON events(family_id);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_time ON events(server_time DESC);

-- 分区表（按月分区，提高查询性能）
CREATE INDEX idx_events_character_time ON events(character_id, server_time DESC);
```

### 6. world_state - 世界状态表

```sql
CREATE TABLE world_state (
    id INT PRIMARY KEY DEFAULT 1,  -- 单行表
    
    -- 时间
    tick BIGINT DEFAULT 0,
    game_time_seconds BIGINT DEFAULT 0,
    
    -- 天气
    temperature INT DEFAULT 25,  -- 摄氏度
    weather VARCHAR(20) DEFAULT 'clear',
    is_day BOOLEAN DEFAULT TRUE,
    
    -- 世界统计
    total_characters INT DEFAULT 0,
    total_alive INT DEFAULT 0,
    total_dead INT DEFAULT 0,
    
    -- 资源统计
    total_food DECIMAL(12, 2) DEFAULT 0,
    total_water DECIMAL(12, 2) DEFAULT 0,
    
    -- 版本（乐观锁）
    version INT DEFAULT 1,
    
    -- 时间戳
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 确保只有一行
INSERT INTO world_state (id) VALUES (1) ON CONFLICT DO NOTHING;
```

### 7. characters_children - 角色亲子关系表

```sql
CREATE TABLE character_relationships (
    id SERIAL PRIMARY KEY,
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    related_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    relationship_type VARCHAR(20) NOT NULL,  -- father, mother, child, sibling, spouse
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(character_id, related_id, relationship_type)
);

CREATE INDEX idx_relationships_character ON character_relationships(character_id);
CREATE INDEX idx_relationships_type ON character_relationships(relationship_type);
```

---

## 索引设计

### 复合索引

```sql
-- 角色查询常用组合
CREATE INDEX idx_characters_account_status ON characters(account_id, status);
CREATE INDEX idx_characters_generation_status ON characters(generation, status);

-- 事件查询常用组合
CREATE INDEX idx_events_character_type ON events(character_id, event_type);
CREATE INDEX idx_events_time_type ON events(server_time DESC, event_type);
```

### 部分索引（只索引活跃数据）

```sql
-- 只索引存活的角色
CREATE INDEX idx_characters_alive ON characters(position_x, position_y)
WHERE status = 'alive';

-- 只索引错误事件
CREATE INDEX idx_events_errors ON events(server_time DESC)
WHERE event_type LIKE 'error_%';
```

---

## Redis缓存设计

### 数据结构

```
# 玩家会话
session:{session_id} → { account_id, character_ids[], login_time }

# 角色实时状态（高频更新）
character:status:{character_id} → {
    position: {x, y},
    health, hunger, thirst, energy,
    current_action,
    last_update
}
TTL: 60秒

# 玩家在线列表
online:characters → SET of character_ids

# 世界状态缓存
world:state → { tick, temperature, is_day }
TTL: 5秒

# 冷却时间
cooldown:{character_id}:{action} → timestamp
TTL: 根据具体动作

# 排行榜
leaderboard:{type} → ZSET (score → character_id)
types: age, strength, children_count
```

### Redis 键设计

```typescript
// 键命名规范
const RedisKeys = {
    // 会话
    session: (id: string) => `session:${id}`,
    
    // 角色状态
    characterStatus: (id: string) => `character:status:${id}`,
    
    // 角色位置（Geohash优化）
    characterPosition: (id: string) => `character:pos:${id}`,
    
    // 冷却时间
    cooldown: (charId: string, action: string) => `cooldown:${charId}:${action}`,
    
    // 世界状态
    worldState: () => 'world:state',
    
    // 排行榜
    leaderboard: (type: string) => `leaderboard:${type}`,
    
    // 在线玩家
    onlineCharacters: () => 'online:characters',
    
    // 家族数据
    family: (id: string) => `family:${id}`,
    
    // 好友列表
    friends: (accountId: number) => `friends:${accountId}`,
};
```

---

## PostgreSQL 特殊功能使用

### 1. JSONB 存储DNA数据

```sql
-- DNA数据示例
{
    "chromosomes": [...],
    "phenotype": {
        "strength": 75.5,
        "agility": 62.3,
        "intelligence": 80.0,
        "bravery": 0.7,
        "curiosity": 0.5
    },
    "generation": 1
}

-- 查询示例：找勇敢度>0.7的角色
SELECT * FROM characters 
WHERE (dna_data->'phenotype'->>'bravery')::float > 0.7;
```

### 2. GIN 索引加速JSON查询

```sql
-- 为DNA数据创建GIN索引
CREATE INDEX idx_characters_dna ON characters USING GIN (dna_data);
CREATE INDEX idx_characters_phenotype ON characters USING GIN (phenotype);
```

### 3. 触发器自动更新时间

```sql
-- 自动更新updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_accounts_updated_at
    BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_characters_updated_at
    BEFORE UPDATE ON characters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## 迁移脚本模板

```sql
-- migrations/001_initial_schema.sql

-- 创建扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 创建表（按依赖顺序）
CREATE TABLE accounts (...);
CREATE TABLE families (...);
CREATE TABLE characters (...);
CREATE TABLE inventories (...);
CREATE TABLE events (...);

-- 创建索引
CREATE INDEX ...

-- 创建触发器
CREATE TRIGGER ...

-- 初始化数据
INSERT INTO world_state (id) VALUES (1);
```

---

*最后更新: 2026-04-01*

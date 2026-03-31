# 代码规范

## 1. 命名规范

### 1.1 代码命名
```
✅ 使用英文命名
❌ 不使用中文拼音或中文

正例：generateResourcePoints(), createAIEntity()
反例：shengChengZiYuanDian(), 创建AI实体()
```

### 1.2 注释
```
✅ 使用中文注释
❌ 英文注释（仅代码内部可接受）

正例：
// 生成资源点
function generateResourcePoints() {
    // 遍历地图寻找合适位置
    for (const position of positions) {
        // ...
    }
}
```

### 1.3 文件命名
```
✅ 小写下划线分隔
例：game_engine.js, resource_system.js
```

### 1.4 常量命名
```
✅ 全大写下划线分隔
例：MAX_TICK_COUNT, TICKS_PER_DAY
```

## 2. 代码结构

### 2.1 模块组织
```
每个系统独立文件
例：
/src
  /core
    GameEngine.js
  /systems
    ResourceSystem.js
    AISystem.js
  /ai
    SimpleAI.js
```

## 3. 注释要求

### 3.1 必须注释的内容
```
- 每个函数/方法的用途
- 复杂的逻辑判断
- 重要的算法
- 跨模块调用
```

### 3.2 注释格式
```
// 单行注释

/**
 * 多行注释
 * 用于函数/类文档
 */
```

## 4. 项目结构（分层结构）

```
/eden-world
  /src               # 单机版源码
    /core            # 核心引擎
    /entities        # 实体
    /renderer        # 渲染系统
    /systems         # 游戏系统
    /world           # 世界相关
  /client-pixi       # 在线版客户端（PixiJS）
  /client-console    # 控制台客户端
  /client-lobby      # 大厅客户端
  /server            # 在线版服务器
  /shared            # 共享代码
  /docs              # 文档
  /tests             # 测试
  /public            # 静态资源
  /img               # 图片素材
  /saves             # 存档文件
```

## 5. 测试结构

### 5.1 测试目录

```
/eden-world
  /src               # 源码
  /tests             # 测试文件（统一放这里）
    /core/
    /systems/
    /ai/
```

### 5.2 命名规范

```
测试文件：*.test.ts
测试类：*Test.ts
```

## 5. 测试覆盖标准

### 5.1 覆盖率目标

```
标准覆盖：60-80%
```

### 5.2 分层要求

| 模块 | 建议覆盖率 |
|:----:|:---------:|
| 核心系统 | 80%+ |
| AI系统 | 70%+ |
| 工具函数 | 60%+ |
| 界面/渲染 | 50%+ |

### 5.3 标准覆盖内容

```
✅ 核心功能测试
✅ 边界条件测试
✅ 异常处理测试
✅ 基础集成测试
```

## 5. 测试时机

### 5.1 测试运行规则

```
A + B 组合：
- 提交前：本地运行所有测试
- CI/CD：每次push自动运行
```

### 5.2 工作流

```
开发 → 写代码 → 本地测试(提交前) → push → CI自动测试 → 合并
```

### 5.3 Git Hooks

```
使用pre-commit hook：
- 提交前自动运行测试
- 测试不通过不能提交
```

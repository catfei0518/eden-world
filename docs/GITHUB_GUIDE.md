# GitHub 规范

## 1. 提交规范（约定式提交）

### 格式
```
<类型>(<范围>): <描述>

示例：
feat(ai): 添加AI寻路系统
fix(combat): 修复战斗伤害计算错误
docs(constitution): 更新宪法v1.0
```

### 常用类型
| 类型 | 说明 |
|:----:|:----:|
| feat | 新功能 |
| fix | 修复bug |
| docs | 文档 |
| style | 格式 |
| refactor | 重构 |
| test | 测试 |
| chore | 杂项 |

## 2. 分支规范
```
main       # 主分支（稳定版本）
develop    # 开发分支
feature/*  # 功能分支
fix/*      # 修复分支
```

## 3. Commit规范
- 每条commit应该是一个逻辑单元
- 提交信息用中文描述
- 代码命名用英文（见CODE_STYLE.md）

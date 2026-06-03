# Cross-Repository API Contracts

本目录存放从各子项目收集的 **OpenAPI 静态快照**，作为 `governance/CONTRACTS.md` 中接口定义的事实来源。

> **原则**：接口路径、参数、响应结构以本目录中的 OpenAPI JSON 为准；业务语义（字段映射规则、错误码含义、架构原则）仍以 `CONTRACTS.md` 为准。

## 文件说明

| 文件 | 来源 | 更新方式 |
|------|------|---------|
| `backend-api.json` | `backend/openapi.json` | `cd backend && mvn clean package -Popenapi -DskipTests` |
| `icepolar-dms-api.json` | `icepolar-dms/openapi.json` | `cd icepolar-dms && python3 scripts/generate-openapi.py` |

## 使用场景

1. **前端开发**：直接引用 `backend-api.json` 生成 TypeScript 类型定义或 API 客户端
2. **契约校验**：在 CI 中对比 `CONTRACTS.md` 引用的接口路径是否存在于 OpenAPI 中
3. **文档生成**：使用 Swagger UI / ReDoc 等工具渲染可视化文档

## 与 CONTRACTS.md 的关系

```
CONTRACTS.md          ← 语义契约（手写，不可替代）
    ├── 架构原则：MiniApp 禁止直接调用 DMS
    ├── 字段映射规则：conn_status → online
    ├── 业务规则：commission_rate 优先级
    └── 错误码语义：403 = 无 YWYYG 岗位权限

CONTRACT/
    ├── backend-api.json      ← 接口结构（自动生成，事实来源）
    └── icepolar-dms-api.json ← 接口结构（自动生成，事实来源）
```

当接口发生变更时：
1. 先修改代码（backend / icepolar-dms）
2. 重新生成 OpenAPI JSON 到子项目根目录
3. 运行 `extract-openapi` skill 收集到本目录
4. 如果变更涉及跨仓库语义（字段映射、错误码），同步更新 `CONTRACTS.md`

# 审查报告 — category-sort

## 结论
通过。实现与冻结方案一致，构建/类型/编译全部通过。

## 发现项

### 已确认无问题
- 排序口径统一（DB 层 `sort ASC, id ASC`)，删除了控制器内存排序，行为一致。
- 新接口权限复用 `product:category:update`，无未授权端点。
- `updateCategorySort` 有 `@Transactional`，批量失败整体回滚。
- 前端拖拽限制同级，跨级 `getList()` 回滚 UI。
- 无新增密钥、无非预期文件、无空章节文档。

### 轻微（不阻塞）
1. 前端拖拽的同级判定基于「目标邻居同 parentId」启发式；在多层树且展开态下，极端跨级拖拽可能被误判为合法——但落库只影响同 parentId 的 sibling 集合，不会破坏数据，仅 UI 提示。可接受。
2. 存量全 0 数据：首次拖拽只重排被操作同级，其余行仍为 0——符合「不补存量」决策。
3. `ProductCategoryUpdateSortReqVO.Item` 未限制 sort 非负；DB 默认 int，业务上 0..n 由前端生成，风险低。

## 验证缺口
- 无 E2E / 无模块自有单测（基线现状）。建议联调时手测：同级拖拽→刷新保持；跨级拖拽→提示并回滚。

## 建议
联调环境跑一次手测确认交互手感，尤其 `default-expand-all` 树表下 sortablejs 的 row-index 对齐。

# Test Agent

## 触发

跨端流程、关键业务链路或明显回归风险需要 E2E 时启用。开发 Agent 负责单元和集成测试。

## 职责

- 从 Acceptance Criteria 选择最小充分 E2E 场景
- 使用 Playwright 验证用户可见的完整链路
- 执行回归并区分产品缺陷、用例问题和环境问题

## 产物

- 所有功能：`governance/feature-docs/{feature}/test-notes.md`
- 复杂 E2E：`governance/feature-docs/{feature}/test-plan.md`
- 用例：`governance/e2e/specs/features/{feature}/*.spec.ts`
- 稳定后移入 `governance/e2e/specs/main/`

`test-plan.md` 只列环境前置、场景、断言和状态，不复制需求正文。只有远程环境、固定账号/数据或副作用操作需要用户确认。

## 约束

- 通过 UI 准备和验证主体数据；不直接调用后端 API 或数据库绕过用户链路
- 禁止生产或个人数据；固定账号、租户和权限写为环境前置
- 优先 role/label/text 定位；不稳定用例必须修复、移除或说明
- 测试数据默认可保留；会影响重复执行时必须清理并记录方法
- 功能完成后运行现有 E2E 回归；失败须归类并记录
- Admin 复杂页面先核对实际 Vue/Element Plus 结构，必要时由 Frontend Agent 提供可测试性改造

## 命令

```bash
(cd governance/e2e && npm test)
(cd governance/e2e && npm run test:headed)
(cd governance/e2e && npm run report)
```

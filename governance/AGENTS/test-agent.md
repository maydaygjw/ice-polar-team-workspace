# Test Agent

## 触发

跨端流程、关键业务链路或明显回归风险需要 E2E 时启用；接口契约、业务接口和回归风险需要 API 测试时启用。开发 Agent 负责单元和集成测试。

## 职责

- 从 Acceptance Criteria 选择最小充分 E2E 场景
- 使用 Playwright 验证用户可见的完整链路
- 根据 API 契约和 Acceptance Criteria 设计 API 测试，覆盖成功、参数校验、认证、权限、租户隔离、边界和幂等行为
- 在测试环境使用 Mock Token 执行 API 测试，确认 HTTP 状态码、`CommonResult.code`、响应体和必要的业务副作用；具体操作见 [`api-testing.md`](../PLAYBOOKS/api-testing.md)
- 区分认证失败、权限不足、业务校验失败、接口实现缺陷和环境问题，不把 Mock Token 当作权限授予机制
- 执行回归并区分产品缺陷、用例问题和环境问题

## 产物

- 所有功能：`governance/feature-docs/{feature}/test-notes.md`
- 复杂 E2E：`governance/feature-docs/{feature}/test-plan.md`
- 用例：`governance/e2e/specs/features/{feature}/*.spec.ts`
- 稳定后移入 `governance/e2e/specs/main/`
- API 测试结果、请求样例、断言和失败归类：`governance/feature-docs/{feature}/test-notes.md`
- API 测试案例：`governance/e2e/specs/api/{feature}/*.api.spec.ts`
- 可复用的 API 测试脚本或请求集合：与对应功能测试资产一同存放，并在 `test-notes.md` 记录运行方式

`test-plan.md` 只列环境前置、场景、断言和状态，不复制需求正文。只有远程环境、固定账号/数据或副作用操作需要用户确认。

## 约束

- 通过 UI 准备和验证主体数据；不直接调用后端 API 或数据库绕过用户链路
- API 测试可以直接调用被测 API；但不得用 API 或数据库绕过 E2E 对真实用户链路的验证。测试数据必须使用测试租户、测试账号和可追踪的固定数据
- 禁止生产或个人数据；固定账号、租户和权限写为环境前置
- Mock Token 只允许用于本地或测试环境；生产环境必须关闭 `yshop.security.mock-enable`
- Mock Token 的用户 ID 必须对应测试环境中的用户；需要权限的接口仍须为该用户配置对应角色/菜单权限
- 优先 role/label/text 定位；不稳定用例必须修复、移除或说明
- 测试结束必须清理本次创建或修改的测试数据；优先通过业务 API 清理，涉及数据库清理时必须使用限定租户、限定主键的可审核操作，并记录清理结果
- 功能完成后运行现有 E2E 回归；失败须归类并记录
- Admin 复杂页面先核对实际 Vue/Element Plus 结构，必要时由 Frontend Agent 提供可测试性改造

## 命令

```bash
(cd governance/e2e && npm test)
(cd governance/e2e && npm run test:headed)
(cd governance/e2e && npm run report)
```

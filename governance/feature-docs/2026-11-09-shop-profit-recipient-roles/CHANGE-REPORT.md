# 变更报告

## Summary

- 店铺支持一个主分账收款人及多个非主对账收款人；非主关系可记为有效或无效，两种标记都参与订单结算状态同步匹配。
- 应收应付和本系统发起的分账继续使用主收款人；远端分账导入仅按当前店铺关系和完整 Member ID 映射。
- 未唯一匹配的远端明细不猜测收款人归属；不推断 AdaPay 未返回的来源渠道。

## Repositories

- `backend`：新增主/非主绑定查询与保存接口、绑定历史用途/标记、同步匹配逻辑及映射测试。
- `admin`：店铺编辑页维护主收款人与非主收款人、关系标记；订单结算同步区提示匹配范围。
- workspace governance：新增契约增量和验证/审查记录。

## Contracts

- 新增 `GET/PUT /admin-api/store/shop/profit-recipient-bindings`，沿用 `store:shop:query` / `store:shop:update`。
- 新增 Flyway 迁移 `V2026110906__shop_profit_recipient_binding_purpose.sql`，扩展绑定历史用途和关系标记字段及查询索引。
- 同步状态 API 路由和 AdaPay 外部报文不变。

## Verification

- 后端目标模块测试和编译：通过，`ProfitSharingOrderServiceImplTest` 4/4 通过。
- `pnpm build:prod`：通过，出现现有 Sass/Browserslist 弃用提示。
- `pnpm ts:check`：全仓失败，1570 条类型错误；新增绑定 API 与请求/回填行无诊断，详情见 `test-notes.md`。
- `git diff --check`：backend、admin 均通过。
- 未执行浏览器 E2E、实库迁移或真实 AdaPay 调用。

## Migration

- 部署前通过独立 db-migrator 执行 `V2026110906`；本次没有访问数据库。

## Risks

- 管理端现有全仓 TypeScript 错误需另行治理；本功能改动不能视为通过全仓类型门禁。
- 其他渠道的分账来源不可从当前 AdaPay 返回数据中识别。

## Suggested PR

- 标题：`feat(pay): 支持店铺多收款人结算匹配`
- 描述：实现店铺主/非主收款人绑定管理，保持应收应付和本系统出账使用主收款人；订单结算同步按当前店铺 Member ID 匹配主、非主收款人，记录标记不影响匹配。后端测试与管理端生产构建通过；全仓类型检查被现有错误阻断。

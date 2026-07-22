# 商圈排名竞价（二期）— Test Notes

## 验证范围

- backend：周期、出价/同档加价、支付通知、尾款、简单结算、排序 API 调用和 admin 查询。
- admin：出价单和结算结果查询页面的类型检查与生产构建。
- E2E：需要可用的支付沙箱和周期测试数据后执行；本文件记录实际结果。

## 当前状态

已完成实现和基础验证，待评审结论后交付。未执行真实支付沙箱和浏览器 E2E。

## 实际结果

- `mvn -pl yshop-server -am compile -DskipTests -Dgit.skip=true -Dmaven.gitcommitid.skip=true`：通过。
- `mvn -pl yshop-module-bidrank/yshop-module-bidrank-biz -am compile -DskipTests -Dgit.skip=true -Dmaven.gitcommitid.skip=true`：通过。
- `mvn -pl yshop-module-bidrank/yshop-module-bidrank-biz -am test -Dtest=BidAuctionServiceImplTest -Dsurefire.failIfNoSpecifiedTests=false -Dgit.skip=true -Dmaven.gitcommitid.skip=true`：通过，11 tests。
- `mvn -pl yshop-module-bidrank/yshop-module-bidrank-biz -am test`：未通过，基线测试 `DesensitizeTest` 失败（预期 `芋***`，实际 `y****`），失败发生在进入 bidrank 模块前，与本次改动无关。
- `pnpm build:prod`：通过。
- `pnpm ts:check`：未通过，仓库现有类型声明缺失：`@intlify/unplugin-vue-i18n/types`、`@types/qrcode`、`element-plus/global`、`vite-plugin-svg-icons/client`；未出现本次新增页面相关的错误。
- `git diff --check`：通过。

## 未执行项

- 真实支付沙箱、支付回调乱序/重复、退款结果和结算结果端到端验证：需要外部支付配置及测试数据。
- 管理端浏览器交互 E2E：当前只完成构建验证，页面为只读查询页。

## 计划命令

```bash
(cd .worktrees/backend-bidrank-auction-phase2 && mvn -pl yshop-module-bidrank/yshop-module-bidrank-biz -am test)
(cd .worktrees/backend-bidrank-auction-phase2 && mvn -pl yshop-server -am compile -DskipTests -Dgit.skip=true -Dmaven.gitcommitid.skip=true)
(cd .worktrees/admin-bidrank-auction-phase2 && pnpm ts:check)
(cd .worktrees/admin-bidrank-auction-phase2 && pnpm build:prod)
```

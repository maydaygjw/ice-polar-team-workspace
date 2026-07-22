# 商圈排名竞价 — Change Report（本期）

## 业务结果
平台运营可在后台按商圈配置**周期性排名竞价活动**（每周/每月，含提前天数/启动时间/活动时长/支付时长、排名档位、竞拍说明与规则），并按模块授权售卖（租户套餐菜单）。竞拍出价、结算、排序生效与小程序属延后期。

## 影响仓库
- `backend`（`feat/bidrank-auction`）：新增 `yshop-module-bidrank`（api+biz）、5 表 SQL、菜单、poms 注册。
- `admin`（`feat/bidrank-auction`）：新增竞价活动 API + 列表页 + 表单页。
- `miniapp`：本期无改动（延后期）。

## 契约 / 迁移
- **API**：新增 admin `/bidrank/auction/{create,update,enable,delete,get,page}`；跨模块 `BidRankSortApi`（契约本期定义、实现延后）。app-api/MQ/Job 延后期。
- **DB**：`sql/upgrade-2026-07-22-bidrank-auction.sql` 新增 5 表（bid_auction/bid_rank 本期启用，其余延后期），含菜单 seed 与回滚。破坏性变更含回滚语句。
- **权限**：菜单树 `商圈竞价 › 竞价活动` + `bidrank:auction:*`，经租户套餐 `menu_ids` 售卖。

## 验证结果
| 命令 | 结果 |
|------|------|
| `mvn -pl yshop-module-bidrank/...-biz -am compile` | ✅ BUILD SUCCESS |
| `mvn -pl yshop-server -am compile`（跳过 git-commit-id 插件） | ✅ BUILD SUCCESS |
| `mvn ... test -Dtest=BidAuctionServiceImplTest` | ✅ 11/11 通过 |
| `pnpm ts:check`（admin，vs 基线 diff） | ✅ 零新增类型错误 |
| 未执行 | `pnpm build:prod`（vue-tsc 已覆盖模板+类型） |

## 残余风险
- `dept_id` 未派生 → 部门级数据权限暂不生效（仅租户隔离）；量产前需 store-api 支持。
- 富文本置空受 MP `updateById` 限制。
- 时间派生 `nextEffectDate` 仅用于展示；实际排期 Job 属延后期。

## 建议 PR
标题：`feat(bidrank): 商圈排名竞价活动配置（本期 backend+admin）`
正文要点：见本报告 业务结果 / 影响仓库 / 契约迁移 / 验证结果 / 残余风险；标注延后期范围。含 DB 迁移（新增 5 表）。

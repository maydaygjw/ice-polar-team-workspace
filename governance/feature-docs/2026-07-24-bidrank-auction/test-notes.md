# 商圈排名竞价 — Test Notes（本期）

## 后端（backend，worktree `.worktrees/backend-bidrank-auction`，分支 `feat/bidrank-auction`）

### 已实现
- 新模块 `yshop-module-bidrank`（`-api` + `-biz`），包 `co.yixiang.yshop.module.bidrank`。
- `-api`：竞价模块自身 API；通用 `StoreShopSortApi` 契约归 `store-api`，实现位于 `store-biz`。
- `-biz`：`BidAuctionDO`/`BidRankDO`、Mapper、Convert、Service/ServiceImpl、`BidAuctionController`（admin CRUD + 启停）、错误码。
- SQL：`sql/upgrade-2026-07-22-bidrank-auction.sql`（4 张竞价表 + 1 张 store 通用排序表 + 菜单树 + 授权说明 + 回滚）。
- 注册：根 `pom.xml`、`yshop-server/pom.xml`。

### 编译结果
| 命令 | 结果 |
|------|------|
| `mvn -pl yshop-module-bidrank/yshop-module-bidrank-biz -am compile -DskipTests -o` | ✅ BUILD SUCCESS |
| `mvn -pl yshop-server -am compile -DskipTests -o -Dgit.skip=true -Dmaven.gitcommitid.skip=true` | ✅ BUILD SUCCESS |
| `mvn -pl yshop-module-bidrank/yshop-module-bidrank-biz -am test -Dtest=BidAuctionServiceImplTest` | ✅ Tests run: 11, Failures: 0, Errors: 0 |

### 单元测试（`BidAuctionServiceImplTest`，H2 `BaseDbUnitTest`）
覆盖 11 例：创建成功（默认模型/展示、档位落库）、区间/名额/价格校验异常、更新成功（含档位整表覆盖）、更新不存在、删除（级联档位）、详情（含下次生效日期派生）、详情不存在、启停、分页（含档位填充）。
测试资源：`src/test/resources/application-unit-test.yaml` + `sql/create_tables.sql`（yshop_bid_auction/yshop_bid_rank）+ `sql/clean.sql`。

> `git-commit-id-maven-plugin` 在 git worktree 布局下报 "Could not get HEAD Ref"，与本功能代码无关；用 `-Dgit.skip=true -Dmaven.gitcommitid.skip=true` 跳过后 server 正常编译。正式 CI（非 worktree）无此问题。
> mapstruct 提示 unmapped target（id/tenantId/deptId/auctionModel/displayMode/ranks 等）均为预期：由租户拦截器、Service 手动或读取时填充。

### 未执行 / 待补
- 竞价结算 Job 尚未接入 `StoreShopSortApi`；通用排序 API 已由 store 模块负责写入并派生 `dept_id`，排序注入仍属延后期。
- `updateById` 对 `description/rules` 置空不生效（MP 忽略 null）：如需清空富文本改用 UpdateWrapper。

## 前端（admin，worktree `.worktrees/admin-bidrank-auction`，分支 `feat/bidrank-auction`）

### 已实现
- `src/api/bidrank/auction/index.ts`：6 个接口（page/get/create/update/enable/delete）+ VO 类型。
- `src/views/bidrank/auction/index.vue`：列表（商圈/启用/主题筛选、商圈名映射、周期、生效/下次生效日期、启停开关、编辑/删除），权限码 `bidrank:auction:*`。
- `src/views/bidrank/auction/AuctionForm.vue`：活动表单（周期字段 + 富文本说明/规则 `<Editor>` + 排名档位可增删子表），前端校验与后端规则对齐。
- 路由：走后端菜单动态路由，组件路径 `bidrank/auction/index` 与 `component_name=BidRankAuction` 匹配 SQL 菜单，无需手写路由文件。

### 校验结果
| 命令 | 结果 |
|------|------|
| `pnpm ts:check`（worktree） | 4 处 TS2688 |
| `pnpm ts:check`（主 checkout 基线） | 4 处 TS2688（相同） |
| diff（worktree vs 基线） | **IDENTICAL —— 本功能新增 0 类型错误** |

> 4 处 TS2688（`element-plus/global`、`@types/qrcode` 等 `compilerOptions.types` 条目）为仓库既有基线问题，与本功能无关。worktree 无 `node_modules`，已 `pnpm install --frozen-lockfile` 后校验。
> 未跑 `pnpm build:prod`（vue-tsc 已覆盖模板+类型校验，且相对基线零新增）。

## 延后期（随小程序）
app-api 竞价/支付、结算 Job、退款 MQ、排序注入、miniapp —— 本期未实现，契约已在 `contract-changes.md` 定义。

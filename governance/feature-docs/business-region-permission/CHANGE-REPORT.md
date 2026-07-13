# Change Report: business-region-permission Phase 2A

## 概述

已完成 `business-region-permission` 特性第二阶段 A（Phase 2A）的实现与审查：

- 新增 `business-region` 经营区域模型，绑定部门，支持默认商圈。
- 门店绑定 `business-region` 并自动派生 `dept_id`。
- 引入 `yshop_store_shop_admin` 用户-门店多对多关系，替代 `admin_id` 逗号字符串。
- 登录态支持多个可管理门店 `shopIds`。
- 管理后台新增 `business-region` 管理页、门店表单/列表改造、门店管理员分配。

本期**不实现**小程序端；订单/设备/收入/提现等核心业务表的直接归属字段（Phase 2B）延后。

## 影响仓库与分支

| 仓库 | 分支 | 基础分支 |
|---|---|---|
| `backend/` | `feat/business-region-permission` | `master` |
| `admin/` | `feat/business-region-permission` | `master` |
| workspace root | `main`（已直接提交 Phase 1 文档） | `main` |

## 后端变更（backend/）

### 新增表与迁移

`sql/upgrade-2026-07-02-business-region-permission.sql`：

- 创建 `business_region` 表。
- 修改 `yshop_store_shop` 增加 `business_region_id`、`dept_id`。
- 创建 `yshop_store_shop_admin` 关系表。
- 修改 `system_oauth2_access_token` / `system_oauth2_refresh_token` 增加 `shop_ids`。
- 为每个租户创建默认商圈并绑定根部门。
- 回填门店 `business_region_id` / `dept_id`。
- 从 `admin_id` 逗号字符串迁移到 `yshop_store_shop_admin`（递归 CTE 支持任意长度）。

### 新增模块

| 路径 | 说明 |
|---|---|
| `controller/admin/businessregion/` | 商圈管理 Admin API |
| `service/businessregion/` | 商圈 Service / 默认商圈处理 |
| `dal/dataobject/businessregion/BusinessRegionDO.java` | 商圈 DO |
| `dal/mysql/businessregion/BusinessRegionMapper.java` | 商圈 Mapper |
| `controller/admin/storeshopadmin/` | 门店管理员分配 API |
| `service/storeshopadmin/` | 门店管理员关系 Service |
| `dal/dataobject/storeshopadmin/StoreShopAdminDO.java` | 关系 DO |
| `dal/mysql/storeshopadmin/StoreShopAdminMapper.java` | 关系 Mapper |
| `framework/datapermission/StoreDataPermissionConfiguration.java` | 部门数据权限注册 |
| `framework/web/ShopScope.java` | 当前用户门店范围工具 |

### 修改模块

| 路径 | 说明 |
|---|---|
| `framework/security/core/LoginUser.java` | 增加 `shopIds` |
| `framework/security/core/filter/TokenAuthenticationFilter.java` | 把 `shopIds` 写入 `LoginUser` |
| `module/system/.../OAuth2TokenServiceImpl.java` | 从关系表加载 `shopIds` 写入 token |
| `module/system/.../OAuth2AccessTokenDO.java` / `OAuth2RefreshTokenDO.java` | 增加 `shopIds`（JacksonTypeHandler） |
| `module/system/.../OAuth2AccessTokenCheckRespDTO.java` | 增加 `shopIds` |
| `module/store/.../StoreShopDO.java` | 增加 `businessRegionId`、`deptId` |
| `module/store/.../StoreShopServiceImpl.java` | 商圈校验、派生 `deptId`、多门店范围过滤 |
| `module/store/.../StoreShopMapper.java` | 分页支持 `shopIds` 和 `businessRegionId` |
| `module/store/.../ErrorCodeConstants.java` | 新增商圈错误码 |
| `module/store-biz/pom.xml` | 增加数据权限 starter 依赖 |

### 新增 Admin API

| 方法 | 路径 | 权限 |
|---|---|---|
| POST | `/admin-api/business-region/create` | `store:business-region:create` |
| PUT | `/admin-api/business-region/update` | `store:business-region:update` |
| DELETE | `/admin-api/business-region/delete` | `store:business-region:delete` |
| GET | `/admin-api/business-region/get` | `store:business-region:query` |
| GET | `/admin-api/business-region/page` | `store:business-region:query` |
| GET | `/admin-api/business-region/simple-list` | `store:business-region:query` |
| PUT | `/admin-api/business-region/set-default` | `store:business-region:update` |
| POST | `/admin-api/store/shop-admin/assign` | `store:shop:update` |
| GET | `/admin-api/store/shop-admin/list-by-user` | `store:shop:query` |
| GET | `/admin-api/store/shop-admin/list-by-shop` | `store:shop:query` |

## 前端变更（admin/）

| 路径 | 说明 |
|---|---|
| `src/api/mall/store/businessRegion/index.ts` | 商圈 API 客户端 |
| `src/api/mall/store/shopAdmin/index.ts` | 门店管理员分配 API 客户端 |
| `src/views/mall/store/businessRegion/index.vue` | 商圈列表页 |
| `src/views/mall/store/businessRegion/BusinessRegionForm.vue` | 商圈表单弹窗 |
| `src/views/mall/store/shop/index.vue` | 门店列表增加商圈列、筛选、分配管理员入口 |
| `src/views/mall/store/shop/ShopForm.vue` | 门店表单增加商圈选择器 |
| `src/views/mall/store/shop/ShopAdminAssignForm.vue` | 门店管理员分配弹窗 |
| `src/store/modules/user.ts` | 用户上下文增加 `shopId` / `shopIds` |
| `src/api/mall/store/shop/index.ts` | `ShopVO` 增加商圈相关字段 |
| `e2e/business-region-permission.spec.ts` | Phase 2A E2E 用例 |

## Governance 变更（workspace root，已提交 main）

- `governance/CONTRACTS.md`：增加 Business Region 与门店权限合同。
- `governance/ADR/adr-001-business-region-permission.md`：架构决策记录。
- `governance/feature-docs/business-region-permission/`：需求规格、技术设计、合同变更、UI/UX 设计、测试计划、Phase 1 关口报告。

## 审查结论

| 检查项 | 状态 | 说明 |
|---|---|---|
| 实现符合需求规格 | 通过 | Phase 2A 范围全部实现，Phase 2B 延后。 |
| API 合同一致 | 通过 | 与 `contract-changes.md` 一致。 |
| 无硬编码 secrets | 通过 | 未发现。 |
| 租户隔离 | 通过 | 新表均含 `tenant_id`；Mapper 查询含租户条件。 |
| 迁移脚本 | 通过 | 已创建并包含回 fill 和兼容迁移。 |
| 测试覆盖 | 部分 | 已写 E2E spec，待环境可用后执行。 |
| ADR | 通过 | 已创建并采纳。 |
| 分支命名 | 通过 | `feat/business-region-permission`。 |
| 无 SQL 注入 | 通过 | 已移除本次新增/修改代码中的 `FIND_IN_SET` 拼接。 |
| 部门数据权限 | 通过 | 已注册 `BusinessRegionDO` 和 `StoreShopDO` 的 `dept_id` 列。 |
| 多门店范围过滤 | 通过 | `StoreShopServiceImpl` 已接入 `ShopScope`。 |

## 已知限制与风险

1. **Java 17 环境缺失**：当前机器只有 Java 11，无法本地执行 `mvn compile/package` 和生成 `openapi.json`；需要在具备 Java 17 的环境重新构建验证。
2. **OpenAPI 快照未更新**：`governance/CONTRACT/backend-api.json` 未能重新生成，需在 Java 17 环境构建后运行 `extract-openapi`。
3. **历史遗留 SQL 注入**：`AdminUserServiceImpl` 中仍有 `FIND_IN_SET` 拼接（非本次改动文件），建议后续统一清理。
4. **前端菜单/路由未注册**：新增 `business-region` 页面未自动注册到系统菜单，需运维或管理员在后台权限菜单中配置，或补充路由配置。
5. **E2E 未实际执行**：`business-region-permission.spec.ts` 已编写，但依赖本地前后端服务，未在本机运行。

## 下一步

1. 用户在具备 Java 17 的环境验证后端编译和 OpenAPI 生成。
2. 补充运行 E2E 测试。
3. 配置管理后台 `business-region` 菜单/路由。
4. 创建并合并 `backend/` 和 `admin/` 的 Pull Request。

## 建议

批准进入 Phase 3.3（创建 PR）并合并到各自基础分支。

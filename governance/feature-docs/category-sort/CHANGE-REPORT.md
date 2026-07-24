# 变更报告 — category-sort

## 业务结果
- 后台分类列表支持**拖拽排序**，同级 drag → 批量落库 → 列表按新顺序展示。
- 排序口径由 `id DESC` 修正为 `sort ASC, id ASC`（DB 层），不再依赖内存排序。

## 影响仓库
| 仓库 | 变更 |
|---|---|
| `backend` | Controller(Mapper/Servce/VO 新增 1+改 3)、新增 `PUT /update-sort` 批量排序接口、Mapper 排序修正 |
| `admin` | `index.vue` 拖拽手柄列+sortablejs 同级拖拽、`category.ts` 新增 API、`package.json` 新增 sortablejs/@types 依赖 |

## 契约变化
- 新增: `PUT /product/category/update-sort`（复用 `product:category:update` 权限）
- 行为修正: `GET /product/category/list` 排序字段改变（sort ASC, id ASC）
- DB: 无结构变更，无 upgrade SQL

## 验证
| 命令 | 结果 |
|---|---|
| `mvn -pl product-biz -am compile` | pass |
| `mvn -pl product-biz surefire:test` | pass (0 tests) |
| `pnpm ts:check` | pass (无新增错误) |
| `pnpm build:prod` | pass |

## 残余风险
- 拖拽在复杂树结构中仅校验邻级同 parent，极端跨多级未测
- 小程序端排序本次不动，C 端不生效（待后续）
- 未执行 E2E/集成测试

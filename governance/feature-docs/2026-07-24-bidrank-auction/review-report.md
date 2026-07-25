# 商圈排名竞价 — Review Report（本期）

自审范围：`feat/bidrank-auction` 两个 worktree（backend + admin）的本期改动。

## 结论
无阻塞问题。编译（模块 + 全 server）、11 例单测、admin `ts:check`（相对基线零新增）均通过。可进入交付。

## 检查项
| 项 | 结论 |
|----|------|
| 模块依赖方向（biz→api，无跨 biz） | ✅ 竞价写入排序结果改经 store-api；store 不依赖 bidrank-biz |
| 多租户隔离 | ✅ DO 含 tenant_id，拦截器自动注入；查询未跨租户 |
| API 前缀 / 权限码 | ✅ `/admin-api` 前缀（框架统一加），`bidrank:auction:*` 与菜单一致 |
| 金额单位一致 | ✅ 元 decimal(10,2)，DO/VO/SQL/前端对齐 |
| 校验双端一致 | ✅ 前端与 Service 同规则（区间/名额/价格/比例/时长） |
| 历史/财务不可变 | N/A 本期（bid_order_his 等延后期） |
| SQL 幂等 + 回滚 | ✅ 菜单幂等插入；回滚段含 DROP + DELETE |
| 事务一致性 | ✅ create/update/delete 加 `@Transactional`（活动+档位原子） |

## 待补（非阻塞，已记入 test-notes）
1. `dept_id` 未从商圈派生（数据权限精化）——需 store-api 暴露商圈 dept。
2. `updateById` 忽略 null，富文本 `description/rules` 置空不生效——如需清空改 UpdateWrapper。
3. `getAuctionPage` 按行查档位（N+1）——admin 分页量小可接受，量大再批量化。

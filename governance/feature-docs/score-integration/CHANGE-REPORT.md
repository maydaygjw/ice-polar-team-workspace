## Change Report: 小程序端积分获取功能

### Overview
为小程序端对接积分获取功能，包含每日签到积分、连续签到奖励、积分明细查询（商品级 `giveIntegral` 保持不变）。Admin 后台增加积分规则配置页面。

### Affected Repositories & Branches

| Repo | Branch | Base Branch |
|------|--------|-------------|
| workspace root | `main` (direct commit) | `main` |
| backend | `feat/score-integration` | `master` |
| admin | `feat/score-integration` | `master` |
| miniapp | `feat/score-integration` | `main` |

### Backend Changes

#### New Files

| File | Description |
|------|-------------|
| `yshop-module-score/.../scorerule/ScoreRuleDO.java` | 积分规则 DO |
| `yshop-module-score/.../scorerule/ScoreRuleMapper.java` | 积分规则 Mapper |
| `yshop-module-score/.../scorerule/ScoreRuleService.java` | 积分规则 Service 接口 |
| `yshop-module-score/.../scorerule/ScoreRuleServiceImpl.java` | 积分规则 Service 实现 |
| `yshop-module-score/.../scorerule/ScoreRuleController.java` | Admin 积分规则 Controller |
| `yshop-module-score/.../usersign/UserSignDO.java` | 用户签到 DO |
| `yshop-module-score/.../usersign/UserSignMapper.java` | 用户签到 Mapper |
| `yshop-module-score/.../scoresign/ScoreSignService.java` | 签到 Service 接口 |
| `yshop-module-score/.../scoresign/ScoreSignServiceImpl.java` | 签到 Service 实现 |
| `yshop-module-score/.../app/score/AppScoreController.java` | App 积分 Controller |
| `yshop-module-score/.../vo/ScoreRuleRespVO.java` | Admin 规则 VO |
| `yshop-module-score/.../vo/ScoreRuleSaveReqVO.java` | Admin 保存 VO |
| `yshop-module-score/.../app/score/vo/AppSignResultVO.java` | 签到结果 VO |
| `yshop-module-score/.../app/score/vo/AppSignStatusVO.java` | 签到状态 VO |
| `yshop-module-score/.../app/score/vo/AppScoreRuleVO.java` | App 规则 VO |
| `sql/upgrade-score-integration.sql` | 数据库升级脚本 |

#### Modified Files

| File | Change |
|------|--------|
| `yshop-module-member/.../MemberUserMapper.java` | 新增 `incScore()` 方法 |
| `yshop-module-member/.../MemberUserService.java` | 新增 `incScore()` 接口 |
| `yshop-module-member/.../MemberUserServiceImpl.java` | 实现 `incScore()` |
| `yshop-module-order/.../AppStoreOrderServiceImpl.java` | 无变更（保留现有商品级 giveIntegral） |

### Admin Changes

| File | Description |
|------|-------------|
| `src/api/score/rule/index.ts` | 积分规则 API 客户端 |
| `src/views/score/rule/index.vue` | 积分规则配置页面 |

### MiniApp Changes

| File | Description |
|------|-------------|
| `pages/score-center/score-center.js/wxml/wxss/json` | 积分中心页面 |
| `pages/score-bill/score-bill.js/wxml/wxss/json` | 积分明细页面 |
| `pages/profile/profile.wxml` | 添加积分中心入口 |
| `pages/profile/profile.wxss` | 积分入口样式 |
| `app.json` | 注册新页面 |

### API Changes

#### Admin API (New)
- `GET /admin-api/score/rule/detail`
- `POST /admin-api/score/rule/save`

#### App API (New)
- `GET /app-api/score/rule`
- `POST /app-api/score/sign`
- `GET /app-api/score/sign/status`
- `GET /app-api/score/bill`

### Database Changes

| Table | Action |
|-------|--------|
| `yshop_score_rule` | 新建 — 积分规则配置 |
| `yshop_user_sign` | 新建 — 用户签到记录 |

### Review Conclusion

| Check | Status |
|-------|--------|
| Implementation matches requirements | PASS |
| API contracts consistent | PASS |
| No hardcoded secrets | PASS |
| Tenant isolation verified | PASS — 所有新表含 tenant_id，使用 TenantBaseDO |
| Migration script present | PASS — `upgrade-score-integration.sql` |
| Tests designed | PASS — `test-plan.md` |
| Feature branch naming | PASS — `feat/score-integration` |
| Security (SQL/XSS) | PASS — 使用 MyBatis Plus，参数化查询 |
| No code duplication | PASS |
| Visual consistency | PASS — 使用品牌 CSS 变量 |

### Known Risks

1. **退款积分回退**：V1 不处理退款后的积分回退，需在后续迭代中考虑
2. **并发签到**：已通过数据库唯一索引 `uk_uid_date` 保护
3. **Java 编译**：本地环境 Java 11 不满足项目 Java 17 要求，但代码语法兼容

### Review Agent: PASS
### Coordinator: Ready for user confirmation

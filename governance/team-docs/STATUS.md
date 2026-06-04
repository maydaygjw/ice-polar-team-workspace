## Status: 小程序使用优惠券功能 — Phase 6 (Completed with Fixes)

### Gates
- [x] requirements spec complete
- [x] technical design complete
- [x] CONTRACTS.md updated (including module dependency rules)
- [x] implementation complete
- [x] review passed
- [x] PRs created and merged
- [x] branches cleaned up

### Agent Progress
| Agent | Status | Notes |
|-------|--------|-------|
| backend-agent | done | amended: pom dependency fixed `coupon-biz` → `coupon-api`, added `CouponApi`/`CouponUserDTO` |
| miniapp-agent | done | fixed: commits moved from `main` to `feat/coupon-miniapp` branch |
| review-agent | done | 2 bugs found & fixed |

### Branches
| Repo | Branch | Status |
|------|--------|--------|
| backend (yshop-drink) | feat/coupon-miniapp | pushed to Gitee |
| miniapp (icepolarminiapp) | feat/coupon-miniapp | pushed to Gitee |
| workspace | main | merged and pushed to GitHub |

### Fixes Applied (Post-Review)

#### 1. 模块依赖架构规则修复
**问题**: `yshop-module-device-biz` pom 直接依赖 `yshop-module-coupon-biz`，违反了"跨模块只能依赖 `-api`"的原则。

**修复**:
- `yshop-module-coupon-api`: 新增 `CouponApi` 接口 + `CouponUserDTO`
- `yshop-module-coupon-biz`: 新增 `CouponApiImpl` 实现
- `yshop-module-device-biz/pom.xml`: `yshop-module-coupon-biz` → `yshop-module-coupon-api`
- `DeviceManagementServiceImpl`: 注入 `CouponApi` 接口，使用 `CouponUserDTO`

#### 2. Miniapp 分支规范修复
**问题**: Feature 开发直接提交到 `main` 分支，未创建 feature branch。

**修复**:
- `main` 回滚到 feature 前状态 (`317f909`)
- 创建 `feat/coupon-miniapp` 分支，cherry-pick feature commits
- 两个分支都正确推送到远程

#### 3. Code Review Bug Fixes
- API 响应结构错误 (`res.data.data.list` → `res.data.data`)
- WXML `data-id` 字符串类型不匹配 (添加 `parseInt`)

### New Architecture Rule (CONTRACTS.md)
```
## Module Dependency Rules
跨模块调用必须通过 `-api` 模块
module-a-biz ──→ module-b-api (接口 + DTO)
                      ↑
              module-b-biz (实现)
```

# 代码质量整改待办清单

> 生成日期：2026-06-02
> 依据报告：后端开发报告 / 前端开发报告 / 架构师报告
> 排列顺序：架构 → 后端 → 前端
> 优先级：P0（阻塞发布）→ P1（限期修复）→ P2（建议修复）

---

## 优先级说明

| 级别 | 颜色 | 含义 | 处理时限 |
|------|------|------|----------|
| P0 | 🔴 | 安全漏洞/架构红线违规 | 1-2 天，阻塞发版 |
| P1 | 🟠 | 架构合规缺陷/稳定性风险 | 1 周，必须在下次发版前完成 |
| P2 | 🟡 | 代码质量/性能优化/技术债务 | 1-2 周，不阻塞发版但需排期 |

---

## 一、架构师负责（P0）

### 🔴 P0-01 [架构] 制定 MiniApp → DMS 直连的修复方案并补全 API 契约

| 字段 | 内容 |
|------|------|
| **问题** | `miniapp/pages/device-detail/device-detail.js` 直接调用 DMS API，绕过 backend |
| **位置** | `miniapp/pages/device-detail/device-detail.js:67-68`、`miniapp/app.js:13` |
| **严重程度** | P0 — 架构红线违规，设备可被未授权操控 |
| **验收标准** | ① 删除 MiniApp 所有 `wx.request` 调用 DMS 的代码 ② `app.globalData.dmsUrl` 被移除 ③ CONTRACTS.md 补充 Device API Contract |
| **负责人** | 架构师 |
| **依赖** | 无 |
| **预计工时** | 4h |
| **状态** | ⬜ 待开始 |

**任务拆分：**
- [ ] 设计 Device Proxy API 接口（backend `yshop-module-device-biz` 新增）
  - `GET /app-api/device/status/{imei}` — 查询设备状态
  - `POST /app-api/device/command/{imei}/{type}` — 下发设备指令
  - 请求/响应 DTO 设计，需包含 tenant-id 校验
- [ ] 编写 API 设计文档，更新 CONTRACTS.md
- [ ] 评审通过后交 backend-agent 实现
- [ ] 评审通过后交 miniapp-agent 改造调用链路

---

### 🔴 P0-02 [架构] 制定订单状态枚举统一方案并输出迁移计划

| 字段 | 内容 |
|------|------|
| **问题** | 三套 `OrderStatusEnum` + `OrderInfoEnum` 对同一 status 值定义不一致 |
| **位置** | `yshop-module-order-api/.../OrderStatusEnum`、`yshop-common/.../OrderInfoEnum`、`yshop-module-merchant/.../OrderStatusEnum` |
| **严重程度** | P0 — 状态判断极易出错，可能导致订单流程异常 |
| **验收标准** | ① 仅存一套枚举 ② 所有模块引用统一 ③ 状态机转换矩阵定义 ④ 存量数据兼容方案 |
| **负责人** | 架构师 |
| **依赖** | 无 |
| **预计工时** | 8h |
| **状态** | ⬜ 待开始 |

**任务拆分：**
- [ ] 梳理三份枚举的所有引用点（backend + admin + miniapp）
- [ ] 设计统一状态机：`paid` + `refund_status` + `status` → 单一 `order_status` 字段（长期目标）
- [ ] 短期方案：统一为 `yshop-common` 中 `OrderStatusEnum`，其他标记 @Deprecated
- [ ] 编写迁移计划文档，含回滚方案
- [ ] 评审通过后交 backend-agent 执行迁移

---

## 二、后端开发负责（P0）

### 🔴 P0-03 [后端] 清除 application-dev.yaml 中所有硬编码 secrets

| 字段 | 内容 |
|------|------|
| **问题** | `application-dev.yaml` 硬编码数据库密码、Redis密码、微信Secret、钉钉Secret等 |
| **位置** | `yshop-server/src/main/resources/application-dev.yaml` 第 51、56、64、175、187、226 行等 |
| **严重程度** | P0 — 所有凭证直接暴露，仓库泄露等于全系统沦陷 |
| **验收标准** | ① 无任何明文密码/secret ② 提供 `.env.example` 模板 ③ 启动检测默认值输出 WARN 日志 |
| **负责人** | 后端开发 |
| **依赖** | 无 |
| **预计工时** | 2h |
| **状态** | ⬜ 待开始 |

**任务拆分：**
- [ ] `application-dev.yaml` → 所有敏感字段改为 `${ENV_VAR:default}`
- [ ] `application-local.yaml` → 同步修改
- [ ] 新增 `.env.example` 模板文件，含所有必填环境变量说明
- [ ] 启动时检测默认值（如 `admin123456`），输出 `WARN: 检测到默认密码，请配置环境变量`
- [ ] 同步检查 `application.yaml` 生产配置（不应含硬编码）

---

### 🔴 P0-04 [后端] 清除 icepolar-dms 硬编码弱密码

| 字段 | 内容 |
|------|------|
| **问题** | `icepolar-dms/app/config.py` 硬编码 DB_PASSWORD、SECRET_KEY、ADMIN_PASSWORD |
| **位置** | `icepolar-dms/app/config.py:17`、`app/config.py:43`、`app/config.py:47` |
| **严重程度** | P0 — 弱密码可被暴力破解，JWT 可伪造 |
| **验收标准** | ① 无环境变量时启动失败 ② 密码强度校验（>=8位，含大小写+数字+特殊字符） ③ `.env.example` 文档 |
| **负责人** | 后端开发（DMS侧） |
| **依赖** | 无 |
| **预计工时** | 2h |
| **状态** | ⬜ 待开始 |

**任务拆分：**
- [ ] `config.py` 改为 `os.getenv()` 读取，无值时 raise RuntimeError
- [ ] 启动时校验密码强度，弱密码直接启动失败
- [ ] 更新 `docker-compose.yml` 移除默认密码，改为 `${MYSQL_ROOT_PASSWORD}`
- [ ] 更新 `README.md` / `.env.example` 说明生产环境配置要求
- [ ] 注意：`icepolar-dms` 不允许 push，变更后用户手动推送

---

### 🔴 P0-05 [后端] 清理模块间 DAO/Mapper/DO 直接引用

| 字段 | 内容 |
|------|------|
| **问题** | `system-biz` 直接引用 `store` DAO，`order-biz` 直接引用 `desk/product/member` DAO 等 |
| **位置** | 涉及 system、order、member、merchant、message 等多个模块 |
| **严重程度** | P0 — 模块边界彻底失效，分层架构形同虚设 |
| **验收标准** | ① `system-biz` 不再引用任何 `store` 类 ② CI 增加 ArchUnit/Maven Enforcer 禁止跨模块 DAO 引用 |
| **负责人** | 后端开发 |
| **依赖** | 架构师评审方案（P0-02 依赖此方案） |
| **预计工时** | 8h（分阶段） |
| **状态** | ⬜ 待开始 |

**任务拆分（第一阶段，先处理最严重）：**
- [ ] `system-biz` → `store`：将 `StoreShopDO/Mapper` 引用改为 `store-api` 接口调用
- [ ] `message-biz` → `member/mp`：改为 API 调用，DTO 传递数据
- [ ] CI 引入 ArchUnit 规则：`.*-biz` 不得 import `co.yixiang.yshop.module.*.dal.mysql.*`

---

## 三、前端开发负责（P0）

### 🔴 P0-06 [前端] 删除 MiniApp 中 DMS 直连代码

| 字段 | 内容 |
|------|------|
| **问题** | `device-detail.js` 直接 `wx.request` 调用 DMS API |
| **位置** | `miniapp/pages/device-detail/device-detail.js:67-68`、`miniapp/pages/device-detail/device-detail.js:164-165`、`miniapp/app.js:13` |
| **严重程度** | P0 — 架构红线，设备可被未授权操控 |
| **验收标准** | ① 无任何 `wx.request` 调用 DMS 地址 ② `app.globalData.dmsUrl` 已删除 ③ 所有设备操作改为 `wx.request` 调用 backend API |
| **负责人** | 前端开发（小程序） |
| **依赖** | P0-01（架构师设计 backend API） |
| **预计工时** | 4h |
| **状态** | ⬜ 待开始（等待 P0-01） |

**任务拆分：**
- [ ] 删除 `app.js` 中 `dmsUrl` 全局变量
- [ ] 删除 `device-detail.js` 中所有 DMS `wx.request` 调用
- [ ] 根据 P0-01 设计的 backend API，重写设备状态查询和指令下发逻辑
- [ ] 全局搜索 `dms.holuntech.com`，确保无任何残留

---

### 🔴 P0-07 [前端] 删除 MiniApp Mock 登录代码

| 字段 | 内容 |
|------|------|
| **问题** | `select-cup.js` 中包含完整 Mock 登录逻辑，可绕过微信授权 |
| **位置** | `miniapp/pages/select-cup/select-cup.js:410-455` |
| **严重程度** | P0 — 可生成随机手机号假登录，严重安全漏洞 |
| **验收标准** | ① 无 Mock 登录逻辑残留 ② 所有页面统一调用真实 `auth-miniapp-login` 接口 |
| **负责人** | 前端开发（小程序） |
| **依赖** | 无 |
| **预计工时** | 1h |
| **状态** | ⬜ 待开始 |

**任务拆分：**
- [ ] 删除 `select-cup.js` 中 Mock 登录代码块
- [ ] 统一为调用 `wx.login` → 后端 `auth-miniapp-login` 接口
- [ ] 全局搜索 `mock_openid`、`mockPhone` 等关键字，确保无残留

---

### 🔴 P0-08 [前端] 统一 MiniApp API 调用为 HTTPS

| 字段 | 内容 |
|------|------|
| **问题** | `profile.js` 头像上传硬编码使用 HTTP |
| **位置** | `miniapp/pages/profile/profile.js:390` |
| **严重程度** | P0 — 中间人攻击风险 |
| **验收标准** | ① 无任何 `http://` 硬编码 URL ② 所有 API 调用统一走 `config.api.baseUrl`（HTTPS） |
| **负责人** | 前端开发（小程序） |
| **依赖** | 无 |
| **预计工时** | 30min |
| **状态** | ⬜ 待开始 |

---

### 🔴 P0-09 [前端] 移除 Admin 前端硬编码 RSA 私钥

| 字段 | 内容 |
|------|------|
| **问题** | `jsencrypt.ts` 中 RSA 私钥直接硬编码在源码中 |
| **位置** | `admin/src/utils/jsencrypt.ts:5-17` |
| **严重程度** | P0 — 任何人可从构建产物提取密钥，解密所有密码 |
| **验收标准** | ① 前端无任何私钥 ② 生产环境 RSA 密钥对立即轮换 ③ 优先使用 HTTPS 替代客户端加密 |
| **负责人** | 前端开发（Admin） |
| **依赖** | 无 |
| **预计工时** | 2h |
| **状态** | ⬜ 待开始 |

**任务拆分：**
- [ ] 删除 `jsencrypt.ts` 中 `privateKey` 变量
- [ ] 方案 A：如仍需前端加密，改为运行时从服务端获取公钥
- [ ] 方案 B（推荐）：移除前端加密，依赖 HTTPS 传输安全
- [ ] 服务端立即轮换 RSA 密钥对

---

### 🔴 P0-10 [前端] 移除 Admin dangerouslyUseHTMLString

| 字段 | 内容 |
|------|------|
| **问题** | Axios 错误处理器直接渲染后端错误消息为 HTML |
| **位置** | `admin/src/config/axios/service.ts:162` |
| **严重程度** | P0 — XSS 攻击面，恶意脚本可在管理后台执行 |
| **验收标准** | ① 无 `dangerouslyUseHTMLString: true` ② 错误消息纯文本渲染 或 经 DOMPurify sanitize |
| **负责人** | 前端开发（Admin） |
| **依赖** | 无 |
| **预计工时** | 30min |
| **状态** | ⬜ 待开始 |

---

### 🔴 P0-11 [前端] 修复 Admin 17 处表单校验未检查返回值

| 字段 | 内容 |
|------|------|
| **问题** | 17 个表单组件中 `await formRef.value.validate()` 未捕获或未检查返回值 |
| **位置** | 分散在 `admin/src/views/**/.../*.vue`，如 `MerchantDetailsForm.vue:169` 等 |
| **严重程度** | P0 — 无效表单可能提交，导致数据损坏 |
| **验收标准** | ① 所有表单统一封装 `validateForm()` 方法 ② 无效时阻止提交 |
| **负责人** | 前端开发（Admin） |
| **依赖** | 无 |
| **预计工时** | 3h |
| **状态** | ⬜ 待开始 |

**任务拆分：**
- [ ] 全局搜索 `formRef.value.validate()`，列出 17 处位置
- [ ] 统一改为：`const valid = await formRef.value.validate().catch(() => false); if (!valid) return`
- [ ] 或提取为 composable：`useFormValidation()`

---

## 四、架构师负责（P1）

### 🟠 P1-01 [架构] 补充 CONTRACTS.md 核心契约

| 字段 | 内容 |
|------|------|
| **问题** | `CONTRACTS.md` 仅覆盖 ~20%，Device/Order/Payment/DMS/Member Auth 契约全部缺失 |
| **位置** | `governance/CONTRACTS.md` |
| **验收标准** | ① 至少覆盖 Device/Order/Payment 三大核心契约 ② 每次跨仓库变更需同步更新 |
| **负责人** | 架构师 |
| **依赖** | P0-01、P0-02 |
| **预计工时** | 8h |
| **状态** | ⬜ 待开始 |

**任务拆分：**
- [ ] Device API Contract（设备状态查询、指令下发、错误码映射）
- [ ] Order API Contract（创建、支付、查询、取消、退款、状态机）
- [ ] Payment API Contract（支付回调、状态查询、退款通知）
- [ ] Member Auth Contract（登录、授权、Token 刷新）
- [ ] DMS API Contract（backend 与 DMS 的交互协议）

---

### 🟠 P1-02 [架构] 引入 CI 架构守卫规则

| 字段 | 内容 |
|------|------|
| **问题** | 模块间 DAO 引用无自动化拦截 |
| **验收标准** | ① CI 中增加 ArchUnit/Maven Enforcer ② PR 自动检查跨模块 dal 引用 ③ secrets 扫描（GitLeaks） |
| **负责人** | 架构师 + DevOps |
| **预计工时** | 8h |
| **状态** | ⬜ 待开始 |

---

## 五、后端开发负责（P1）

### 🟠 P1-03 [后端] order 模块统一枚举引用

| 字段 | 内容 |
|------|------|
| **问题** | `order-biz` 同时混用 `OrderStatusEnum` 和 `OrderInfoEnum` |
| **位置** | `OrderApiImpl.java`、`AppStoreOrderServiceImpl.java` 等 |
| **验收标准** | ① order 模块仅引用 `OrderStatusEnum` ② `OrderInfoEnum` 状态常量标记 `@Deprecated` |
| **负责人** | 后端开发 |
| **依赖** | P0-02（架构师统一方案） |
| **预计工时** | 4h |
| **状态** | ⬜ 待开始（等待 P0-02） |

---

### 🟠 P1-04 [后端] DMS 调用增加熔断/重试/超时

| 字段 | 内容 |
|------|------|
| **问题** | `HttpClientUtils` 裸调 DMS，无熔断保护 |
| **位置** | `yshop-module-device-biz/.../HttpClientUtils.java` |
| **验收标准** | ① 引入 Resilience4j/Sentinel ② 配置超时 5s、重试 3 次、熔断阈值 |
| **负责人** | 后端开发 |
| **依赖** | 无 |
| **预计工时** | 4h |
| **状态** | ⬜ 待开始 |

---

### 🟠 P1-05 [后端] @TenantIgnore 使用审计

| 字段 | 内容 |
|------|------|
| **问题** | `UserBillServiceImpl`、`AppStoreOrderServiceImpl` 中 `@TenantIgnore` 无文档说明 |
| **位置** | `UserBillServiceImpl.java:50`、`AppStoreOrderServiceImpl.java:797` |
| **验收标准** | ① 每个 @TenantIgnore 添加详细注释 ② 建立定期审计机制 |
| **负责人** | 后端开发 |
| **预计工时** | 2h |
| **状态** | ⬜ 待开始 |

---

### 🟠 P1-06 [后端] RevenueJob @TenantIgnore 恢复

| 字段 | 内容 |
|------|------|
| **问题** | `RevenueJob.java:33` 中 `@TenantIgnore` 被注释掉 |
| **验收标准** | ① 确认执行方式 ② 若需跨租户统计则取消注释 |
| **负责人** | 后端开发 |
| **预计工时** | 1h |
| **状态** | ⬜ 待开始 |

---

### 🟠 P1-07 [后端] 提升核心模块测试覆盖率

| 字段 | 内容 |
|------|------|
| **问题** | backend 测试文件 62 个，但核心模块（order/pay/device）覆盖率可能低于 60% |
| **验收标准** | ① order/pay/device 模块 >= 60% ② DMS >= 80% |
| **负责人** | 后端开发 + Test |
| **预计工时** | 16h |
| **状态** | ⬜ 待开始 |

---

## 六、前端开发负责（P1）

### 🟠 P1-08 [前端] MiniApp 27 处 API 请求补全 fail 处理

| 字段 | 内容 |
|------|------|
| **问题** | 37 处请求中 27 处缺少 fail 回调 |
| **验收标准** | ① 所有 `wx.request` 有 fail 回调 ② 或统一使用 `app.request()` 封装 |
| **负责人** | 前端开发（小程序） |
| **依赖** | 无 |
| **预计工时** | 4h |
| **状态** | ⬜ 待开始 |

---

### 🟠 P1-09 [前端] MiniApp 实现 Token 自动刷新

| 字段 | 内容 |
|------|------|
| **问题** | 存储了 refreshToken 但从未使用，401 直接登出 |
| **位置** | `miniapp/app.js:179-183` |
| **验收标准** | ① 401 时调用 `/app-api/member/auth/refresh-token` ② 刷新成功后重试原请求 |
| **负责人** | 前端开发（小程序） |
| **依赖** | 无 |
| **预计工时** | 4h |
| **状态** | ⬜ 待开始 |

---

### 🟠 P1-10 [前端] MiniApp 敏感数据加密存储

| 字段 | 内容 |
|------|------|
| **问题** | accessToken/refreshToken/userInfo 明文存储 |
| **位置** | `miniapp/app.js:115-126` |
| **验收标准** | ① AES 加密后存储 ② 或设置合理过期时间 ③ 登出时清除所有存储 |
| **负责人** | 前端开发（小程序） |
| **预计工时** | 2h |
| **状态** | ⬜ 待开始 |

---

### 🟠 P1-11 [前端] MiniApp Tenant ID 统一配置

| 字段 | 内容 |
|------|------|
| **问题** | tenant-id 在多处硬编码，部分页面手动构造 header |
| **位置** | `config/config.js:14`、`profile.js:394`、`refund.js:138` |
| **验收标准** | ① config.js 统一定义 `tenantId` ② `getAuthHeaders()` 自动注入 ③ 禁止页面手动构造 |
| **负责人** | 前端开发（小程序） |
| **预计工时** | 2h |
| **状态** | ⬜ 待开始 |

---

### 🟠 P1-12 [前端] MiniApp 登录逻辑提取公共模块

| 字段 | 内容 |
|------|------|
| **问题** | 登录逻辑在 scan.js/map.js/profile.js/select-cup.js 中重复约 150 行 |
| **验收标准** | ① 提取为 `utils/login.js` ② 所有页面统一调用 |
| **负责人** | 前端开发（小程序） |
| **预计工时** | 3h |
| **状态** | ⬜ 待开始 |

---

### 🟠 P1-13 [前端] Admin 清理 255 处 `any` 类型

| 字段 | 内容 |
|------|------|
| **问题** | 全仓库 255 处 `any` 类型，完全绕过 TypeScript 检查 |
| **位置** | `config/axios/index.ts`、`hooks/web/useTable.ts` 等 |
| **验收标准** | ① API 请求有严格类型接口 ② `useTable` 泛型强制传参 ③ 核心模块 any 清理率 >= 80% |
| **负责人** | 前端开发（Admin） |
| **预计工时** | 8h（分阶段） |
| **状态** | ⬜ 待开始 |

---

### 🟠 P1-14 [前端] Admin 统一 tenant header 注入

| 字段 | 内容 |
|------|------|
| **问题** | tenant-id 在业务组件中手动拼接 |
| **位置** | `MerchantDetailsForm.vue` 等 |
| **验收标准** | ① 所有 API 走 axios interceptor ② 禁止业务代码手动构造 tenant-id header |
| **负责人** | 前端开发（Admin） |
| **预计工时** | 2h |
| **状态** | ⬜ 待开始 |

---

### 🟠 P1-15 [前端] Admin 修复 Permission Store 错误吞没

| 字段 | 内容 |
|------|------|
| **问题** | Promise constructor 内用 async executor，错误被静默吞没 |
| **位置** | `admin/src/store/modules/permission.ts:34-57` |
| **验收标准** | ① 改为标准 async/await + try/catch ② 错误时输出日志并抛出 |
| **负责人** | 前端开发（Admin） |
| **预计工时** | 1h |
| **状态** | ⬜ 待开始 |

---

### 🟠 P1-16 [前端] Admin 修复 User Store 缓存直接修改

| 字段 | 内容 |
|------|------|
| **问题** | `wsCache.get()` 对象被直接修改后 set 回缓存 |
| **位置** | `admin/src/store/modules/user.ts:67-79` |
| **验收标准** | ① cloneDeep 后再修改 ② 增加 null check |
| **负责人** | 前端开发（Admin） |
| **预计工时** | 1h |
| **状态** | ⬜ 待开始 |

---

## 七、P2 级问题（建议修复，不阻塞发版）

### 🟡 P2-01 [前端] Admin 清理 189 处 console.log

| **负责人** | 前端（Admin） | **预计工时** | 2h | **状态** | ⬜ 待开始 |

### 🟡 P2-02 [前端] MiniApp 拆分过大 WXSS 文件

| **负责人** | 前端（小程序） | **预计工时** | 4h | **状态** | ⬜ 待开始 |

### 🟡 P2-03 [前端] MiniApp 引入轻量级状态管理

| **负责人** | 前端（小程序） | **预计工时** | 8h | **状态** | ⬜ 待开始 |

### 🟡 P2-04 [前端] MiniApp 清理 46 处 console.log

| **负责人** | 前端（小程序） | **预计工时** | 1h | **状态** | ⬜ 待开始 |

### 🟡 P2-05 [后端] device 模块提取通用签名工具

| **负责人** | 后端 | **预计工时** | 2h | **状态** | ⬜ 待开始 |

### 🟡 P2-06 [后端] docker-compose.yml 移除默认密码

| **负责人** | 后端 | **预计工时** | 1h | **状态** | ⬜ 待开始 |

### 🟡 P2-07 [架构] 引入全链路 Trace ID

| **负责人** | 架构师 | **预计工时** | 8h | **状态** | ⬜ 待开始 |

### 🟡 P2-08 [前端] Admin 提取表单初始状态公共对象

| **负责人** | 前端（Admin） | **预计工时** | 2h | **状态** | ⬜ 待开始 |

---

## 时间线总览

```
Day 1-2  [紧急止血期]
  ├─ P0-03 清除 backend secrets
  ├─ P0-04 清除 DMS 弱密码
  ├─ P0-07 删除 Mock 登录
  ├─ P0-08 统一 HTTPS
  ├─ P0-09 移除 RSA 私钥
  ├─ P0-10 移除 dangerouslyUseHTMLString
  └─ P0-11 修复表单校验

Day 3-4  [架构方案期]
  ├─ P0-01 设计 Device Proxy API
  ├─ P0-02 制定枚举统一方案
  └─ P1-01 补充 CONTRACTS.md

Day 5-7  [方案落地期]
  ├─ P0-05 清理模块间 DAO 引用（第一阶段）
  ├─ P0-06 MiniApp 改调 backend API
  └─ P1-03 order 模块统一枚举引用

Week 2   [P1 修复期]
  ├─ P1-04 DMS 熔断
  ├─ P1-08~P1-12 MiniApp 错误处理/Token/加密/登录提取
  └─ P1-13~P1-16 Admin 类型安全/Store 修复

Week 3-4 [P2 优化期]
  └─ 全部 P2 项按排期执行
```

---

## 统计

| 优先级 | 架构师 | 后端 | 前端(Admin) | 前端(Miniapp) | 合计 |
|--------|--------|------|-------------|---------------|------|
| P0 | 2 | 3 | 3 | 3 | 11 |
| P1 | 2 | 5 | 4 | 6 | 17 |
| P2 | 1 | 2 | 2 | 3 | 8 |
| **合计** | **5** | **10** | **9** | **12** | **36** |

---

> 本清单应根据实际修复进度每日更新。每完成一项请打勾并记录完成人、完成时间、PR 链接。

# 微信小程序代码质量审查报告

**项目名称**: 冰立得 (icepolarminiapp)  
**审查日期**: 2026/06/02  
**审查范围**: miniapp/ 目录全部源码  
**技术栈**: 原生微信小程序 (WXML / WXSS / JS)  
**审查人**: miniapp-agent  

---

## 1. 执行摘要

本次审查对 `miniapp/` 目录进行了全面的代码质量与安全扫描，覆盖 13 个页面、3 个工具模块及全局配置。审查发现 **1 个 P0 级架构红线违规**、**多个 P0/P1 级安全隐患**、以及大量 P1/P2 级工程质量问题。

### 关键发现速览

| 级别 | 数量 | 类别 |
|------|------|------|
| P0 | 4 | DMS 直连、HTTP 明文、敏感信息、Mock 代码 |
| P1 | 8 | 错误处理、代码重复、Token 机制、状态管理 |
| P2 | 5 | UI/UX、样式重复、Console 日志 |

**总体评估**: 代码在功能层面较为完整，但存在严重的架构违规和安全隐患，**不建议在生产环境部署**，需完成 P0 项修复后方可进入测试阶段。

---

## 2. DMS 直连违规扫描

### 2.1 扫描结果概述

扫描范围: 全部 `.js` 文件中的 `wx.request` 调用及 `dmsUrl` 引用。

### 2.2 发现的问题

#### P0 - DMS 直连违规 (device-detail.js)

- **问题描述**: `pages/device-detail/device-detail.js` 直接使用 `app.globalData.dmsUrl` 向 DMS 服务器发起请求，绕过 backend API。
- **严重程度**: P0 - 架构红线违规
- **具体位置**: 
  - `/Users/gejunwen/code/holun-team/ice-polar-team-workspace/miniapp/pages/device-detail/device-detail.js:4`
  - `/Users/gejunwen/code/holun-team/ice-polar-team-workspace/miniapp/pages/device-detail/device-detail.js:67-68`
  - `/Users/gejunwen/code/holun-team/ice-polar-team-workspace/miniapp/pages/device-detail/device-detail.js:164-165`
- **代码片段**:
```javascript
const app = getApp();
const DMS_BASE_URL = app.globalData.dmsUrl;  // Line 4

// Line 67-68: 查询设备状态
wx.request({
  url: `${DMS_BASE_URL}/api/v1/devices/${imei}/status`,
  method: 'GET',
  
// Line 164-165: 下发设备指令
wx.request({
  url: `${DMS_BASE_URL}/api/v1/commands/${imei}/${type}`,
  method: 'POST',
```
- **影响分析**: 
  - 小程序前端直接与 DMS 通信，违反 "miniapp 绝对不允许直接调用 icepolar-dms" 的架构红线
  - 设备指令（查询状态、出冰、化冰、自清洗等）未通过 backend 转发
  - 绕过了 backend 的权限校验、审计日志、速率限制等安全机制
  - 一旦 DMS 地址暴露，攻击者可直接操控设备
- **修复建议**:
  1. 立即移除 `device-detail.js` 中的 DMS 直连逻辑
  2. 在 backend `yshop-module-device-biz` 中新增对应的设备管理 API:
     - `GET /app-api/device/admin/status?imei={imei}`
     - `POST /app-api/device/admin/command?imei={imei}&type={type}`
  3. 小程序端改为调用 backend API，由 backend 再调用 DMS
  4. 从 `app.js` 中移除 `dmsUrl` 全局变量

---

## 3. Tenant 处理审查

### 3.1 扫描结果概述

扫描范围: 全部 `.js` 文件中的 `tenant-id` 和 `tenantId` 引用。

### 3.2 发现的问题

#### P1 - Tenant ID 硬编码但缺乏动态配置机制

- **问题描述**: `tenant-id: '153'` 在多处硬编码，虽然当前业务固定为 153，但缺乏统一的动态配置机制。
- **严重程度**: P1
- **具体位置**:
  - `/Users/gejunwen/code/holun-team/ice-polar-team-workspace/miniapp/config/config.js:14`
  - `/Users/gejunwen/code/holun-team/ice-polar-team-workspace/miniapp/config/config.js:20`
  - `/Users/gejunwen/code/holun-team/ice-polar-team-workspace/miniapp/pages/profile/profile.js:394`
  - `/Users/gejunwen/code/holun-team/ice-polar-team-workspace/miniapp/pages/refund/refund.js:138`
- **代码片段**:
```javascript
// config/config.js
headers: {
  'Accept': '*/*',
  'tenant-id': '153',  // Line 14
  'Content-Type': 'application/json'
}
```
- **影响分析**:
  - 若未来需要支持多租户，需修改多处代码
  - 存在遗漏风险（如 `profile.js` 和 `refund.js` 中手动构造 header 时重复硬编码）
- **修复建议**:
  1. 在 `config.js` 中统一定义 `tenantId: '153'`
  2. `getAuthHeaders()` 方法自动注入 `tenant-id`
  3. 禁止页面代码手动构造 `tenant-id` header

#### P1 - 登录流程未显式携带 Tenant 信息

- **问题描述**: 登录接口 `/app-api/member/auth/auth-miniapp-login` 的请求中，tenant-id 仅通过 header 传递，未在请求体中显式携带。
- **严重程度**: P1
- **具体位置**: 
  - `/Users/gejunwen/code/holun-team/ice-polar-team-workspace/miniapp/pages/scan/scan.js:432-439`
  - `/Users/gejunwen/code/holun-team/ice-polar-team-workspace/miniapp/pages/map/map.js:542-548`
  - `/Users/gejunwen/code/holun-team/ice-polar-team-workspace/miniapp/pages/profile/profile.js:175-182`
- **影响分析**:
  - 若后端 header 解析失败，可能导致租户隔离失效
  - 建议请求体中也包含 tenantId 作为冗余校验
- **修复建议**: 在登录请求 data 中增加 `tenantId: config.tenantId`

---

## 4. API 调用规范审查

### 4.1 扫描结果概述

扫描范围: 全部 `wx.request` 和 `app.request` 调用，共 **37 处**。

### 4.2 发现的问题

#### P1 - 大量 API 请求缺少 fail 错误处理

- **问题描述**: 37 处请求中，**27 处缺少 `fail` 回调**，网络异常时用户无感知，页面可能进入卡死状态。
- **严重程度**: P1
- **具体位置** (部分列举):
  - `/Users/gejunwen/code/holun-team/ice-polar-team-workspace/miniapp/pages/payment/payment.js:74` (fetchUserBalance)
  - `/Users/gejunwen/code/holun-team/ice-polar-team-workspace/miniapp/pages/payment/payment.js:132` (创建订单)
  - `/Users/gejunwen/code/holun-team/ice-polar-team-workspace/miniapp/pages/payment/payment.js:170` (余额支付)
  - `/Users/gejunwen/code/holun-team/ice-polar-team-workspace/miniapp/pages/scan/scan.js:52` (查询设备详情)
  - `/Users/gejunwen/code/holun-team/ice-polar-team-workspace/miniapp/pages/scan/scan.js:149` (连接设备)
  - `/Users/gejunwen/code/holun-team/ice-polar-team-workspace/miniapp/pages/processing/processing.js:87` (启动设备)
  - `/Users/gejunwen/code/holun-team/ice-polar-team-workspace/miniapp/pages/processing/processing.js:147` (查询设备订单)
  - `/Users/gejunwen/code/holun-team/ice-polar-team-workspace/miniapp/pages/orders/orders.js:156` (获取订单列表)
  - `/Users/gejunwen/code/holun-team/ice-polar-team-workspace/miniapp/pages/wallet/wallet.js:203` (创建充值订单)
  - `/Users/gejunwen/code/holun-team/ice-polar-team-workspace/miniapp/pages/wallet/wallet.js:270` (刷新用户信息)
- **代码片段**:
```javascript
// payment.js:74 - 无 fail 处理
wx.request({
  url: `${config.api.baseUrl}/app-api/member/user/get-info`,
  method: 'GET',
  header: config.getAuthHeaders('form'),
  success: (res) => { ... }
  // 缺少 fail 回调
});
```
- **影响分析**:
  - 网络断开、服务器 500、超时等异常时，loading 可能永不消失
  - 用户无法得知操作失败，体验极差
  - 支付流程中尤为危险，可能导致重复支付或订单状态不一致
- **修复建议**:
  1. 为所有 `wx.request` 添加 `fail` 回调，统一处理网络错误
  2. 建议在 `app.js` 中封装统一的 `request` 方法（已有但使用不充分），强制处理 fail

#### P1 - 未使用统一的 request 封装

- **问题描述**: 虽然 `app.js` 提供了 `app.request()` 方法（带 401 处理和 Promise 封装），但大部分页面仍直接使用 `wx.request()`。
- **严重程度**: P1
- **统计数据**:
  - `wx.request` 直接调用: **29 处**
  - `app.request` 封装调用: **8 处**
- **影响分析**:
  - 401 未授权处理逻辑分散，部分页面未处理 token 过期
  - 错误处理风格不一致
  - 难以统一添加日志、监控、重试机制
- **修复建议**:
  1. 强制所有 API 调用通过 `app.request()` 或统一的 `utils/request.js`
  2. 在封装层统一处理: token 注入、401 跳转、超时重试、日志上报

#### P1 - Token 刷新机制缺失

- **问题描述**: 代码中存储了 `refreshToken`，但**没有任何地方使用它**。
- **严重程度**: P1
- **具体位置**:
  - `/Users/gejunwen/code/holun-team/ice-polar-team-workspace/miniapp/app.js:121-122` (存储 refreshToken)
  - `/Users/gejunwen/code/holun-team/ice-polar-team-workspace/miniapp/app.js:179-183` (401 时直接 logout)
- **代码片段**:
```javascript
// app.js:179-183 - 401 时直接登出，未尝试刷新
token过期或无效，清除本地数据并跳转登录
console.log('token无效，需要重新登录');
this.logout();
reject(new Error('需要重新登录'));
```
- **影响分析**:
  - accessToken 过期后，用户必须重新登录，体验差
  - 频繁登录可能导致用户流失
- **修复建议**:
  1. 实现 Token 自动刷新机制: 401 时调用 `/app-api/member/auth/refresh-token`
  2. 使用 refreshToken 获取新的 accessToken
  3. 刷新成功后重试原请求
  4. 刷新失败后再跳转登录页

#### P2 - API Base URL 混用 HTTP/HTTPS

- **问题描述**: `config.js` 使用 HTTPS，但 `profile.js` 中头像上传硬编码为 HTTP。
- **严重程度**: P2
- **具体位置**: `/Users/gejunwen/code/holun-team/ice-polar-team-workspace/miniapp/pages/profile/profile.js:390`
- **代码片段**:
```javascript
url: 'http://yshop-api.holuntech.com/app-api/infra/file/upload',
```
- **影响分析**: 头像上传走明文 HTTP，存在中间人攻击风险
- **修复建议**: 统一使用 `config.api.baseUrl`，禁止硬编码 URL

---

## 5. 状态管理分析

### 5.1 扫描结果概述

扫描范围: `app.globalData` 使用情况及页面间数据传递。

### 5.2 发现的问题

#### P1 - 过度依赖 app.globalData

- **问题描述**: 全局状态通过 `app.globalData` 管理，共 **36 处直接访问**，缺乏封装和响应式更新。
- **严重程度**: P1
- **关键字段访问统计**:
  | 字段 | 访问次数 | 风险 |
  |------|---------|------|
  | `userInfo` | 12 | 登录状态变更时页面不自动刷新 |
  | `deviceImei` | 11 | 设备断开时多页面状态不一致 |
  | `deviceConnected` | 4 | 状态同步依赖手动调用 |
  | `openid` | 4 | 分散在多个页面获取 |
  | `selectedCup` | 1 | 页面刷新后丢失 |
  | `dmsUrl` | 1 | 架构违规（见第2章） |
  | `shopId` | 3 | 与 config.shopId 混用 |

- **影响分析**:
  - 页面间状态同步困难，需手动在 `onShow` 中刷新
  - `selectedCup` 仅存储在内存，页面刷新后丢失
  - `deviceConnected` 状态在多个页面维护，容易不一致
- **修复建议**:
  1. 引入轻量级状态管理方案（如 `mobx-miniprogram` 或自研 EventBus）
  2. 或封装 `store.js` 模块，提供 `subscribe`/`notify` 机制
  3. 关键状态（如订单信息）应通过 URL 参数或本地存储传递

#### P2 - 页面间数据传递不规范

- **问题描述**: `payment.js` 从 `app.globalData.selectedCup` 读取商品信息，页面刷新后数据丢失。
- **严重程度**: P2
- **具体位置**: `/Users/gejunwen/code/holun-team/ice-polar-team-workspace/miniapp/pages/payment/payment.js:21`
- **代码片段**:
```javascript
onLoad() {
  const selectedProduct = app.globalData.selectedCup;
  if (!selectedProduct) {
    wx.showToast({ title: '请先选择产品', icon: 'none' });
    setTimeout(() => { wx.navigateBack(); }, 1500);
    return;
  }
```
- **影响分析**: 用户刷新支付页后，商品信息丢失，被迫返回重选
- **修复建议**: 将商品 ID 通过 URL 参数传递，支付页根据 ID 重新查询商品详情

---

## 6. UI/UX 质量分析

### 6.1 扫描结果概述

扫描范围: WXML 结构、WXSS 样式、交互反馈、加载状态。

### 6.2 发现的问题

#### P2 - 样式文件过大且重复

- **问题描述**: 多个页面 WXSS 文件超过 500 行，存在大量重复样式。
- **严重程度**: P2
- **统计数据**:
  | 文件 | 行数 | 问题 |
  |------|------|------|
  | `scan.wxss` | 1250 | 过大，含大量卡片/按钮重复样式 |
  | `orders.wxss` | 759 | 过大 |
  | `payment.wxss` | 731 | 过大 |
  | `profile.wxss` | 673 | 过大 |
  | `select-cup.wxss` | 553 | 过大 |
  | `map.wxss` | 538 | 过大 |
  | `processing.wxss` | 396 | 中等 |

- **影响分析**:
  - 包体积增大，影响加载速度
  - 样式维护困难，修改主题需改多处
  - 违反 CSS 规范中 "禁止空规则块" 和 "抽取变量" 的要求
- **修复建议**:
  1. 将通用组件样式提取到 `app.wxss` 或独立组件
  2. 使用微信小程序自定义组件（Component）封装: 按钮、卡片、弹窗、徽章
  3. 建立更完整的 CSS 工具类体系（类似 Tailwind）

#### P2 - 弹窗/登录框未统一封装

- **问题描述**: 登录弹窗逻辑在 4 个页面（scan、select-cup、map、profile）中重复实现，代码高度相似。
- **严重程度**: P2
- **代码重复度**: `handleGetPhoneNumber`、`completeLoginWithPhone`、`handleLoginSuccess` 三个方法在 scan.js、map.js、profile.js 中几乎完全相同，共约 **150 行重复代码**。
- **影响分析**:
  - 登录逻辑变更时需修改多处
  - 容易遗漏，导致不同页面登录行为不一致
  - `select-cup.js` 中的登录逻辑还是 **Mock 实现**（见第7章）
- **修复建议**:
  1. 将登录逻辑封装为 `utils/login.js` 模块
  2. 提供 `showLoginModal()` / `hideLoginModal()` 统一方法
  3. 或使用 Behavior 复用登录逻辑

#### P2 - 部分请求缺少加载状态

- **问题描述**: 部分 API 请求未显示 loading，用户点击后无反馈。
- **严重程度**: P2
- **具体位置**:
  - `/Users/gejunwen/code/holun-team/ice-polar-team-workspace/miniapp/pages/payment/payment.js:74` (fetchUserBalance - 无 loading)
  - `/Users/gejunwen/code/holun-team/ice-polar-team-workspace/miniapp/pages/orders/orders.js:156` (获取订单列表 - 无全局 loading)
  - `/Users/gejunwen/code/holun-team/ice-polar-team-workspace/miniapp/pages/wallet/wallet.js:270` (刷新用户信息 - 无 loading)
- **修复建议**: 所有异步操作开始前显示 loading，结束后隐藏

#### P2 - 内联样式使用 (虽少但需关注)

- **问题描述**: WXML 中存在 3 处 `style="..."` 内联样式。
- **严重程度**: P2
- **具体位置**:
  - `/Users/gejunwen/code/holun-team/ice-polar-team-workspace/miniapp/pages/processing/processing.wxml:11` (animation-delay)
  - `/Users/gejunwen/code/holun-team/ice-polar-team-workspace/miniapp/pages/processing/processing.wxml:17` (conic-gradient 动态进度)
  - `/Users/gejunwen/code/holun-team/ice-polar-team-workspace/miniapp/pages/select-cup/select-cup.wxml:12` (background)
- **影响分析**: 动态值（如 `progress`）必须使用内联样式，但静态样式应移至 WXSS
- **修复建议**: `select-cup.wxml:12` 的 `background: var(--brand-success)` 应改为 CSS 类

---

## 7. 安全扫描

### 7.1 扫描结果概述

扫描范围: 硬编码敏感信息、存储安全、配置文件、Mock 代码。

### 7.2 发现的问题

#### P0 - AppID 硬编码在配置文件中

- **问题描述**: 微信小程序 AppID 硬编码在 `project.config.json` 中，虽为必要配置，但需确认是否为生产环境 AppID。
- **严重程度**: P0
- **具体位置**: `/Users/gejunwen/code/holun-team/ice-polar-team-workspace/miniapp/project.config.json:2`
- **代码片段**:
```json
{
  "appid": "wx4df64c96e6540b4e",
```
- **影响分析**:
  - AppID 本身非高度敏感，但若仓库为 public，可能被恶意利用
  - 需确认是否配置了服务器域名白名单，防止他人盗用
- **修复建议**:
  1. 确认 `project.config.json` 已加入 `.gitignore`（如为 private 仓库可接受）
  2. 在小程序后台配置下载域名白名单，只允许合法域名
  3. 考虑使用环境变量或构建脚本切换 AppID

#### P0 - Mock 登录代码存在于生产代码中

- **问题描述**: `select-cup.js` 中包含完整的 Mock 登录实现，生成随机手机号和假 openid。
- **严重程度**: P0
- **具体位置**: `/Users/gejunwen/code/holun-team/ice-polar-team-workspace/miniapp/pages/select-cup/select-cup.js:410-455`
- **代码片段**:
```javascript
handleGetPhoneNumber(e) {
  if (e.detail.errMsg === 'getPhoneNumber:ok') {
    // ...
    setTimeout(() => {
      // 模拟从微信获取的手机号
      const mockPhone = '138' + Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
      const userInfo = {
        phone: mockPhone,
        name: '微信用户' + mockPhone.substr(-4),
        openid: 'mock_openid_' + Date.now(),
        sessionKey: 'mock_session_key'
      };
      app.login(userInfo);
      // ...
    }, 1000);
  }
}
```
- **影响分析**:
  - 若误触发，可绕过微信授权直接"登录"
  - 虽然需要 `getPhoneNumber:ok`，但代码存在即风险
  - 严重违反安全规范
- **修复建议**: **立即删除** `select-cup.js` 中的 Mock 登录逻辑，统一调用真实的 `auth-miniapp-login` 接口

#### P1 - 敏感数据存储未加密

- **问题描述**: `accessToken`、`refreshToken`、`userInfo` 等敏感数据通过 `wx.setStorageSync` 明文存储。
- **严重程度**: P1
- **具体位置**:
  - `/Users/gejunwen/code/holun-team/ice-polar-team-workspace/miniapp/app.js:115-126` (login 方法)
  - `/Users/gejunwen/code/holun-team/ice-polar-team-workspace/miniapp/pages/profile/profile.js:449` (更新用户信息)
- **影响分析**:
  - 小程序存储虽隔离于其他小程序，但用户可导出或篡改
  - Token 泄露可导致账号被盗用
- **修复建议**:
  1. 对 token 进行简单加密（如 AES）后再存储
  2. 或使用微信的 `wx.getStorage` 配合自定义加密
  3. 设置合理的 token 过期时间，减少泄露风险

#### P1 - 手机号敏感信息处理

- **问题描述**: `encryptedData` 和 `iv` 在页面间传递，虽然最终发送到后端，但处理过程中存在日志打印。
- **严重程度**: P1
- **具体位置**:
  - `/Users/gejunwen/code/holun-team/ice-polar-team-workspace/miniapp/pages/scan/scan.js:380` (console.log 打印 getPhoneNumber 回调)
  - `/Users/gejunwen/code/holun-team/ice-polar-team-workspace/miniapp/pages/scan/scan.js:391-392` (提取 encryptedData/iv)
- **代码片段**:
```javascript
console.log('获取手机号回调', e);  // 可能包含敏感信息
const encryptedData = e.detail.encryptedData;
const iv = e.detail.iv;
```
- **影响分析**: 生产环境中 console.log 可能通过日志上报泄露敏感数据
- **修复建议**:
  1. 删除或注释掉所有涉及敏感信息的 console.log
  2. 使用日志脱敏工具，自动过滤敏感字段

#### P2 - 模拟连接设备功能

- **问题描述**: `scan.js` 提供 "模拟连接设备" 功能，使用测试 IMEI `000000000000000`。
- **严重程度**: P2
- **具体位置**: `/Users/gejunwen/code/holun-team/ice-polar-team-workspace/miniapp/pages/scan/scan.js:129-138`
- **影响分析**:
  - 测试功能若未在构建生产包时移除，可能被用户误触
  - 虽然需要后端配合，但存在潜在风险
- **修复建议**:
  1. 使用条件编译或环境变量控制，生产环境移除模拟功能
  2. 或在构建脚本中删除/注释相关代码

---

## 8. 设备指令规范审查

### 8.1 扫描结果概述

扫描范围: `device-detail.js`、`device-admin.js`、`processing.js` 中的设备指令相关代码。

### 8.2 发现的问题

#### P0 - 设备指令直接调用 DMS (重复强调)

- **问题描述**: 同第2章，设备指令（查询状态、出冰、化冰、自清洗等）直接调用 DMS API。
- **严重程度**: P0
- **具体位置**: `/Users/gejunwen/code/holun-team/ice-polar-team-workspace/miniapp/pages/device-detail/device-detail.js`
- **指令列表**:
  | 指令 | DMS 路径 | 类型 |
  |------|---------|------|
  | 水桶门 | `/api/v1/commands/{imei}/1` | POST |
  | 杯子门 | `/api/v1/commands/{imei}/2` | POST |
  | 开始制冰 | `/api/v1/commands/{imei}/3` | POST |
  | 停止制冰 | `/api/v1/commands/{imei}/4` | POST |
  | 蒸发器化冰 | `/api/v1/commands/{imei}/5` | POST |
  | 冰桶化冰 | `/api/v1/commands/{imei}/6` | POST |
  | 出冰 | `/api/v1/commands/{imei}/7` | POST |
  | 出杯 | `/api/v1/commands/{imei}/8` | POST |
  | 自清洗 | `/api/v1/commands/{imei}/9` | POST |
  | 语音 | `/api/v1/commands/{imei}/10` | POST |
  | 授时 | `/api/v1/commands/{imei}/11` | POST |

- **修复建议**: 必须通过 backend API 转发，禁止前端直连 DMS

#### P1 - 错误码映射不完整

- **问题描述**: `device-detail.js` 中仅处理了 `error_code` 为 0/1/2 的情况，其他错误码显示为原始数字。
- **严重程度**: P1
- **具体位置**: `/Users/gejunwen/code/holun-team/ice-polar-team-workspace/miniapp/pages/device-detail/device-detail.js:121`
- **代码片段**:
```javascript
value: data.error_code === 0 ? '正常' : data.error_code === 1 ? '设备故障' : data.error_code === 2 ? '杯少' : `故障码${data.error_code}`,
```
- **影响分析**:
  - 用户看到 "故障码3"、"故障码4" 等无法理解的信息
  - 运维人员也难以快速定位问题
- **修复建议**:
  1. 与硬件团队确认完整的错误码定义表
  2. 在 `utils/device-error-codes.js` 中建立映射表
  3. 提供用户友好的错误提示和运维级别的详细日志

#### P2 - 设备状态查询与指令下发无权限校验

- **问题描述**: `device-detail.js` 页面未校验用户是否有权管理该设备。
- **严重程度**: P2
- **具体位置**: `/Users/gejunwen/code/holun-team/ice-polar-team-workspace/miniapp/pages/device-detail/device-detail.js`
- **影响分析**:
  - 任何登录用户（甚至未登录，因为无校验）可尝试下发指令
  - 虽然 DMS 可能有校验，但前端也应做第一层防护
- **修复建议**:
  1. 页面加载时调用 `/app-api/device/canManage?imei={imei}` 校验权限
  2. 无权限时隐藏指令按钮或显示提示

---

## 9. 问题清单 (P0/P1/P2)

### P0 级问题 (必须立即修复)

| 编号 | 问题 | 文件 | 行号 | 影响 |
|------|------|------|------|------|
| P0-001 | DMS 直连违规 - 查询设备状态 | device-detail.js | 67-68 | 架构红线，安全风险 |
| P0-002 | DMS 直连违规 - 下发设备指令 | device-detail.js | 164-165 | 架构红线，设备被操控 |
| P0-003 | HTTP 明文传输头像 | profile.js | 390 | 中间人攻击 |
| P0-004 | Mock 登录代码存在于生产环境 | select-cup.js | 410-455 | 可绕过授权 |
| P0-005 | AppID 暴露 (需确认风险) | project.config.json | 2 | 信息泄露 |

### P1 级问题 (高优先级)

| 编号 | 问题 | 文件 | 行号 | 影响 |
|------|------|------|------|------|
| P1-001 | 27 处 API 请求缺少 fail 处理 | 多个文件 | 多处 | 网络异常卡死 |
| P1-002 | 未使用统一 request 封装 | 多个文件 | 多处 | 401 处理不一致 |
| P1-003 | Token 刷新机制缺失 | app.js | 179-183 | 频繁要求登录 |
| P1-004 | Tenant ID 多处硬编码 | config.js, profile.js, refund.js | 多处 | 维护困难 |
| P1-005 | 登录未显式携带 tenant | scan.js, map.js, profile.js | 多处 | 租户隔离风险 |
| P1-006 | 敏感数据明文存储 | app.js | 115-126 | Token 泄露风险 |
| P1-007 | 手机号敏感信息打印日志 | scan.js | 380 | 隐私泄露 |
| P1-008 | 错误码映射不完整 | device-detail.js | 121 | 用户体验差 |

### P2 级问题 (建议修复)

| 编号 | 问题 | 文件 | 行号 | 影响 |
|------|------|------|------|------|
| P2-001 | 样式文件过大 (scan.wxss 1250行) | scan.wxss | 全部 | 包体积大 |
| P2-002 | 登录逻辑在 4 个页面重复 | scan.js, map.js, profile.js, select-cup.js | 多处 | 维护困难 |
| P2-003 | 过度依赖 app.globalData | 多个文件 | 36处 | 状态不一致 |
| P2-004 | 页面刷新后商品信息丢失 | payment.js | 21 | 用户体验 |
| P2-005 | Console 日志过多 (46处) | 多个文件 | 多处 | 信息泄露 |
| P2-006 | 模拟连接设备功能未移除 | scan.js | 129-138 | 误触风险 |
| P2-007 | 部分请求缺少 loading | payment.js, orders.js, wallet.js | 多处 | 用户体验 |
| P2-008 | 内联样式使用 | processing.wxml, select-cup.wxml | 3处 | 维护困难 |

---

## 10. 改进建议

### 10.1 架构层面

1. **立即移除 DMS 直连**
   - 删除 `app.globalData.dmsUrl`
   - 删除 `device-detail.js` 中的 DMS 请求
   - 在 backend 新增设备管理 API 转发层

2. **统一 API 封装**
   - 创建 `utils/request.js`，封装 `wx.request`
   - 统一处理: baseUrl、headers、token、401、超时、重试、日志
   - 所有页面强制使用封装后的方法

3. **引入状态管理**
   - 使用 `mobx-miniprogram` 或自研 Store
   - 封装 `userStore`、`deviceStore`，提供响应式更新
   - 减少 `app.globalData` 直接访问

### 10.2 安全层面

1. **清理 Mock 代码**
   - 删除 `select-cup.js` 中的 Mock 登录
   - 删除或条件编译 `scan.js` 中的模拟连接
   - 建立代码审查清单，禁止 Mock 代码合入 main

2. **敏感信息保护**
   - 删除所有敏感数据的 console.log
   - Token 存储加密（AES）
   - 使用 HTTPS 统一所有 API 调用

3. **权限校验**
   - 设备管理页面增加权限校验
   - 所有管理类 API 调用前检查 `canManage`

### 10.3 工程化层面

1. **代码复用**
   - 提取登录逻辑为 `utils/login.js`
   - 提取通用组件: 按钮、卡片、弹窗、加载状态
   - 使用微信小程序 Component 封装可复用 UI

2. **错误处理**
   - 为所有 API 请求添加 fail 回调
   - 统一错误提示文案和样式
   - 网络错误时提供重试机制

3. **性能优化**
   - 拆分过大的 WXSS 文件
   - 图片懒加载
   - 减少不必要的 setData

4. **规范落地**
   - 配置 ESLint + Prettier
   - 建立代码审查流程
   - 编写单元测试（Jest + miniprogram-simulate）

### 10.4 优先级修复路线图

| 阶段 | 时间 | 目标 |
|------|------|------|
| 紧急 | 1-2 天 | 修复 P0-001~P0-005 (DMS、HTTP、Mock、AppID) |
| 短期 | 1 周 | 修复 P1-001~P1-008 (错误处理、Token、Tenant、安全) |
| 中期 | 2 周 | 修复 P2-001~P2-008 (UI、状态、日志、组件化) |
| 长期 | 1 月 | 架构重构 (状态管理、统一封装、测试覆盖) |

---

**报告结束**

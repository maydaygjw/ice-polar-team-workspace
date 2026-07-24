# Backlog Item: Admin 前端模块拆分与打包优化

## Metadata

| Field | Value |
|-------|-------|
| ID | BACKLOG-007 |
| Title | Admin 前端模块拆分与打包优化 |
| Status | `draft` |
| Priority | `P1` |
| Created | 2026-07-24 |
| Author | gejunwen |
| Tags | frontend, vite, manualChunks, monorepo, micro-frontend, performance, tech-debt |

## Problem / Need

admin 前端（Vue 3 + Vite 5 + TS）是单 SPA 单 Layout 巨石应用，存在两个痛点：

1. **首屏体积失控**：主 chunk `index-*.js` 达 **9.3 MB（terser 后）**，element-plus / echarts / vxe-table / wangeditor / ueditor / bpmn-js / video.js 等全部 vendor 无差别堆进首屏，无 manualChunks。gzip 后传输约 2.5–3MB，且改一行代码全量缓存失效。
2. **模块边界形同虚设**：`views/`、`api/` 虽按业务域分目录（与后端模块几乎一一对应），但业务目录互相越界严重，无机器化强制。

关联：与 BACKLOG-006（后端微服务拆分）并行，前端包边界最终应与后端服务边界对齐。

## Context

### 现状摸底（2026-07-24）

**技术栈**：Vue 3.4.21 / Vite 5.1.4 / vue-router 4.3 / pinia 2.1.7 / element-plus 2.6.1（unplugin 按需导入）/ TS 5.3.3。重型依赖：vxe-table、echarts、@wangeditor、vue-ueditor-wrap、bpmn-js、video.js、vue-baidu-map、cropperjs、@form-create、xlsx。

**有利条件**：
- `views/`（15 个业务子目录）、`api/`（14 个，125 个文件）按业务域划分，与后端 system/infra/pay/mall/member/marketing/mp/message/score/express/site/bidrank 几乎一一对应
- api 层自治度高：125 个文件统一 `import request from '@/config/axios'`，业务 api 之间几乎不互相 import（全工程仅 1 处）
- 路由全部懒加载（静态 `() => import()` + 动态 `import.meta.glob` + `defineAsyncComponent`），dist 已有 867 个按需 chunk
- 状态未按业务拆（全局仅 8 个平台 store，业务状态留组件内），拆分状态共享复杂度低
- 构建插件已工厂化（`build/vite/index.ts`）

**障碍**：
- 巨型单 chunk 9.3MB，无 manualChunks（`vite.config.ts` / `build/` 均 grep 不到）
- 业务目录互相越界（最大障碍）：
  - `mall/member/user/index.vue` 同时引 `@/api/member/user` 和 `@/views/mall/member/user/UserTagForm.vue`（member 页面寄生在 mall 下）
  - `market/discountCoupon`、`site/order`、`bidrank/auction`、`member/feedback` 均直接 import `mall` API / 组件
  - `mall/statistics/*` 反向依赖 `@/views/Home/*`
- 共享组件不纯：`components/ShopSearch`、`ShopSelect` 直接调 `@/api/mall/store/shop`
- `views/components/`（product/user 选择器）是事实上的"业务公共层"但放 views/ 下，归属不清
- **`import.meta.glob('../views/**/*.{vue,tsx}')`（`utils/routerHelper.ts:7`）是单体根源**——动态路由机制把"所有 380 个 view 必须在同一 bundle"写死
- 无 pnpm workspace / monorepo
- 重型依赖未做懒加载（bpmn/echarts/editor/vxe/video 均被 `optimizeDeps.include` 预构建）

### 拆分思路：三层递进

**L1 — manualChunks 代码分割（成本最低，独立先做，不依赖任何架构决策）**

在 `vite.config.ts` `build.rollupOptions.output` 加函数式 manualChunks，按"更新频率 + 大小 + 首屏/按需"切：

```ts
manualChunks(id: string) {
  if (!id.includes('node_modules')) return
  // Vue 核心框架 —— 最稳定，长缓存
  if (id.includes('/vue/') || id.includes('/vue-router/') ||
      id.includes('/pinia/') || id.includes('/@vue/')) return 'vendor-vue'
  // 巨型库各自独立（按需，不进首屏）
  if (id.includes('echarts') || id.includes('zrender')) return 'vendor-echarts'
  if (id.includes('bpmn-js') || id.includes('bpmn-io') || id.includes('diagram-js')) return 'vendor-bpmn'
  if (id.includes('@wangeditor') || id.includes('vue-ueditor-wrap') || id.includes('ueditor')) return 'vendor-editor'
  if (id.includes('vxe-table') || id.includes('xe-utils')) return 'vendor-vxe'
  if (id.includes('video.js') || id.includes('videojs')) return 'vendor-video'
  if (id.includes('vue-baidu-map') || id.includes('baidu-map')) return 'vendor-map'
  if (id.includes('cropperjs')) return 'vendor-cropper'
  if (id.includes('xlsx') || id.includes('exceljs')) return 'vendor-xlsx'
  // Element Plus 系 —— 首屏 UI，单独长缓存
  if (id.includes('element-plus') || id.includes('@element-plus') || id.includes('@popperjs')) return 'vendor-element'
  // form-create 表单引擎系
  if (id.includes('@form-create')) return 'vendor-form'
  // 其余第三方兜底
  return 'vendor-misc'
}
```

配套（否则白切）：
- 重型库改动态 import：`bpmn-js` / `@wangeditor` / `video.js` / `vue-baidu-map` / `xlsx` 的引入点改 `await import()`，否则切了 chunk 仍进首屏
- 加 `rollup-plugin-visualizer` 验证产物（`VITE_REPORT === 'true'` 时开启）
- 坑：切太细可能 chunk 间循环引用报错（上面按生态边界切是安全的）；与 unplugin-element-plus 按需导入兼容，不用动

预期：首屏必载 9.3MB → 1.5–2.5MB（gzip 后 ~600KB–1MB），框架长缓存业务短缓存，HTTP/2 多路并行。

**L2 — Monorepo 分包（中期，对应后端 Phase A 解耦）**

建 pnpm workspace，单包拆"壳 + 业务包"，仍保留单 SPA 入口：

| 包 | 内容 |
|---|---|
| `@admin/shell` | config/axios、utils、hooks/web、store(8全局)、components(剔除 ShopSearch/ShopSelect)、types、styles、plugins、layout、router、permission、directives |
| `@admin/mall` / `@admin/system` / `@admin/infra` / `@admin/mp` … | 各业务 views + api 按域整目录搬 |

前置动作（对应后端补 api）：
- 寄生页面归位（`mall/member/user` → `@admin/member`）
- `ShopSearch`/`ShopSelect`、`views/components/product|user` 明确归属：上移 shell 并抽掉业务 API（改 props/emit），或下沉对应业务包
- 斩断 market/site/bidrank → mall 直接 import，改经 shell 契约调用

**关键约束（决定 L2 后能否按 chunk 加载）**：跨包只允许静态 import 平台层（shell）；业务包的页面组件必须经动态 import 到达路由表。包对外只能暴露路由表（字符串/元数据），不能静态 re-export 页面组件，否则 380 个 view 全部退回首屏。用 `eslint-plugin-import` no-restricted-paths 或 dependency-cruiser 机器化守住（同后端 Maven Enforcer 思路）。

L2 额外收益：可按业务域归组 chunk（`@admin/mall` → `mall-[hash].js`），比 867 个碎 chunk 更合理——首屏只载 shell+vendor，点进业务域才拉该域的包。

**L3 — 微前端（长期可选，对应后端 Phase C）**

L2 边界干净后才谈独立部署：主壳持路由注册表，子应用暴露 `register()` 替代 `import.meta.glob`；技术选型 vite-plugin-federation（Module Federation）或 qiankun。前置：解决 UEditor public/ 全局静态资源、重型依赖按路由切分。**除非出现多团队独立发布/独立技术栈硬需求，否则不建议现在做**——单 SPA + monorepo 已解决 90% 边界问题。

## Acceptance Criteria

L1（可独立验收）：
- [ ] `vite.config.ts` 加 manualChunks，重型库（echarts/bpmn/editor/vxe/video/map/xlsx）独立成 chunk
- [ ] 上述重型库引入点全部改为动态 import，不进首屏
- [ ] 首屏必载 JS（gzip 后）≤ 1MB，visualizer 报告确认
- [ ] 框架 chunk（vendor-vue/vendor-element）与业务 chunk 缓存分离

L2（待 L1 完成后细化）：
- [ ] pnpm workspace 建立，`@admin/shell` + 各业务包拆分完成
- [ ] 寄生/越界 import 全部归位，dependency-cruiser / eslint 边界校验通过
- [ ] 业务包页面组件全部经动态 import 到达路由表，无静态 re-export 页面

L3（可选，暂列方向）：
- [ ] 待定

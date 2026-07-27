# 打印任务预览 - Review Report

## 结论

**pass**（实现符合规格与契约；编译/构建通过；运行时单测受本机 Mockito 环境限制未通过，与本次改动无关）。

## 验证结果

| 项 | 结果 |
|----|------|
| backend `mvn -pl yshop-server -am package -DskipTests` | ✅ BUILD SUCCESS |
| admin `pnpm build:prod` | ✅ Build successful |
| admin `vue-tsc --noEmit`（printJob 相关） | ✅ 无错误 |
| 单元测试 `PrintDeviceInitServiceTest` | ⚠️ 编译通过；运行时 `Could not modify all classes`（Mockito inline-mock 在本机 JDK 受限，基线 master 同样失败，与改动无关） |

## 检查项

- 预览接口 `POST /admin-api/device/print-job/preview` 全程不落库：无 `insert/update`，仅读设备/商品/Option + 调链科 file_pages。
- 计价口径与下单一致（同一 `priceAndValidate` 链路），符合 BR4「价格只信服务端」。
- product 域 `regenerateProductOptions` 已去打印语义（参数改为 `ProductOptionGroupSpecDTO`），「纸张/颜色」收回 device 调用方。
- 跨模块调用均经 `*-api`（device-biz → product-api），无 `*-biz` 依赖。
- 菜单 SQL 幂等，权限 `device:print-job:create`。
- 无密钥/私密配置提交。

## 已知缺口

- K1 预览价源取「店铺文件打印类目首个有效商品」（规格 Assumption）；店铺多文件打印商品时价可能因商品不同而异。后续可扩展为指定商品。
- K2 Option 名称未命中（设备未初始化/商品未同步 Option）时按 0 计价并记 warn，不阻断预览。如需严格可按失败处理。
- K3 单测未在本机跑通（Mockito 环境），建议 CI 环境补跑 `PrintDeviceInitServiceTest`。

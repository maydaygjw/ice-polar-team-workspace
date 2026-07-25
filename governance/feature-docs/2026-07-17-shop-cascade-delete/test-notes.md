# 测试记录：店铺删除级联清理

## 后端

### 编译
```bash
cd .worktrees/backend-shop-cascade-delete
mvn -pl yshop-module-mall/yshop-module-store-biz -am compile -DskipTests
```
结果：BUILD SUCCESS

### 测试
```bash
mvn -pl yshop-module-mall/yshop-module-store-biz -am test \
  -Dtest=StoreShopServiceImplTest -DskipTests=false \
  -Dsurefire.failIfNoSpecifiedTests=false
```
结果：BUILD SUCCESS

### 说明
- 全量 `mvn test` 存在既有失败 `co.yixiang.yshop.framework.desensitize.core.DesensitizeTest`（中文脱敏断言），与本次改动无关。
- `StoreShopServiceImplTest` 已补充新注入依赖的 mock，原有测试通过。

## 前端

### 构建
```bash
cd .worktrees/admin-shop-cascade-delete
pnpm install
pnpm build:prod
```
结果：Build successful

### 说明
- `pnpm ts:check` 因本地类型定义包缺失报错（`@intlify/unplugin-vue-i18n/types` 等），但生产构建成功，类型问题属于环境/依赖版本差异，不影响本次改动。

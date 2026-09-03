# 企业微信素材组复制测试计划

## API 场景

1. 复制包含文字、图片、视频、小程序和链接的完整素材组，校验所有字段和排序。
2. 复制后校验图片 `localImageUrl`、`wecomImageUrl` 原值保留，且 `FileApi`/企业微信客户端无交互。
3. 已存在副本名称时生成 `(2)`，继续冲突时生成 `(3)`。
4. 复制后编辑、排序、删除副本，确认源组和素材不变。
5. 源组不存在、已删除、空组、无效企业微信配置时拒绝复制。
6. 跨租户和跨企业微信配置请求被拒绝。
7. 模拟素材插入失败，确认事务不残留新组或部分素材。
8. 重复/并发复制不覆盖已有组，均返回独立的新组或明确失败。

## E2E 场景

1. 管理员在素材组列表复制组，看到成功提示、新组和完整素材。
2. 无创建权限用户看不到复制按钮，直接调用接口也被拒绝。
3. 复制后切换并编辑副本，回到源组确认内容和顺序未变化。

## 验证命令

- `mvn -pl yshop-module-mp/yshop-module-mp-biz -am -Dtest=WecomMaterialServiceImplTest -Dsurefire.failIfNoSpecifiedTests=false test`
- `pnpm ts:check`
- `pnpm build:dev`

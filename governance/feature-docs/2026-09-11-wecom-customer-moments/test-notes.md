# 测试记录

- `mvn -pl yshop-module-mp/yshop-module-mp-biz -am -DskipTests compile`：通过。
- `git diff --check`：通过。
- `pnpm ts:check`：失败，Node 默认堆上限 OOM；提高到 8192MB 后仍失败，报告仓库既有大量类型错误；新增 moment 文件未出现在错误列表。
- backend 定向 `WecomMomentServiceImplTest`：4 个用例通过，覆盖素材组快照、非法素材类型、超过 9 张图片和跨配置素材组。
- 真实企业微信联调、API/E2E 测试：未执行。

# 验证记录

- `(cd .worktrees/backend-miniapp-qrcode && mvn -pl yshop-module-mp/yshop-module-mp-biz -am test)`: pass；新增服务测试 6 项、Controller 测试 2 项通过。
- `git diff --check`: pass。
- `(cd .worktrees/backend-miniapp-qrcode && mvn -pl yshop-server -am package -DskipTests)`: 未完成；worktree 的 Git 元数据未被 `git-commit-id-maven-plugin` 识别（`Could not get HEAD Ref`），不是 Java 编译错误。
- 未进行真实微信和 OSS 联调；需部署环境验证 URL 可访问性及生命周期清理。

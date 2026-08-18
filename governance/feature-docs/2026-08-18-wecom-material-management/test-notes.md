# 企业微信素材管理验证记录

## 已执行

| 仓库 | 命令 | 结果 |
|---|---|---|
| backend | `mvn -pl yshop-module-mp/yshop-module-mp-biz -am -DskipTests compile` | 通过；MP biz 234 个源文件编译，保留既有 MapStruct/Swagger 警告 |
| backend | `mvn -pl yshop-module-mp/yshop-module-mp-biz -am -Dtest=WecomMaterialServiceImplTest -Dsurefire.failIfNoSpecifiedTests=false test` | 通过；新增素材组原子创建、单文字限制、群发消息编排共 3 项测试 |
| admin | `pnpm build:dev` | 通过；新增素材管理页面、表单和群发改造完成 Vite 构建 |
| backend/admin | `git diff --check` | 通过；无空白错误 |

## 未完成或受限验证

- `admin: pnpm ts:check` 未通过。该仓库当前存在大量与本功能无关的既有全局自动导入/类型声明错误，例如 `ref`、`computed`、`ExpressPageReqVO` 等未解析；构建流程已成功完成，新增代码未出现独立构建错误。
- 未执行真实企业微信 API、图片上传、临时小程序封面上传和部分群失败场景；需要测试租户、文件服务以及企业微信权限。
- 未执行 Playwright E2E；当前未启动完整后端、MySQL、Redis、文件服务和企业微信/mock 环境。
- 未重新生成 `governance/CONTRACT/backend-api.json`。仓库 OpenAPI profile 需要完整运行时依赖和 8888 服务，当前仅完成静态编译与定向单测；部署前应按治理流程重新生成机器快照。

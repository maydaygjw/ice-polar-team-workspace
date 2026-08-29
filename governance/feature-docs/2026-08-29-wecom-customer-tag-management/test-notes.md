# 企业微信客户标签库管理测试记录

## 已执行

- mvn -pl yshop-module-mp/yshop-module-mp-biz -am -DskipTests compile：通过。
- mvn -pl yshop-module-mp/yshop-module-mp-biz -am -Dtest=WecomCustomerTagServiceImplTest -Dsurefire.failIfNoSpecifiedTests=false test：通过，4 个新增用例通过。
- mvn -pl yshop-module-mp/yshop-module-mp-biz -am test：通过，MP 模块共 51 个用例通过。
- pnpm exec eslint src/api/mp/wecom/customerTag.ts src/views/mp/wecom/customerTag/index.vue src/views/mp/wecom/customerTag/TagGroupForm.vue：通过。
- pnpm exec prettier --check src/api/mp/wecom/customerTag.ts src/views/mp/wecom/customerTag/index.vue src/views/mp/wecom/customerTag/TagGroupForm.vue：通过。
- pnpm build:dev：通过（格式化后复核）。
- 管理端 vue-tsc 使用 8GB 堆内存运行后，新增客户标签文件无类型错误；全量检查仍有仓库既有类型错误（未导入的全局类型/组合式 API等）。

## 未执行或限制

- 未调用真实企业微信接口：需要测试 CorpID、客户联系 Secret 和“管理企业客户标签”权限。
- 未执行浏览器 E2E：本功能 meta 标记为 e2e: false，且当前没有测试账号和真实企业微信数据。
- 未重新生成 governance/CONTRACT/backend-api.json：OpenAPI profile 依赖完整运行时服务，当前仅完成模块编译和单元测试。
- stylelint 受当前配置与已安装 Stylelint 版本不兼容影响，报告 unicode-bom 等未知旧规则；本次新增样式的属性顺序问题已修正。

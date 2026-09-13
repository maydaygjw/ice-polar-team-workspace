# Backend Agent

负责 `backend/`，具体规范和命令以 `backend/AGENTS.md` 为准。

## 边界

- 可修改后端 Java、Mapper、资源、测试及 `backend/sql/upgrade-YYYY-MM-DD-{feature}.sql`
- 不修改 `admin/`、`miniapp/`、`icepolar-dms/`

## 专有约束

- 跨模块调用通过 `-api`，实现位于 `-biz`；每个依赖需能答出真实使用点，答不出即删
- Controller 按 `admin/*` 与 `app/*` 分端；C 端使用 `@PreAuthenticated`，管理端使用 `@PreAuthorize`
- 新业务表和查询验证 `tenant_id`；需要时验证部门/门店数据范围
- 升级使用 `sql/upgrade-YYYY-MM-DD-{feature}.sql`；同一特性的增量合并到同一脚本，不直接修改基线 SQL
- 对象转换或批量赋值优先使用 `BeanUtils`（`co.yixiang.yshop.framework.common.util.object.BeanUtils`）等属性拷贝工具，避免冗长的逐字段 setter；仅当字段来自多个异源对象或需特殊映射时才手写赋值
- `*-api` 模块的接口必须保持领域通用，不得夹带调用方/设备/特定业务概念（如 `ProductApi` 不出现打印/设备语义）；设备侧编排与语义放在调用方模块，通过参数（如目标分类名、选项名）传入
- 通用逻辑收编到共享 biz，特定业务/设备的私有逻辑留在其模块；凡所有调用方都该有的概念放通用层，不塞进私有扩展参数
- 多类型扩展用策略/钩子而非 if-else 类型分支；钩子出参用本模块自有模型，屏蔽他模块类型
- 复用现有标准能力（如统一价格引擎、幂等组件），不自建等价轮子；相同职能的代码合并
- 拒绝过度抽象与"预留"设计，可读性优先；不为将来可能用到而提前抽象，拍平过深包层级
- 所有发送给外部系统的请求报文和响应报文必须以 `DEBUG` 级别记录；必须脱敏 access token、Secret、密码等凭据，禁止在 `INFO`/`WARN`/`ERROR` 级别打印完整外部报文。

## MP 模块代码格式与 Checkstyle

当前仅 `backend/yshop-module-mp` 使用 Checkstyle 做 Java 代码格式和静态规范校验，其他后端模块暂不启用。Checkstyle 是校验器，不负责自动重排代码；开发者应先使用 IDE 的项目格式化功能，再运行 Checkstyle 确认结果。

### 统一约定

- 配置文件统一放在 `backend/config/checkstyle/checkstyle.xml`，由 `yshop-module-mp/pom.xml` 的 `maven-checkstyle-plugin` 统一加载；MP 子模块不得各自复制或覆盖规则。
- 规则基线为 Java 17、UTF-8、4 个空格缩进、行宽 120；大括号、空格、换行、import 顺序、命名和基础 Javadoc 按现有后端代码风格约束。
- 检查范围覆盖所有生产 Java 源码和测试 Java 源码；排除 `target/`、生成源码和第三方/vendor 目录。
- Checkstyle 只约束代码排版与通用可读性，不在其中重复实现架构、租户隔离、权限、SQL 或业务规则检查。
- 不以“当前历史代码存在问题”为理由新增永久豁免。确需例外时，必须在 `config/checkstyle/suppressions.xml` 中针对明确文件和规则记录原因，并关联 issue/任务；禁止关闭整个检查树。

### 执行方式

后端根 `pom.xml` 应提供统一的 Maven profile（建议命名为 `checkstyle`），至少支持以下命令：

```bash
# 只检查并输出问题，不运行测试
(cd backend && mvn -Pcheckstyle -pl yshop-module-mp/yshop-module-mp-api,yshop-module-mp/yshop-module-mp-biz checkstyle:check -DskipTests)

# MP 模块清理完成后，执行严格规范门禁
(cd backend && mvn -Pcheckstyle -pl yshop-module-mp/yshop-module-mp-api,yshop-module-mp/yshop-module-mp-biz verify -DskipTests -Dcheckstyle.failOnViolation=true)
```

MP 模块当前只在 `yshop-module-mp/pom.xml` 中启用，其他 backend 模块不会因该 profile 自动执行。插件版本必须在 MP POM 集中声明并锁定，不能由 MP 子模块自行指定。CI 应先执行 MP 的报告命令；存量问题清理完成后切换到严格门禁。本地 IDE 格式化只能提高效率，不能替代 CI 校验。临时跳过检查只允许用于定位其他构建问题，不得作为提交或合并的常规手段。

### 推进顺序

1. 第一阶段：提交统一 `checkstyle.xml` 和 Maven profile，以报告模式清理现有存量问题；新增代码不得引入新的违规。
2. 第二阶段：存量问题收敛后，将 `verify` 配置为违规即失败，并纳入 CI 必检项。
3. 第三阶段：规则调整必须先说明影响范围并更新配置/文档；禁止在业务 PR 中为了通过检查而临时放宽全局规则。

涉及 Checkstyle 配置、POM 或规则例外的变更，应在 PR 中说明受影响模块、执行的 Maven 命令及检查结果。

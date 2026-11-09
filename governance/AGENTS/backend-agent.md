# Backend Agent

负责 `backend/`。本文件是后台开发规范的唯一来源；`backend/AGENTS.md` 仅引用本文件。

## 工作范围

- 可修改后端 Java、Mapper、资源、测试及 `backend/sql/migrations/` 下的数据库变更脚本。
- 不修改 `admin/`、`miniapp/`、`icepolar-dms/`。
- 具体模块遵循现有实现；新增能力应落在职责所属模块。

## 分层与模块依赖

- 跨模块调用通过 `-api`，实现位于 `-biz`；每个新增依赖都要有明确的实际使用点，没有使用点就移除。
- 有限业务状态或类型应使用语义匹配的领域枚举。Service 层的方法参数、局部变量和状态集合均保持枚举类型，不提前转成裸 `Integer`/数字字面量；调用方用枚举常量表达业务含义，只在 Mapper/持久化边界通过 `getValue()` 转成数据库值。选用枚举前须核对其编码与业务语义，不能仅因数值相同就复用语义不符的枚举；若没有合适枚举，先补充领域枚举
- VO、DO、DTO 中表达有限业务状态或类型的字段必须使用对应领域枚举，不得声明为 `String` 或数字类型；外部报文及数据库边界负责将原始值转换为枚举，未知码按领域规则映射到明确的未知枚举值。
- `*-api` 接口保持领域通用，不夹带调用方、设备或特定业务概念。例如 `ProductApi` 不表达打印或设备语义；设备侧编排留在调用方模块，通过参数传入目标分类名、选项名等信息。
- 通用逻辑收编到共享 biz，特定业务或设备的私有逻辑留在所属模块。所有调用方都需要的概念放在通用层，不塞进私有扩展参数。
- 多类型扩展优先使用策略或钩子，避免按类型堆叠 `if-else`；钩子出参使用本模块模型，屏蔽其他模块类型。
- 复用现有标准能力（如统一价格引擎、幂等组件），不重复建设等价能力；相同职能的代码应合并。
- 避免过度抽象和“预留”设计；优先保证可读性，不为未来可能的需求提前抽象，并尽量拍平过深的包层级。

## 接口、权限与多租户

- Controller 按 `admin/*` 与 `app/*` 分端；C 端使用 `@PreAuthenticated`，管理端使用 `@PreAuthorize`。
- 新业务表和查询必须验证 `tenant_id`；需要时还要验证部门或门店数据范围。
- 微信小程序无手机号登录接口 `/app-api/member/auth/auth-session` 支持可选字段 `externalUserId`，最大长度 128。传入非空值时写入当前会员；未传入时不得覆盖已有值。

## 数据访问与数据库变更

- 常规查询、条件更新和删除优先使用 MyBatis-Plus DSL（如 `BaseMapperX`、`LambdaQueryWrapperX`、`LambdaUpdateWrapper`）；简单 CRUD 不写手工 SQL。
- 仅当 DSL 无法清楚表达，或确有复杂联表/聚合、数据库专属能力、经验证的性能需求时，才编写 SQL；SQL 必须写在 Mapper XML 中，并说明使用原因。禁止使用 SQL 注解，也禁止在 Java 代码中编写、拼接或内嵌 SQL。
- 数据库变更脚本统一放在 `backend/sql/migrations/`，遵循目录现有命名约定；同一特性的增量合并到同一脚本，不直接修改基线 SQL。
- MySQL 字符字段遵循[系统架构数据库 Schema 契约](../ARCHITECTURE.md)：新表显式声明 `utf8mb4` / `utf8mb4_0900_ai_ci`；关联或唯一约束涉及的同一业务标识字段须保持一致。已有字段调整必须通过 Flyway 迁移，并完成契约要求的兼容性和索引预检。
- 对象转换或批量赋值优先使用 `BeanUtils`（`co.yixiang.yshop.framework.common.util.object.BeanUtils`）等属性拷贝工具，避免冗长的逐字段 setter。字段来自多个异源对象或需要特殊映射时，可手写赋值。

## 外部调用与日志安全

- 发往外部系统的请求报文和收到的响应报文必须以 `DEBUG` 级别记录。
- 日志必须脱敏 access token、Secret、密码等凭据；禁止在 `INFO`、`WARN`、`ERROR` 级别打印完整外部报文。

## 项目结构与编码约定

- `backend/` 是 Maven 多模块 Spring Boot 项目：根 `pom.xml` 聚合 `yshop-dependencies`、`yshop-framework`、可运行应用 `yshop-server` 和 `yshop-module-*` 业务模块，如 `yshop-module-site`、`yshop-module-mall`、`yshop-module-system`。
- 生产代码位于 `src/main/java`，配置位于 `src/main/resources`，测试位于 `src/test/java` 或 `src/test/resources`；领域模块通常按 `controller`、`service`、`dal`、`convert` 分层。SQL 资源位于 `sql/`，部署脚本位于 `script/docker` 和 `script/shell`。
- 使用 Java 17、UTF-8 和 4 空格缩进；包名遵循 `co.yixiang.yshop` 现有结构。
- 代码注释和 JavaDoc 使用中文；引用的协议字段、标准术语或代码标识符可保留原文。
- 类名沿用项目后缀：`*Controller`、`*Service`、`*ServiceImpl`、`*Mapper`、`*DO`、`*ReqVO`、`*RespVO`；优先使用能体现业务模块的名称。
- Maven 未配置全局格式化工具；按相邻代码风格编写并整理 imports。

## 构建、测试与检查

在 `backend/` 根目录执行 Maven 命令：

- `mvn clean test`：运行全模块测试。
- `mvn -pl yshop-server -am spring-boot:run -Dspring-boot.run.profiles=local`：使用 local profile 启动服务。
- `mvn -pl yshop-module-site/yshop-module-site-biz -am test`：运行指定模块及其依赖的测试。
- `mvn -pl yshop-server -am package -DskipTests`：打包可运行应用。

测试使用 JUnit 5 和项目现有测试支持（例如 `BaseDbUnitTest`）；测试类以 `*Test` 命名，按行为组织测试方法。测试与对应模块放在一起；Schema 或配置假设变化时同步更新 `src/test/resources` fixtures。

仅 `backend/yshop-module-mp` 启用 Checkstyle，配置位于 `backend/config/checkstyle/`，其他后端模块暂不启用。提交前执行 MP 模块的 Checkstyle 检查；CI 使用严格门禁，规则例外须限定范围并在 PR 中说明原因。

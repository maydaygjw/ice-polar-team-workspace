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


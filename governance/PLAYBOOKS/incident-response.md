# 线上故障响应与诊断手册

> 供 devops-agent 和值班工程师处理用户报障。目标是在不扩大影响的前提下，快速定位根因、保留证据并完成移交。部署、回滚、连接和健康检查详见 [`deployment.md`](deployment.md)。

## 1. 开始前

### 1.1 加载环境

所有命令都使用环境变量，禁止在文档、脚本或报告中写入主机、密码等敏感信息。

```bash
# 在 workspace 根目录执行；将 test 替换为目标环境
source governance/SCRIPTS/deploy-helper.sh && load_env test
```

### 1.2 关键证据源

| 类型 | 位置/对象 |
|------|-----------|
| yshop 日志 | `${YSHOP_START_PATH}/app.log`；生产环境优先查 `journalctl -u yshop.service` |
| DMS 主服务日志 | `${DMS_CODE_PATH}/scripts/main.log` |
| DMS 模拟器日志 | `${DMS_CODE_PATH}/scripts/simulator.log` |
| 数据库 | MySQL 8.0；连接参数取自目标环境配置 |
| 常查表 | `yshop_store_order`、`yshop_coupon_user`、`yshop_coupon`、`yshop_user`、`yshop_store_product` |

> 日志未自动轮转：优先按时间、订单号、用户 ID、IMEI 精确过滤，避免一次读取整个文件。

## 2. 诊断流程

1. **收集线索**：环境、发生时间及时区、现象/报错、截图、订单号、用户 ID、IMEI、影响范围、复现步骤。
2. **确认影响**：判断单用户/单设备还是全局故障；检查服务进程、端口和依赖。影响持续扩大时，先按已批准的降级/回滚方案止损。
3. **检索日志**：以故障时间为中心，用业务标识串联请求链路；保留关键上下文和时间戳。
4. **补充动态诊断**：日志不足且已知疑似 Java 类/方法时，按第 4 节使用 Arthas 观测；不重启、不临时加日志。
5. **核对数据**：只读查询相关表，核对状态、时间、租户和关联记录；不得先改数据再找原因。
6. **对照代码**：沿 Controller → Service → Mapper/外部依赖还原路径，标注文件和行号。
7. **验证假设**：用日志、数据库和代码证据交叉验证；明确区分已证实根因、高概率假设和待确认项。
8. **处置并记录**：按第 5 节修复或移交，验证恢复后按第 6 节输出诊断报告。

## 3. 命令速查

### 3.1 yshop

```bash
# 最近日志（生产环境优先 journal，文件作为补充）
ssh ${DEPLOY_USER}@${SERVER_HOST} "journalctl -u yshop.service --no-pager -n 200"
ssh ${DEPLOY_USER}@${SERVER_HOST} "tail -n 200 ${YSHOP_START_PATH}/app.log"

# 按订单号/时间过滤；替换占位符
ssh ${DEPLOY_USER}@${SERVER_HOST} "grep -nF -- 'ORDER_ID' ${YSHOP_START_PATH}/app.log | tail -n 50"
ssh ${DEPLOY_USER}@${SERVER_HOST} "grep -nF -- 'YYYY-MM-DD HH:MM' ${YSHOP_START_PATH}/app.log | tail -n 50"

# 实时观察（结束时按 Ctrl-C）
ssh ${DEPLOY_USER}@${SERVER_HOST} "tail -f ${YSHOP_START_PATH}/app.log"

# 健康检查
ssh ${DEPLOY_USER}@${SERVER_HOST} "systemctl status yshop.service --no-pager | head -n 20"
ssh ${DEPLOY_USER}@${SERVER_HOST} "ss -tlnp | grep \":${YSHOP_PORT}\b\""
```

### 3.2 icepolar-dms

```bash
# 最近日志
ssh ${DEPLOY_USER}@${SERVER_HOST} "tail -n 200 ${DMS_CODE_PATH}/scripts/main.log"
ssh ${DEPLOY_USER}@${SERVER_HOST} "tail -n 200 ${DMS_CODE_PATH}/scripts/simulator.log"

# 按 IMEI/订单号过滤；替换占位符
ssh ${DEPLOY_USER}@${SERVER_HOST} "grep -nF -- 'IMEI' ${DMS_CODE_PATH}/scripts/main.log | tail -n 50"
ssh ${DEPLOY_USER}@${SERVER_HOST} "grep -nF -- 'ORDER_ID' ${DMS_CODE_PATH}/scripts/main.log | tail -n 50"

# 健康检查
ssh ${DEPLOY_USER}@${SERVER_HOST} "ss -tlnp | grep \":${DMS_PORT}\b\""
ssh ${DEPLOY_USER}@${SERVER_HOST} "ps -ef | grep '[s]tart_main.sh'"
ssh ${DEPLOY_USER}@${SERVER_HOST} "ps -ef | grep '[s]tart_simulator.sh'"
```

### 3.3 数据库

```bash
# 从应用配置确认当前 profile 和数据源；禁止复制密码到报告
PROFILE=dev  # 替换为目标环境的实际 profile
ssh ${DEPLOY_USER}@${SERVER_HOST} "grep -nA8 'datasource' ${YSHOP_START_PATH}/src/main/resources/application-${PROFILE}.yaml"

# 从应用服务器连接 MySQL，-p 使密码通过交互输入
ssh -t ${DEPLOY_USER}@${SERVER_HOST} "mysql -h ${DB_HOST} -P ${DB_PORT} -u ${DB_USER} -p ${DB_NAME}"
```

查询时先按主键/业务标识精确限定，并显式带上 `tenant_id`；只取诊断所需字段，避免 `SELECT *` 和无条件全表扫描。

## 4. Arthas 动态诊断

**触发条件**：现有日志无法确定根因，但已知疑似服务、类或方法。

调用 **`arthas-doctor`** skill，按 CPU、内存、线程或方法跟踪场景执行最小必要观测。诊断期间：

- 仅观测，禁止使用 `redefine` 热更新；修复必须走正常部署流程。
- 限制跟踪范围和次数，避免高频方法观测放大线上负载。
- 结束后必须执行 `stop` 退出 Arthas。

## 5. 处置与升级

| 根因/修复类型 | 动作 |
|---------------|------|
| Java 后端 | 将诊断报告移交 **backend-agent** |
| Vue/管理后台 | 移交 **frontend-agent** |
| 微信小程序 | 移交 **miniapp-agent** |
| Nginx、DB、JVM 参数等配置/环境 | 测试环境验证后修复，记录变更和回滚方案 |
| DMS、微信支付等外部依赖 | 记录依赖方证据和临时规避方案，通知用户并升级 |
| 需手工修复数据 | 准备可审核 SQL、影响行预查和回滚方案；获得用户明确批准后才执行 |

处置后必须按原始报障路径复验，同时检查日志、数据状态及关联链路，确认无新增错误。

## 6. 诊断报告模板

```markdown
# 故障：[简述]

- 时间/时区：[发生时间]
- 环境：[测试/生产]
- 报告人：[用户/Agent]
- 影响：[范围、订单号/用户 ID/IMEI]
- 状态：[已恢复/已止损/诊断中]

## 现象
[用户可见现象和复现步骤]

## 证据
- 日志：[时间戳、关键摘要；脱敏]
- 数据：[查询条件和关键结果；脱敏]
- 代码路径：[文件:行号]

## 结论
- 根因：[已证实结论；未证实时明确标注“假设”]
- 处置：[已执行动作及结果]
- 验证：[复验方法及结果]
- 后续：[修复/预防措施、负责 Agent]
```

## 7. 安全红线

1. devops-agent 只读取业务代码用于诊断，不直接修改业务逻辑；代码修复移交对应开发 Agent。
2. 未经用户明确批准，禁止执行 `DELETE`、`DROP`、无 `WHERE` 的 `UPDATE` 等破坏性 SQL。
3. 禁止在命令、脚本、诊断报告或 Git 中写入密码、密钥、Token 等凭证；证据必须脱敏。
4. 配置变更必须先在测试环境验证，再按部署手册应用到生产并保留回滚能力。
5. Arthas 仅用于观测：禁止 `redefine`，诊断后必须 `stop`。
6. 每起故障必须记录时间线、根因、处置、验证和预防措施。

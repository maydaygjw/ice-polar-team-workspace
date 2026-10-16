# 故障诊断手册

供 DevOps Agent 和值班工程师排查 dev、test、prod 环境故障，保留证据并移交。生产诊断只读；生产变更由人工执行，边界见[生产发布与交接](deployment.md)。

## 1. 确认环境和请求

先记录请求时间及其时区（团队记录使用 Asia/Shanghai）、域名、方法、路径、租户、业务标识、客户端看到的 HTTP 状态和脱敏响应。没有请求时间或业务标识时，先确认可用于检索的时间范围。

从 workspace 根目录加载目标环境。`dev`、`test`、`prod` 是候选配置，不能代替路由核对：

```bash
env_name=dev # 按目标改为 dev、test 或 prod
set +x
source governance/SCRIPTS/deploy-helper.sh
load_env "$env_name"

SSH_ARGS=()
if [[ -n "${SSH_KEY_PATH:-}" ]]; then
  SSH_ARGS=(-i "$SSH_KEY_PATH")
fi
```

不要 `cat` 环境文件，也不要在加载后打印变量值；避免运行 `env`、`printenv`、`set`、完整的 `docker inspect` 或 `/proc/<pid>/environ`。排查前先核对目标配置中的域名、主机、端口和日志路径，再通过 DNS/入口、Nginx 或网关 upstream、运行进程/容器和健康接口交叉确认实际链路。不要单凭域名后缀或环境文件名称确定环境。

依次确认：**请求域名 → DNS/入口 → 网关/Nginx → upstream → 进程或容器 → 实际数据源**。若解析或代理可能经过本机代理，记录实际解析结果并排除代理影响。链路未确认前，不以其他环境的日志或数据作为结论。

## 2. 定位日志

先从目标环境配置和运行实例确认日志位置。dev 配置提供 `YSHOP_SERVER_LOG_FILE` 和 `YSHOP_ACCESS_LOG_FILE`；容器环境还要核对日志卷挂载和容器 stdout/stderr。日志路径可能随部署方式变化，以运行实例为准。

业务异常不一定以 `ERROR` 级别记录。Spring 统一异常处理器可能把预期的 `ServiceException` 记为 `INFO`，且访问日志可能记录 HTTP 200。按请求时间、URL、业务标识和异常消息搜索，不要只筛 `ERROR`。

对当前日志和 gzip 轮转日志限量检索。以下示例只输出命中行及上下文，不读取整份日志：

```bash
# 在 workspace 根目录运行；只传递日志路径和本次检索条件，不传环境文件内容。
ssh "${SSH_ARGS[@]}" "$DEPLOY_USER@$SERVER_HOST" bash -s -- \
  "$YSHOP_SERVER_LOG_FILE" "$YSHOP_ACCESS_LOG_FILE" \
  '2026-10-15 22:02:24' '/admin-api/example/path' <<'REMOTE'
server_log=$1
access_log=$2
time_match=$3
path_match=$4

search_file() {
  case "$1" in
    *.gz) zgrep -n -F -C 8 -- "$2" "$1" || true ;;
    *)    grep  -n -F -C 8 -- "$2" "$1" || true ;;
  esac
}

search_file "$server_log" "$time_match"
for file in "${server_log%/*}"/server.*.gz; do
  [[ -f "$file" ]] && search_file "$file" "$time_match"
done
search_file "$access_log" "$path_match"
for file in "${access_log%/*}"/access.*.gz; do
  [[ -f "$file" ]] && search_file "$file" "$path_match"
done
REMOTE
```

将示例时间和路径替换为本次请求信息。轮转文件可能跨日或使用 gzip；先列出目录中的文件名和时间，再检索覆盖请求时间的文件。区分主机时区、容器时区和日志时间，不要在未核实前直接换算。

日志内容可能包含请求参数、个人信息或密钥。只查看必要上下文；记录证据前移除 Cookie、Authorization/Bearer、密码、Token、微信密钥、手机号及不相关业务字段。不要把完整请求体或完整日志复制到报告。

## 3. 核对运行实例和版本

| 对象 | 检查方法 |
|---|---|
| 入口 | 核对生效的虚拟主机、代理目标与访问日志；DNS 结果需排除本地代理影响 |
| 运行实例 | 先识别 systemd、Docker 或裸进程，再检查服务/容器状态、PID、启动参数及监听端口 |
| 制品与配置 | 从运行实例定位实际 JAR/镜像，记录 SHA-256、内嵌 commit、JDK 和 profile；核对外置配置、环境变量及启动参数的覆盖关系 |
| 日志 | 从实例确认日志输出位置，按时间和业务标识限量检索当前及轮转日志 |
| 数据 | 使用确认过的目标数据源，在只读事务中按租户、主键或业务标识查询必要字段 |
| 代码 | 对照运行制品的 commit，沿 Controller → Service → Mapper/外部依赖还原校验和筛选条件 |

后端问题优先确认请求命中的服务实例、运行 JAR/镜像和完整 commit，再把堆栈位置与相同 commit 的代码对照。代码目录当前分支或本地未提交文件不能代替运行制品身份。

## 4. 只读查询数据库

确认目标实例实际使用的数据源后，优先从目标环境配置加载连接参数；例如 dev 的 `dev.env` 提供 `DB_HOST`、`DB_PORT`、`DB_NAME`、`DB_USER`、`DB_PASSWORD`。若 test/prod 配置不提供这些变量，使用该环境文档指定的受控密钥源，不要拿 dev 配置代替。连接前再次核对主机、库名和环境。若使用 `dev.env`，先按第 1 节的方式 `load_env dev`；环境变量会导出给 Python 子进程，但不要打印其值。

只查询复现问题所需字段，并把接口相同的租户、逻辑删除、状态和权限条件写入 SQL。Python 环境已有 PyMySQL 时，可按以下模式执行只读事务；查询字段和条件替换成实际表结构：

```bash
python3 - <<'PY'
import os
import pymysql

conn = pymysql.connect(
    host=os.environ["DB_HOST"],
    port=int(os.environ["DB_PORT"]),
    user=os.environ["DB_USER"],
    password=os.environ["DB_PASSWORD"],
    database=os.environ["DB_NAME"],
    connect_timeout=10,
    autocommit=False,
    charset="utf8mb4",
)
try:
    with conn.cursor() as cursor:
        cursor.execute("START TRANSACTION READ ONLY")
        cursor.execute(
            "SELECT id, tenant_id, status FROM example_table "
            "WHERE tenant_id=%s AND id=%s AND deleted=0",
            (158, 123),
        )
        for row in cursor.fetchall():
            print(row)
    conn.rollback()
finally:
    conn.close()
PY
```

不要在 SQL 客户端参数、命令行、临时脚本、报告或聊天消息中写入密码。不要开启 shell trace（`set -x`），不要打印连接对象、完整环境变量或数据库连接异常中的敏感配置。若查询失败，先只记录异常类型和 SQLState，再检查目标网络和授权。不得使用 `UPDATE`、`DELETE`、DDL、`repair` 或其他写操作；需要修复时按人工审批流程处理。

## 5. 判断业务结果和根因

同时检查 HTTP 状态、响应业务码/消息、应用异常和必要的副作用证据。某些统一异常处理器会将业务错误包装在 HTTP 200 响应中；HTTP 200 不能单独证明操作成功。反过来，也不能仅凭通用错误文案认定配置或代码根因。

沿日志和堆栈还原实际执行顺序：确认最后一条成功查询/调用、紧随其后的失败位置，以及后续步骤是否执行。再以同一租户和主键只读核对数据库记录，对照运行制品版本中的校验规则。明确区分：

- **已证实**：日志、数据库记录与运行版本代码互相吻合的事实。
- **待验证**：尚未取得远端运行版本、数据库字段或外部响应支持的推测。
- **无证据**：未查到记录或日志；不能写成“未发生”。

外部系统问题核对“业务筛选结果 → 外发目标数组 → 外部响应”三段证据。仅在现有证据不足且已知目标类/方法时，才使用 Arthas 限次观测；禁止热更新、重启或临时修改日志配置，结束后执行 `stop`。

## 6. 移交与复验

业务代码问题交对应开发角色；环境问题由 DevOps 准备修复方案。生产数据修复须提供限定租户和主键的 SQL、影响行预查及回滚方案，由人工审批并执行；生产发布和回滚按[发布手册](deployment.md)处理。

需要修复或改配置时，先提交证据和建议。排查中不得直接修改数据库、重启服务、切换配置或替换制品；测试环境变更也必须遵守对应发布流程。处置后按原始请求复验，并检查关联数据、日志和业务副作用。诊断期间不得把未执行的修复记为已恢复。

在 `governance/REPORTS/` 记录：发生时间及所用时区、影响、实际环境和运行版本、脱敏请求/日志/数据/代码证据、已证实根因与待验证假设、执行过的只读操作、处置与复验结果、后续负责人。疑似凭据泄露单独按安全事件记录，不保存或复制凭据原值，并通知用户安排轮换。

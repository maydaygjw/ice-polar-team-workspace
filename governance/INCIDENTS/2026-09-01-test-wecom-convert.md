# 测试环境企业微信后台接口异常

- 时间/时区：2026-09-01 23:10（Asia/Shanghai，日志时间）
- 环境：测试
- 报告人：用户报障
- 影响：yshop 进程、8888 端口和健康接口正常；企业微信后台相关接口在调用 `WecomConvert` 时失败。
- 状态：已恢复，待企业微信后台接口完成业务烟测

## 现象

请求企业微信后台接口时返回服务端异常。应用日志记录 `ExceptionInInitializerError`，堆栈落到 `WecomAccountController.listAllSimple`。

## 证据

- `app.log` 2026-09-01 23:10:26：`WecomConvert` 初始化失败。
- 同一堆栈包含 `java.lang.Error: Unresolved compilation problems`，涉及企业微信 VO、DO 及 MapStruct 生成实现类。
- 测试运行态：PID `663304`，启动参数为 `java -jar target/yshop-server.jar --spring.profiles.active=dev`，8888 监听正常，`/actuator/health/` 返回 `{"status":"UP"}`。
- 当前运行 JAR 的企业微信模块 class 与本地发布 JAR 一致；class 常量池仍包含 `Unresolved compilation problems`。
- 对同一固定提交执行清理构建后，重新生成的 `WecomConvertImpl.class` 包含正常的 VO/DO 方法引用，不再包含该错误标记。

## 结论

已证实根因是后端增量构建目录中的错误 MapStruct 生成 class 未被清理，随后被打入发布 JAR。`4de4ee84` 虽已加入强制使用 `javac` 的配置，但本次发布使用未清理的增量产物，未消除历史残留 class。

这不是服务启动失败，也不是数据库或微信凭据导致的本次 `WecomConvert` 初始化异常。

## 处置

- 已完成只读运行态、日志和 JAR 内容核查。
- 已在本地对固定提交完成 `mvn -pl yshop-module-mp/yshop-module-mp-biz -am clean compile -DskipTests -q` 验证，干净构建可生成正常 class。
- 已在固定提交 `e876a6a92ce08d7d6ec5abd0e837c3381a9f99be` 上执行 `mvn -pl yshop-server -am clean package -DskipTests` 并成功完成 74 个模块构建。
- 新 JAR SHA-256：`f91f91897ba144e3b3d4d04b28c3d15ca6cbfcb4194382675c0513f10491c793`；上传后远端 SHA-256 一致，内嵌 commit 一致。
- 已替换并重启测试环境，运行 PID `2129728`，8888 监听正常，健康接口返回 `UP`；重启后日志未再出现该错误。
- 未修改业务代码、数据库和测试环境运行配置；未执行数据库迁移。

## 后续

- 负责人：backend-agent
- 发布前必须使用干净工作区/`mvn clean` 生成后端制品，并在发布门禁中校验关键 MapStruct class 不包含 `Unresolved compilation problems`。
- 由 backend-agent 完成企业微信后台接口定向烟测，并继续处理订单购物车异步任务的独立 `NullPointerException`。

## 其他日志异常

- 22:53 的订单购物车异步任务存在独立 `NullPointerException`，需要订单链路标识才能继续定位。
- 微信模板消息出现 IP 不在白名单的 40164，属于微信侧白名单配置问题，与本次 MapStruct 异常独立。
- 22:43 的 HTTP 请求头解析错误表现为向 HTTP 端口发送非 HTTP 数据，暂不能认定为业务故障。

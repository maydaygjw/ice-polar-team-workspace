# 美团镜像导入顺序修复 test 部署记录

- 部署时间：2026-08-31 21:49（Asia/Shanghai）
- 环境：test
- 范围：yshop 后端；无 SQL、管理后台或 DMS 变更

## 制品

- 构建环境：test 主机隔离临时目录，OpenJDK 21.0.12
- 构建命令：`mvn -pl yshop-server -am package -DskipTests`
- 基准 commit：`57364309b1667efb3c28e44c9800681c74a3f7f7`
- 本地工作区 diff SHA-256：`68faf570bce5b438e40e2a074ca10f07a44989666bdbd492a80619eb5c433347`
- JAR SHA-256：`b029f7e7b6b062ffecae3660015b9812ca73459d4037a18db9d821d7617e66ad`
- 上一版 JAR SHA-256：`f89924472cac020333553cebd43d31cce22238b2915bb636849c8a756b33b04f`
- 回滚制品：`yshop-server.jar.bak.20260831214758`

## 验证

- 定向测试：店铺导入 12 个、商品导入写入 1 个，全部通过。
- Java 21 完整 reactor 打包成功。
- 运行 profile：`dev`；端口 `8888` 正常监听。
- 运行 JAR commit 与 SHA-256 和候选制品一致。
- test 主机根接口及公网 API 根接口均返回成功。
- 启动日志包含 `Started YshopServerApplication`，本次检查未发现启动异常。

## 说明

- 远端既有源码目录 HEAD 与本地基准不同且存在既有工作区文件，本次未覆盖远端源码目录；使用本地 Git bundle 和工作区 patch 在远端隔离目录构建，仅替换运行 JAR。
- 本次未执行数据库迁移。

## 商品关联顺序修复补充部署

- 部署时间：2026-08-31 22:36-22:42（Asia/Shanghai）。
- 修复：镜像库 `food_category_products` 使用 `captured_at` 保留美团分类内商品顺序；SPU、SKU、属性查询同样优先使用采集时间字段。
- 定向测试：`MeituanMirrorProductImportParserTest` 4 个用例通过。
- backend JAR commit：`96154d055d4bae58761b25a2b3f3170911953865`；JAR SHA-256：`541f2c93f2ae371bc9ee762039874b7bf7115e22ae5c79ecf077fed3e23f7b9c`。
- 运行态：PID `2127990`，Java 21，`dev` profile，8888 监听，根接口健康检查通过，最近日志无 ERROR。
- 回滚备份：`yshop-server.jar.bak.20260831223645`；未执行数据库迁移。

## 管理后台筛选顺序补充部署

- 部署时间：2026-08-31 22:08（Asia/Shanghai）
- 源码仓库：`admin`，commit `6e2c84139c38f843c7cc086b099dec74ec403359`，工作区仅包含本次筛选顺序修改。
- 构建命令：`pnpm build:dev`，构建成功；产物文件数 1190。
- 产物 tar SHA-256：`9c48c39c3eecb0add06f3f1a0d38d478c4b6ca81163f50db47416513985e8244`。
- 部署目录：`/opt/holun/yshop-drink-vue/dist`；旧目录备份：`/opt/holun/yshop-drink-vue/dist.bak.20260831220818`。
- 远端校验：归档 SHA-256 一致，`nginx -t` 通过并已 reload；使用 admin 域名 Host 访问本机 Nginx 返回 HTML，Nginx active。

## admin/backend 重新部署补充

- 部署时间：2026-08-31 22:26（Asia/Shanghai）。
- admin：`pnpm build:dev` 成功；产物 tar SHA-256 `563c43f41156682bb8cdf9de2dc088d7aee03beedb4e9f45659bac08aafb331f`；备份目录 `/opt/holun/yshop-drink-vue/dist.bak.20260831222548`；`nginx -t`、reload 和 admin Host 页面访问均通过。
- backend：固定 Git bundle commit `96154d055d4bae58761b25a2b3f3170911953865`，Java 21 构建成功；JAR SHA-256 `d1929c05be36ca954315c911a98d42fafb93eaa36c4d8653c79908e987b715a2`；备份 JAR `yshop-server.jar.bak.20260831222621`。
- backend 运行态：PID `2125070`，`--spring.profiles.active=dev`，8888 正常监听；根接口健康检查通过，启动日志包含 `Started YshopServerApplication`，最近日志无 ERROR。
- 本次未执行数据库迁移。

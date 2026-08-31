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

## 管理后台筛选顺序补充部署

- 部署时间：2026-08-31 22:08（Asia/Shanghai）
- 源码仓库：`admin`，commit `6e2c84139c38f843c7cc086b099dec74ec403359`，工作区仅包含本次筛选顺序修改。
- 构建命令：`pnpm build:dev`，构建成功；产物文件数 1190。
- 产物 tar SHA-256：`9c48c39c3eecb0add06f3f1a0d38d478c4b6ca81163f50db47416513985e8244`。
- 部署目录：`/opt/holun/yshop-drink-vue/dist`；旧目录备份：`/opt/holun/yshop-drink-vue/dist.bak.20260831220818`。
- 远端校验：归档 SHA-256 一致，`nginx -t` 通过并已 reload；使用 admin 域名 Host 访问本机 Nginx 返回 HTML，Nginx active。

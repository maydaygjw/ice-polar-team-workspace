# Dev 活动优惠券领取失败诊断

- 时间：2026-10-16 15:50（Asia/Shanghai）。
- 环境：从 `governance/ENVIRONMENTS/dev.env` 加载的 `dev`。API 域名 `yshop-api-dev.holuntech.cn`，健康接口返回 `UP`；日志来自该环境主机 `/mnt/yshop-nas/applogs/yshop-server/server.log`，监听线程为 `http-nio-8888`。
- 范围：只读检查日志、运行 JAR 和数据库；未修改数据、配置或制品。

## 运行版本

从运行进程 PID 410902 的实际 JAR `/opt/yshop/app.jar` 读取：

- commit：`1e7372fe5bd80d22cd0464ffe64f1357eab12922`
- SHA-256：`7bae22d56c72c5cea40f5ca45942cf7711fe7de6bad9617fecd9822842a1910b`

## 证据

日志 `server.log` 15:50:36.124 记录 `IllegalArgumentException: couponId 必须是正整数`。堆栈为 `FanhuolunGrantCouponDrawRule.validate` → `execute` → `ActivityWinnerClaimServiceImpl.executeRule` → `claim` → `claimForUser`。异常发生在规则校验阶段，饭火轮发券客户端调用尚未执行。

数据库查询在 `START TRANSACTION READ ONLY` 中完成并回滚，条件均限制在租户、主键、期次和 `deleted=0`：

- winner `22`：tenant `158`、period `42`、prize `87`，`status=1`、`claim_status=0`。
- period prize `87`：规则类型 `FANHUOLUN_GRANT_COUPON`，来源 prize `1`。该期快照 `draw_rule_params` 只有 `money`，没有 `couponId`。
- source prize `1`：当前 `draw_rule_params` 有 `couponId` 和 `money`；`couponId` 是有效的正整数字符串。

运行代码中 `FanhuolunGrantCouponDrawRule` 在发券前校验 `couponId`；领取服务以异常回滚事务并将失败重新抛出。数据库当前记录保持待领取（`claim_status=0`），本次没有证据显示发券调用发生。

## 结论与后续

已证实根因是本期奖品快照缺少 `couponId`，而当前源奖品配置包含该字段。领取时使用的是期次奖品快照，因此源奖品目前配置正确并不能让该期领取成功。现有证据不能确定快照与源配置何时、为何产生差异；需要对照活动创建时的配置记录或管理操作审计日志。

建议活动业务/后端负责人通过受控的活动管理流程核对并补齐该期奖品的规则参数，再验证领取。不要直接对数据库执行更新；本次未做修复或重试。

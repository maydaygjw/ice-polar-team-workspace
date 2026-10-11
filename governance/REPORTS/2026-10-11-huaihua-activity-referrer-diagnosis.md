# 怀化学院抽奖测试推荐人缺失诊断

诊断时间：2026-10-11 20:25（Asia/Shanghai）。仅执行生产只读诊断，未修改生产数据、配置或制品。

## 实际环境与版本

生产 Nginx 的 `yshop-api.holuntech.cn`、`yshop-api.holuntech.com` 均代理到本机 8888；H5 对应域名均代理到本机 5175。后端为 `yshop-server` 容器，从运行 PID 2113729 的 `/proc/2113729/root/opt/yshop/app.jar` 读取制品：

- commit：`f5dc06a27cdf2c119b3e1631b41da5124a03a049`
- SHA-256：`f4866c08eb8187b36f73e34dce8883c1f56f67ebcc81fd2f1fcb16dfa7bd927b`
- 实际 ActivityShareAppController 字节码包含 `&referrer_user_Id=`，不含另外两种旧拼写。
- 生产 .com/.cn H5 的 `ActivityView-_vra4jkP.js` 仅读取 `query.referrer_user_Id`；该读取规则与现有小程序传给 H5 的 `referrerUserId` 不一致。

数据库连接从运行制品的 prod 配置及容器环境覆盖解析；查询在只读一致性事务中执行并回滚，SSH 转发已关闭。

## 期次与证据

租户 154，活动模板 3「怀化学院抽奖测试」，商圈 10；2026-10-11 期次 ID 44，抽奖模式，报名开放，报名时间 20:00—22:00。共有两条有效报名，推荐人均为空。

生产网关 `/var/log/nginx/yshop-dev.access.log`（该文件名不能用于推断环境）的时间线：

| 时间 | 请求/记录 |
|---|---|
| 20:21:44 | H5 入口含 templateId=3 和 ticket，无推荐人参数 |
| 20:21:48 | POST /app-api/activity/registration/create?periodId=44，无推荐人参数；报名 1391，会员 332864 |
| 20:21:59 | GET /app-api/activity/share/short-link?templateId=3 |
| 20:22:21 | H5 入口含 templateId=3、referrerUserId=332864、ticket；不含 referrer_user_Id |
| 20:22:26 | POST /app-api/activity/registration/create?periodId=44，无推荐人参数；报名 1392，会员 332847 |

不记录 ticket 原文、完整认证信息或个人联系信息。

## 结论与处理建议

已证实：进入 H5 时使用原有参数 `referrerUserId`，但近期更新后的 H5 错误地只解析 `referrer_user_Id`，导致报名请求未携带 API 参数 `referrerUserId`，数据库因而保存 NULL。根因是更改了 H5 接收参数，而用户确认小程序的既有入参不应更改。当前后端运行版本已生成正确的短链接参数 `referrer_user_Id`；应保留其 pageUrl 规则，同时恢复 H5 对小程序传入 `referrerUserId` 的读取。

待确认：是哪一段小程序/入口跳转代码生成 camelCase H5 参数，是否使用旧分享入口。分享目标为 `hlmall/pages/index/index`；当前 workspace 的 miniapp 不包含该页面，不能据此定位饭火轮小程序中的具体代码行。

修正方案：小程序到 H5 的现有 `referrerUserId` 接收契约保持不变；H5 解析该参数，并向报名 API 传递 `referrerUserId`。小程序短链接内部的 `referrer_user_Id` 参数规则保持独立。H5 恢复后再用新生成短链接检查入口参数、报名请求和新报名记录。

现有报名记录未回填。已有报名记录不会仅因代码修正自动补齐推荐人；历史记录处理需要单独确认业务归属及人工数据修复流程。

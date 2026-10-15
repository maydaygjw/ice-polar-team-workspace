# 活动游戏模式变更报告

## 业务结果

- 活动模板增加游戏模式，可从租户维护的内置游戏配置选择游戏，并设置固定三关奖品。
- 游戏配置复用活动模板表，通过记录类型区分，不新增业务表。
- 报名后可开始或恢复游戏；失败结束并结算上一已通过关奖励，第 1 关失败无奖；通关三关结算第 3 关奖品。中间通关不提前发奖。
- H5 支持游戏入口、继续游戏、服务端关卡挑战答案提交和终局结果；线下奖品只提示联系企业微信客服，没有兑奖按钮。

## 影响仓库

- `backend`：模板/期次模式、游戏配置管理、三关奖品快照、报名进度字段、开始/提交 app-api、终局中奖记录。
- `admin`：活动模板页面增加游戏配置维护、游戏模式选择与三关奖品编辑；开奖后台不对游戏期次执行开奖。
- `h5`：活动进入游戏页面、游戏开始/续玩/提交、中奖与线下兑奖提示。

## 契约与迁移

- 保持现有 `/activity/template` 和 `/activity/period` 接口域；新增模板域下的 `/game-config/*` 路由及用户端 `/game/start`、`/game/submit` 操作。
- 新增 SQL 脚本 `backend/sql/upgrade-2026-10-15-activity-game-mode.sql`，仅扩展现有模板、模板奖品、期次快照、期次奖品和报名表。
- 详细契约见 [contract-changes.md](contract-changes.md)。

## 验证

- Backend `mvn -pl yshop-module-activity/yshop-module-activity-biz -am -DskipTests compile`：通过。
- Admin `pnpm build:prod`：通过；全量 `pnpm ts:check` 仍报仓库其他文件的既有类型错误，本次涉及文件未命中报错。
- H5 `pnpm build`：通过。
- 三个 worktree `git diff --check`：通过。
- 未运行测试套件、数据库迁移或浏览器端到端验证。详见 [test-notes.md](test-notes.md)。
- 三个功能分支已提交并推送；测试部署尚未触发，等待测试数据库执行本功能迁移。

## 残余风险

- H5 跳跃画布操作仍在浏览器运行；服务端校验数字挑战答案和游戏状态，不校验 Canvas 物理过程。兑奖业务若要求验证跳跃操作本身，需要后续增加服务端可复核凭据。
- 迁移脚本尚未在目标数据库执行，需在部署前验证字段与唯一索引兼容性。

## 建议 PR 标题

`feat(activity): add three-level game mode`

# 变更报告：活动模板中奖策略

## 业务结果

- 活动模板新增公平、偏向新用户、偏向流失和低频用户三种中奖策略；适用于统一开奖和即时抽奖。偏向策略使用 2 倍画像阶段权重，缺失画像按公平权重处理，不保证中奖。
- 新增可扩展 `ActivityWinningStrategy` Spring Bean 接口与注册表。策略代码随期次生成固定快照；游戏模式保持公平默认。
- 追加 `RETENTION_REACTIVATION_TIERS` 阶段策略：流失中 3.0、低频 2.0、新用户 1.2、中频 0.7、高频 0.3；已流失暂按公平权重。该排序是实验起点，未声称已有 ROI 验证。
- Admin 活动模板编辑器新增可视化策略选择；旧模板默认公平。

## 影响仓库

- `backend`：模板/期次字段、策略实现与抽样逻辑、数据库迁移和测试。
- `admin`：模板 API 类型与编辑表单。
- `governance`：需求、设计、契约、审查、交付记录及 OpenAPI 静态快照。

## 契约与迁移

- 管理 API 创建/更新/响应增加 `winningStrategy`；即时抽奖用户请求契约不变。
- `sql/migrations/V2026103001__activity_winning_strategy.sql` 为模板与期次快照表增加 `winning_strategy VARCHAR(64) NOT NULL DEFAULT 'FAIR'`。
- OpenAPI 快照已更新至 `governance/CONTRACT/backend-api.json`。

## 验证结果

- `mvn -pl yshop-module-activity/yshop-module-activity-biz -am test`：通过，59 项测试。
- `mvn verify -Popenapi -DskipTests`：通过，生成快照；为 worktree 暂时跳过 Git 元数据插件后执行，pom 配置已恢复。
- Admin `pnpm build:prod`：通过。
- Admin `pnpm ts:check`：全仓失败，仓库级全局声明/类型错误；本次修改文件无报错，详见 `test-notes.md`。
- `git diff --check`（workspace、backend worktree、admin worktree）：通过。

## 残余风险

- Admin 全仓类型检查基线需要独立修复。未执行跨服务 E2E。

## 建议 PR

标题：`feat(activity): 支持活动模板画像中奖策略`

描述：新增活动模板可配置画像中奖策略，支持公平、偏向新用户、偏向流失和低频用户、留存唤醒分层；开奖及即时抽奖按服务端画像阶段加权，并将策略快照到活动期次。backend 测试、Admin 生产构建通过，Admin 全仓类型检查仍受已有全局类型错误阻塞。

# 活动游戏规则说明契约

## 管理端接口

- `GET /activity/template/game-config/page` 的每条游戏配置增加 `ruleDescription`，类型为 HTML 字符串；未填写时返回空字符串。
- `POST /activity/template/game-config/create` 和 `PUT /activity/template/game-config/update` 接受可选的 `ruleDescription` 字段。创建时缺省或空值按空字符串保存；更新时缺省表示保留原值，显式空字符串用于清空。
- 用户端 `GET /app-api/activity/period/detail` 和 `GET /app-api/activity/period/latest` 增加 `gameRuleDescription`，按期次快照中的 `gameId` 实时读取所属游戏配置规则，未填写时返回空字符串。
- 规则说明仅属于游戏配置，不写入活动模板或期次快照；旧期次按其快照中的游戏配置读取规则。

## 存储

- `yshop_activity_game_config.rule_description` 使用 `MEDIUMTEXT` 保存富文本 HTML；应用层对未设置的历史值按空字符串返回。
- 新增 Flyway 增量迁移，不修改既有基线或已发布迁移。

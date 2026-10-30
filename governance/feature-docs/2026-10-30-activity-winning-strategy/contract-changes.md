# 契约变更：活动模板中奖策略

## 管理端 API

活动模板创建/更新请求、详情和分页响应增加可选 `winningStrategy` 字符串：

| 值 | 含义 |
|---|---|
| `FAIR` | 公平开奖，所有阶段权重 1.0 |
| `PREFER_NEW_USERS` | 新用户（`new`）权重 2.0 |
| `PREFER_AT_RISK_AND_LOW_FREQUENCY` | 低频（`low_frequency`）、流失中（`at_risk`）及已流失（`churned`）用户权重 2.0 |
| `RETENTION_REACTIVATION_TIERS` | `at_risk=3.0`、`low_frequency=2.0`、`new=1.2`、`mid_frequency=0.7`、`high_frequency=0.3`；`churned` 按 1.0 |

未传时按 `FAIR` 保存。仅开奖（`drawMode=1`）和抽奖（`drawMode=2`）允许偏向策略；游戏模式策略固定为 `FAIR`。模板接口路径、权限及通用响应不变。错误策略值返回既有活动模板参数校验错误。

用户端即时抽奖请求与响应结构不变。获奖概率由服务端从期次快照读取策略，并按当前租户的会员画像阶段计算；客户端不得指定策略、画像阶段或权重。

## 数据库

新增 Flyway 脚本在以下表添加字段：

| 表 | 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|---|
| `yshop_activity_template` | `winning_strategy` | `VARCHAR(64) NOT NULL` | `FAIR` | 模板中奖策略 |
| `yshop_activity_period_snapshot` | `winning_strategy` | `VARCHAR(64) NOT NULL` | `FAIR` | 期次创建时的策略快照 |

迁移只新增字段并由默认值填充现有记录。应用回滚时保留字段；删除字段将丢失配置，需后续单独评估并发布向前迁移。

## 阶段读取与概率语义

- Activity 通过既有 `yshop-module-member-api` 的 `MemberUserApi.getUserStages` 批量读取；查询仍按当前租户和内部会员 ID 关联。
- 未找到画像、阶段为空或阶段编码未知均视为权重 1.0。
- 统一开奖：报名的每次抽奖机会为一个抽样项，项权重为该会员阶段权重；不放回抽取。
- 即时抽奖：以未中奖权重 1.0 和奖品原始概率乘阶段权重后重新归一化，奖品间原有概率比例不变。目标阶段 2.0 倍表示相对未中奖结果的赔率加倍，不等于中奖概率直接乘二。
- 中奖次数、库存、单人中奖限制、请求幂等、中奖记录和兑奖流程沿用现有契约。

## 权限、数据范围与依赖

无权限变化。模板 API 沿用现有模板权限；画像读取复用当前租户内既有 API。无新增 Maven、npm、外部系统或 MQ 依赖。

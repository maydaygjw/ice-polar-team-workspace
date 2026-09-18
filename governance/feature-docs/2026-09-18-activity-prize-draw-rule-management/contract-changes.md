# 活动奖品与开奖规则管理契约变更

## Admin API

统一前缀 `/admin-api/activity`，响应沿用 `CommonResult`/分页响应，所有接口要求登录、活动权限和租户隔离。

| 方法 | 路径 | 说明 | 权限 |
|---|---|---|---|
| GET | `/prize/page` | 分页查询当前租户奖品及引用数 | `activity:prize:query` |
| GET | `/prize/get?id={id}` | 查询奖品详情、开奖规则和 KV 参数 | `activity:prize:query` |
| POST | `/prize/create` | 创建奖品并绑定开奖规则及参数 | `activity:prize:create` |
| PUT | `/prize/update` | 修改奖品展示信息、参数、状态和排序 | `activity:prize:update` |
| DELETE | `/prize/delete?id={id}` | 删除未被模板引用的奖品 | `activity:prize:delete` |
| GET | `/draw-rule/list` | 查询后端注册的开奖规则元数据 | `activity:draw-rule:query` |

奖品创建/更新请求：

```json
{
  "id": 1001,
  "name": "本周积分奖励",
  "image": "https://oss.example/prize.png",
  "claimInstruction": "积分将在开奖后到账",
  "drawRuleType": "POINTS",
  "drawRuleParams": {"amount": 100},
  "enabled": true,
  "sort": 10
}
```

奖品响应除上述字段外返回 `drawRuleName`、`drawRuleDescription`、`drawRuleVersion`、`templateReferenceCount` 和 `ruleAvailable`。参数对象只能是 JSON object；服务端按规则拒绝未知危险键、非法类型、负数和超范围值。

开奖规则响应：

```json
{
  "type": "POINTS",
  "name": "加积分",
  "description": "向中奖用户增加积分",
  "version": 1,
  "params": [{"key": "amount", "label": "积分数量", "valueType": "INTEGER", "required": true, "min": 1}],
  "enabled": true
}
```

## Template API change

模板创建/更新的 `prizes` 从旧的内嵌奖品对象改为：

```json
[
  {"prizeId": 1001, "quantity": 10, "sort": 1},
  {"prizeId": 1002, "quantity": 5, "sort": 2}
]
```

模板详情返回的每项包含 `prizeId`、`quantity`、`sort`，以及只读展示字段 `prizeName`、`image`、`claimInstruction`、`drawRuleType`、`drawRuleName`、`drawRuleParams`。请求端不得提交或覆盖规则参数；后端以奖品库为准。

旧请求不转换；旧模板继续使用原有奖品字段，新管理端只对新配置发送 `prizeId`。已生成期次的详情继续返回快照字段，不依赖模板实时数据。

## Period and winner API additions

期次奖品响应增加：`sourcePrizeId`、`drawRuleType`、`drawRuleName`、`drawRuleParams`、`drawRuleVersion`。开奖结果不因奖品库后续修改而变化。

中奖记录本期不增加奖励发放状态字段，不提供奖励发放记录查询或重试接口。开奖规则快照仅表示中奖奖品配置，不代表积分、余额或其他奖励已发放。

## Database contract

- 新增 `yshop_activity_prize`、`yshop_activity_template_prize`。
- `yshop_activity_period_prize` 新增规则快照字段；新增索引 `idx_period_rule(tenant_id, period_id, deleted)`。
- 所有新表包含租户字段、逻辑删除字段和通用审计字段；不使用数据库级外键。
- `yshop_activity_template.prize_config` 不迁移、不转换、不删除；已有模板继续按原字段读取和编辑，新奖品库只服务于新配置。

## Rule registry contract

backend 内部注册接口：

```java
interface DrawRuleHandler {
    String type();
    DrawRuleMetadata metadata();
    void validate(Map<String, Object> params);
    void execute(DrawRewardContext context, Map<String, Object> params, String idempotencyKey);
}
```

首期只注册 `POINTS`、`BALANCE` 的空壳类和元数据；空壳 handler 不执行积分/余额变更，也不调用发放服务。自定义开奖规则必须以代码策略注册，禁止通过 API 提交脚本、表达式、类名、URL 或 SQL。

## Error semantics

- 奖品不存在、跨租户、已删除、未启用或规则不可用：按资源/业务校验错误返回。
- 奖品已被模板引用时删除：返回明确的“奖品已被活动模板使用”错误，不产生部分删除。
- 规则参数不合法：返回字段级参数错误，保留管理端输入。
- 本期不提供奖励发放和重试接口；开奖完成不应返回“已到账”等成功语义。

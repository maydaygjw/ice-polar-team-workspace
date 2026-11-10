# 契约变更

## 管理端 HTTP API

### 分账收款人店铺字段

- `POST /admin-api/pay/profit-recipient/create` 的店铺级请求仍接受 `shopId`，仅用于生成 AdaPay Member ID 的本地编号空间；此字段不代表已绑定店铺，也不写入收款人表。实际绑定由门店主/非主收款人绑定接口维护。
- `PUT /admin-api/pay/profit-recipient/update` 不接受或修改店铺归属；店铺关联通过门店绑定接口维护。
- `GET /admin-api/pay/profit-recipient/page` 保留可选 `shopId` 筛选，按当前租户有效绑定历史匹配收款人。
- 收款人响应以 `shopIds` 和 `shopNames` 返回当前有效绑定的店铺集合；不再返回单值 `shopId` / `shopName`。

### 查询店铺收款人绑定

`GET /admin-api/store/shop/profit-recipient-bindings?shopId={shopId}`

- 权限：`store:shop:query`，遵守当前用户的店铺数据范围和租户隔离。
- 返回主收款人、分账启用状态及非主绑定列表。列表包含 `recipientId`、名称、脱敏 Member ID、关系有效/无效标记和更新时间。
- 全局收款人启用状态和店铺关系标记分开展示。

### 保存店铺收款人绑定

`PUT /admin-api/store/shop/profit-recipient-bindings`

- 权限：`store:shop:update`。
- 单次事务保存主收款人与非主收款人绑定，避免主字段和次级列表部分保存。
- 请求：

```json
{
  "shopId": 123,
  "primaryRecipientId": 456,
  "profitSharingEnabled": true,
  "reconciliationRecipients": [
    { "recipientId": 789, "markStatus": "VALID" },
    { "recipientId": 790, "markStatus": "INVALID" }
  ]
}
```

- `primaryRecipientId` 可为空；启用分账时仍必须选择已启用的店铺级主收款人。
- 分账开关关闭但保留 `primaryRecipientId` 时，主关系仍参与订单结算同步匹配；开关关闭只禁止本系统新发起分账，不清除收款人绑定。
- `reconciliationRecipients` 是该店铺当前非主绑定的完整集合；空数组表示解绑所有当前非主关系。每个 ID 在数组中必须唯一。
- 非主收款人必须属于当前租户且为店铺级收款人；非主绑定不要求其全局状态为启用，因为该关系只用于记录和结算匹配。
- `markStatus` 仅接受 `VALID` / `INVALID`。修改标记不改变是否参与订单结算管理同步匹配。
- 原 `PUT /admin-api/store/shop/bind-profit-recipient` 保留并继续只维护主收款人，兼容旧管理端调用。

### 订单结算管理同步分账状态

现有 `POST /admin-api/pay/profit-sharing-order/sync-settlement-status?orderId={orderId}` 路由、权限、请求和响应保持不变，语义补充如下：

- 远端确认明细通过完整 Member ID 与该订单店铺关联的主收款人和非主收款人进行匹配。
- 非主关系 `markStatus=VALID` 或 `INVALID` 均参与匹配；匹配不依赖脱敏值，也不发起新的资金操作。
- 有且仅有一个本地收款人匹配时，远端导入的明细关联该收款人；未匹配或多重匹配时不错误关联，标记为未映射/待核查。
- 对已有本地分账记录，远端返回完整 `div_members` 时按远端数据在单一事务内替换本地分账明细，并同步状态和手续费；远端明细缺失时保留已有明细，仅同步状态和手续费。拼单中已回退到本地 Revenue 的支付级明细保留。

## 应收应付订单级结算对账

应收应付明细接口沿用现有响应字段，不增加 API schema。`parties` 中店铺收入主体仍保留生成时的店铺分账收款人快照；该 `recipientId` 只说明本系统生成应收时计划使用的出账收款人，不作为远端结算明细与店铺收入匹配的键。

- `subject_type=MERCHANT` 的应收金额作为本订单店铺收入预期，与同订单所有已映射店铺绑定收款人对应的 `role=SHOP` 实际分账金额合计比较，并据此计算订单 `reconciliation_status`。
- 实际店铺分账明细仍按绑定收款人和完整 Member ID 逐笔映射、逐收款人展示，不改写或合并明细的 `recipientId`、Member ID、名称或金额。只有店铺收入总额比较使用其合计。
- 平台、配送、固定及其他收款主体不并入店铺收入；继续按原主体类别和本地收款人 ID 独立比较。未映射的远端收款人不猜测为店铺收入。
- 该比较只使用当前租户和订单范围内已有的应收快照、店铺绑定关系和本地分账明细，不请求 AdaPay，不改变历史应收应付或分账事实。

## 内部模块 API

- 扩展 `ProfitRecipientBindingHistoryApi`，支持按店铺批量记录/替换非主收款人关系及有效/无效标记，并保留历史版本。
- pay-biz 内部增加按 `tenantId + shopId + memberId` 查询绑定历史的能力，供远端同步导入匹配使用；无 HTTP 暴露。
- `ProfitRecipientApi.listByShop(shopId)` 保持只返回主收款人，避免现有计费/分账调用方收到次级收款人。

## 数据库变更

扩展 `yshop_adapay_profit_recipient_binding_history`：

| 字段 | 类型 | 语义 |
|---|---|---|
| `binding_purpose` | `TINYINT NOT NULL DEFAULT 1` | `1=PRIMARY`，`2=RECONCILIATION`。既有记录默认主收款人。 |
| `mark_status` | `TINYINT NOT NULL DEFAULT 1` | `1=VALID`，`0=INVALID`；只记录非主关系标记，不作为同步匹配过滤条件。 |

新增复合索引覆盖 `(tenant_id, shop_id, binding_purpose, member_id, relation_status, deleted)` 查询。既有 `relation_status`、`valid_from`、`valid_to` 继续表达关系版本生命周期；状态切换通过关旧版本、建新版本保留审计记录。

拟新增 Flyway 迁移：`backend/sql/migrations/V2026110906__shop_profit_recipient_binding_purpose.sql`。当前最高迁移版本为 `V2026110905`；实现时须再次核对目录，以免与并行迁移冲突。数据库仍由独立 `db-migrator` 执行，应用启动不自动迁库。

### 数据迁移与回滚

- 既有历史行回填 `binding_purpose=1`、`mark_status=1`，不更改关系状态、有效区间或快照。
- 当前店铺主收款人字段继续作为实时主绑定来源；迁移不创建 AdaPay Member，也不调用 AdaPay。
- 回滚采用应用侧关闭次级绑定读写和回退旧接口；新增列与已写历史保留。若必须移除新增列，须确认没有次级记录依赖后单独评估数据备份，不在常规回滚中删除历史。

## 收款人表移除单店字段

- 从 `yshop_adapay_profit_recipient` 移除 `shop_id` 与依赖该单店关系的 `shop_name`；收款人实体不再拥有唯一店铺归属字段。
- 当前主绑定仍由 `yshop_store_shop.profit_sharing_recipient_id` 保存；主绑定、非主对账绑定和关系历史统一以 `yshop_adapay_profit_recipient_binding_history` 的 `tenant_id + shop_id + recipient_id` 表达。
- 新增前向迁移在删除字段前补齐店铺表当前主收款人指向的有效主绑定历史；旧收款人 `shop_id` 与当前主绑定不一致时只写入已关闭的迁移审计记录，不推断为当前有效绑定。迁移保留租户、店铺、收款人、Member ID、结算账户和时间快照，不覆盖有效关系。
- 同一收款人可在同一生效时间绑定多个店铺，因此绑定历史唯一键调整为包含 `shop_id` 与 `binding_purpose`；结算账户版本和店铺/用途共同确定关系唯一性。
- 收款人分页/详情响应从关系历史批量汇总 `shopIds` / `shopNames`。店铺筛选、绑定验证、同步刷新和管理端展示均不得再读取收款人表单店字段。
- 使用 `V2026110907__remove_profit_recipient_shop_fields.sql` Flyway 前向迁移删除字段；不修改已发布迁移或基线 SQL。已完成订单、分账、应收应付和结算事实保持不变。

## 权限、隔离与兼容

- 管理端沿用 `store:shop:query` / `store:shop:update`，检查请求店铺和收款人都属于当前租户，并执行当前用户店铺范围校验。
- 订单结算同步沿用 `order:settlement:query`，只访问当前租户的订单、绑定历史和 AdaPay 配置。
- 不新增角色、权限菜单或小程序 API。
- AdaPay SDK、外部请求参数和回调契约无变更；只调整远端 `div_members` 在本地的映射规则。
- `recipientId` 在所有本地分账及应收应付快照中仍表示主收款人；非主 ID 仅出现在店铺绑定历史及结算同步映射中。

## 不变更项

- 日终对账外部账单结构与来源渠道判断：N/A，AdaPay Div 不提供渠道字段。
- 应收应付 API schema 不变；继续读取生成时的主收款人快照，并按本文件“应收应付订单级结算对账”规则比较店铺收入与远端实际分账。
- C 端支付 API、DMS API、MQ、Maven 依赖：N/A。

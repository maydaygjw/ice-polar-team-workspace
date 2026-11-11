# 跨模块接口契约索引

## 分账收款人结算中的平台商户

- 收款人结算任务目标按收款人、Member ID 和结算账户区分；同一目标绑定多个店铺时只向 AdaPay 查询一次。详见[分账收款人结算契约](feature-docs/2026-08-21-profit-recipient-settlement/contract-changes.md#任务收款人结果表)。
- 汇总响应为店铺级收款人增加 `shopNames`，返回其当前绑定的全部可访问店铺名称；`shopName` 仍是汇总行对应的历史店铺快照。非店铺级主体的 `shopNames` 为空。详见[分账收款人结算契约](feature-docs/2026-08-21-profit-recipient-settlement/contract-changes.md#汇总查询)。
- 店铺筛选除匹配结算快照中的店铺外，也匹配当前绑定到所选店铺的店铺级收款人；同一收款人/结算账户的采集流水只保存一份代表绑定快照，因此通过绑定关系命中时仍显示该快照店铺，不重复计入结算金额。结果继续受当前用户可访问店铺范围限制。
- 分账收款人结算汇总响应增加 `memberIdLast4`，取本地结算明细快照中 MemberId 的后四位；管理后台在收款人名称下展示为 `****后四位`，接口不返回完整 MemberId。详见[分账收款人结算契约](feature-docs/2026-08-21-profit-recipient-settlement/contract-changes.md#汇总查询)。
- 分账收款人结算汇总/明细查询新增 `MERCHANT` Tab，展示当前租户 AdaPay 商户自身的结算流水；只接受日期范围和汇总方式筛选，查询通过 `SettleAccount.detail` 固定传 `member_id=0`，不传 `settle_account_id`。
- 每日采集和手工单日重拉除当前/历史分账收款人外，均增加一个商户自身采集目标。其本地快照使用 `recipient_type=3`、`recipient_id=0`、名称「平台商户」，不关联角色、店铺或绑定关系；与收款人及租户数据隔离。
- 已完成的历史采集任务不会自动回填该主体；需对目标日期手动重拉。详细字段和筛选规则见[分账收款人结算契约](feature-docs/2026-08-21-profit-recipient-settlement/contract-changes.md)。

## 分账结算记录预计打款日期

- 分账结算记录列表及详情响应增加只读 `estimatedPaymentDate`，由成功分账记录的 `sharingTime` 按当前结算策略推算，不新增数据库字段。
- 当前策略为 T+1：从 `sharingTime` 的上海本地日期推一天，若预计日为休息日则顺延至工作日。工作日判断按中国调休日历，包含节假日休息日和调休补班日。
- 日期推算由策略接口实现，结算模式通过配置选择；D+1 策略按下一个自然日计算，后续可切换配置。无 `sharingTime` 时响应 `null`。
- 中国工作日日历存储在全局参考表 `yshop_pay_settlement_calendar_day`，已初始化 2025—2027 年放假和补班日期；新年度安排发布后通过数据库迁移补充。
- 详见[分账结算记录预计打款日期契约](feature-docs/2026-07-13-adapay-profit-sharing/contract-changes.md#预计打款日期)。

## 店铺收入报表日期与打款金额核对

- 店铺收入报表汇总按日期、店铺、收款人返回多行；本地同步只纳入店铺主收款人及有效对账收款人的结算明细，无效对账关系不纳入。同一收款人、Member ID 和结算账户绑定多家店铺时，完整净到账金额展示在每家当前有效绑定店铺并标注「(共享)」；该金额跨店重复展示、不按店铺拆分，且不参与单店金额核对。店铺级订单及预测指标只放在主收款人行；核对只比较非共享实际到账总额。收款人 MemberId 与银行卡仅返回后四位。详见[店铺收入报表契约](feature-docs/2026-11-09-store-income-report-sync/contract-changes.md#汇总分页)。
- 店铺收入报表汇总响应新增 `nonWorkingDayLabel`：按中国结算日历标记非工作日，法定节假日返回假期名称，普通周末返回「周末」，调休补班日及普通工作日返回 `null`。该字段仅用于展示，不改变各指标日期归属。
- 管理后台新增打款金额核对列，逐日比较 `estimatedPaymentIncome` 与 `storePaymentAmount` 的分值；`storePaymentAmount` 不计入多店共享到账，避免共享金额造成重复核对。相等显示一致图标，不等显示不一致图标。两项均为 0 时按相等处理。
- 汇总分页支持 `periodType=DAY|WEEK|MONTH`，默认 `DAY`；周按完整自然周（周一至周日）、月按完整自然月聚合。周/月视图日期筛选两端包含，命中的首尾周期均扩展为完整周期后查询，不因店铺个别日期无数据而截短周期；`settlementDate` 和 `periodEndDate` 分别返回周期首日和末日。
- 明细分页继续兼容单日 `settlementDate`；周/月汇总行可传 `settlementDateStart` 和 `settlementDateEnd` 查询周期内明细。
- 管理后台新增综合费率列，按聚合后的 `incomeAmount / orderAmount` 计算；订单金额为 0 时显示 `—`。费率不新增接口字段。
- 详见[店铺收入报表契约](feature-docs/2026-11-09-store-income-report-sync/contract-changes.md#汇总分页)。
- 汇总分页新增可选 `shopIds` 多店铺筛选，传入时只返回所选店铺；该条件与当前用户可访问店铺范围取交集。省略或传空集合表示不按所选店铺过滤，原 `shopId` 单店参数继续兼容。

## AdaPay 对账单管理

- 管理后台新增“对账单管理”页面，按当前租户、按账单日期手动下载 AdaPay 标准账单 ZIP；不提供自动下载，也不执行订单或分账业务对账。
- 每次下载形成独立 ZIP 版本并保存到主 OSS；`Charge`、`PaymentConfirm`、`Div` 三个 CSV 不单独归档，只从 ZIP 解析后写入三张原始明细节表。
- 同一租户同一天只允许一个下载任务。成功重拉时在同一事务中物理删除旧明细并写入新明细；任一步失败保留旧明细和上次成功 ZIP 版本。日期状态由 `GET /admin-api/pay/adapay-bill/calendar` 返回，优先级为 `RUNNING > SUCCEEDED > FAILED > NONE`。
- 明细按最新成功版本分页展示解析字段，并在 `extraFields` 返回未知尾部列；Div 明细支持 `memberId` 对“分账用户”字段精确筛选。
- PaymentConfirm 增加应收应付批量匹配：按账单日期、最多 100 家店铺范围，以 Confirm `paymentId` 关联当前租户应收应付的 `payment_id`；应收应付 `payment_id` 来自商城订单 `transaction_id`，生成时保存并回填历史值。结果持久化为 `MATCHED`（成功）或 `MISSING`（缺失），空值表示未匹配。分页支持按此状态筛选；重新拉取账单后新明细均为未匹配。
- 新增权限 `pay:adapay-bill:query` 和 `pay:adapay-bill:download`；所有接口按当前租户隔离。详见 [AdaPay 对账单管理契约](feature-docs/2026-11-11-adapay-bill-management/contract-changes.md)。

## 后台订单详情费用字段

- `/admin-api/order/store-order/get` 与 `/admin-api/order/store-order/getInfo` 响应包含 `platformSubsidyAmount`（平台补贴金额），并新增 `boxFeeForPlatform`（平台餐盒费抽成）和 `serviceFee`（订单服务费）；后两个字段暂不由业务流程赋值，数据库默认 `0.00`。原 `boxFeePrice` 仍表示餐盒费。详见[后台订单详情费用字段契约](feature-docs/2026-11-07-order-detail-fee-fields/contract-changes.md)。

## 订单应收应付可计算金额

- 商城订单可计算金额 = 券前金额 - 优惠金额；平台补贴作为订单计费属性参与明细分配，但不增加整单可分配上限。详见[订单计费模板与应收应付契约](feature-docs/2026-08-14-order-billing-template/contract-changes.md)。
- 订单计费快照中的 `transactionId` 取自订单表 `transaction_id`；生成应收应付时将其保存到 `yshop_pay_receivable_payable_order.payment_id`，供 AdaPay PaymentConfirm 匹配。
- 计费模板明细收款类型支持 `CURRENT_MERCHANT`（当前商家）、`FIXED`（指定分账收款人）和 `PLATFORM`（AdaPay 平台）。`PLATFORM` 仅作收款目标标记，不关联分账收款人记录；模板及应收应付明细的 `recipientId` 为空，执行 AdaPay 分账时直接使用 `memberId=0`。

## 外卖订单应收应付状态与手工生成

- `GET /admin-api/order/store-order/page` 每条订单响应增加 `receivablePayableGenerated`：直接读取订单表冗余标记；仅 `SUCCESS` / `SUCCESS_WITH_DIFFERENCE` 应收应付记录置为 `true`，无记录或 `FAILED` 置为 `false`。列表不得为该字段联查应收应付表。
- `POST /admin-api/order/store-order/generate-receivable-payable?id={storeOrderId}` 使用 `order:store-order:update` 权限。仅当前租户下已支付、未退款、外卖类型且订单状态为 `2`（待评价）或 `3`（已完成）的未生成订单可触发；若已有成功应收应付则不重算。失败记录允许按现有幂等计费逻辑重试，响应 `true` 表示本次生成成功，`false` 表示不符合条件、已生成或生成未成功。
- `POST /admin-api/order/store-order/generate-receivable-payable/batch` 使用 `order:store-order:update` 权限，请求体为 `{ "ids": [storeOrderId, ...] }`，最大 100 个 ID。服务端逐单复用单笔生成校验和幂等逻辑，仅处理当前租户下已支付、未退款、外卖类型、状态为 `2/3` 且尚未成功生成的订单；重复、越权、不符合条件或生成失败的订单均不生成。响应包含 `totalCount`、`successCount` 和逐 ID 结果（`generated` 布尔值），允许部分成功。
- 管理端外卖订单列表展示应收应付生成状态；只有状态 `2/3` 且尚未成功生成的订单，在“更多”菜单显示“生成应收应付”。
- 订单模块内部 `OrderApi` 按租户和订单号更新该冗余标记；pay 计费成功时置为 `true`，失败时置为 `false`。数据库迁移为订单表新增默认 `false` 的字段，并按租户/订单号回填历史成功记录。

## 订单计费项表达式

- 计费项 `billingType` 支持 `ORDER_PERCENTAGE`（订单比例）、`ORDER_ATTRIBUTE`（单一订单金额属性）和 `ORDER_EXPRESSION`（订单属性表达式）。表达式保存在计费项 `orderExpression` 字段，仅允许受控订单金额属性、十进制数字、括号及 `+ - * /` 运算符；属性名为标识符（如 `pay_postage`），不支持函数或任意代码。运算遵循常规优先级和括号，除零或属性值为空时计费失败。表达式结果作为该明细的理论金额，并按两位小数四舍五入；既有订单结算快照不回算。

## 订单应收应付每日补算

- 订单模块内部 API 增加通用按订单状态查询订单号的能力，状态和退款状态集合均使用 `OrderInfoEnum`，支持可选支付状态和主键游标分页；接口不暴露 HTTP 路由。计费任务传入 `OrderInfoEnum.STATUS_2`、`paid=1`、`refundStatuses=[REFUND_STATUS_0,REFUND_STATUS_3]`。
- 支付计费模块每日扫描候选订单，仅对没有应收应付主记录或状态为 `FAILED` 的记录执行计算；失败记录允许后续日任务重试。订单状态流转不再同步调用计费模块。
- 详见[订单应收应付每日补算契约](feature-docs/2026-11-06-daily-order-billing/contract-changes.md)。

## 按日期和店铺批量生成应收应付

- 应收应付管理页提供独立的批量生成入口，按单个支付日期及 1–100 个店铺筛选本地订单；仅处理当前租户下订单表 `receivable_payable_generated=false`、已支付、未退款或退款已拒绝、状态为待评价/已完成的订单。该订单表标志是唯一生成资格标记，已为 `true` 的订单必须跳过。
- `POST /admin-api/pay/receivable-payable/generation-tasks` 使用 `pay:receivable-payable:generate` 权限，接收 `{ "payDate": "YYYY-MM-DD", "shopIds": [1, ...] }` 并快速返回任务 ID。生成在后台逐单执行，任务进度持久化；`GET /admin-api/pay/receivable-payable/generation-tasks/{id}` 仅允许创建任务的当前租户/用户读取，返回状态、总数、已处理数、成功数、跳过数、失败数及进度百分比。任务终态为 `SUCCESS`（无失败）或 `COMPLETED_WITH_ERRORS`（存在失败）。
- 一个租户同一时刻最多运行一个此类任务。任务按订单主键游标扫描和现有计费幂等逻辑执行，单笔失败不阻断后续订单。管理端轮询进度，任务运行期间冻结生成表单和页面操作并展示进度；页面刷新后可继续查询该用户未完成的任务。
- 详见[按日期和店铺批量生成应收应付契约](feature-docs/2026-11-10-batch-receivable-payable-generation/contract-changes.md)。

## 订单结算状态远端同步

- 订单结算管理页为 AdaPay 订单提供“同步分账状态”操作；后端按当前租户调用 AdaPay 查询支付确认对象。已有本地分账记录时，读取相关支付确认并同步远端状态、手续费；远端返回完整 `div_members` 时，在单一事务内以远端明细替换本地明细，本地分账主记录及支付级记录保留。拼单中已回退到本地 Revenue 的支付级明细保留，其余支付级明细按各自 AdaPay 确认重建。远端明细缺失时只更新状态和手续费，保留已有明细；查询失败或无有效确认时不改写本地记录。若尚无本地分账记录，则按订单支付流水号查询并导入查询结果。
- 同步只查询远端既有支付确认，不创建或重试分账，响应为页面结算状态（0 未结算、1 待分账、2 分账中、3 已结算、4 分账失败）；确认列表为空时返回 0。远端 Member ID 为 `0` 时分账角色记为“平台”，不据此匹配平台级收款人；其他 Member ID 可按租户和 Member ID 匹配启用的平台级收款人，或按该订单店铺的有效绑定历史匹配店铺级收款人。候选收款人不唯一时不猜测归属。同步读取 AdaPay `div_members[].fee_flag` 更新本地明细 `feeFlag`，并读取支付确认的 `fee_amt` 保存手续费金额；详情将手续费金额显示在承担手续费的明细行。未查询到金额时响应 `null`。非 AdaPay 订单不适用。详见[订单结算管理契约](feature-docs/2026-07-13-order-settlement-management/contract-changes.md)。
- 管理后台可提交一个支付日期和最多 100 家店铺，创建异步分账状态同步任务；任务复用应收应付生成任务表并通过 `task_type` 区分，逐单复用 AdaPay 状态同步规则并持久化进度，页面轮询且刷新后恢复。订单模块仅提供通用的按支付日期、店铺、支付方式、退款状态及主键游标查询已支付订单的 `OrderApi`；Pay 模块传入 AdaPay 支付方式及可选退款状态。结算状态同步只选取退款正常或已驳回（`refund_status` 0、3）的订单，排除退款中或已退款订单；不由订单模块提供结算专用查询，也不由 Pay 模块直接访问订单表。详见[订单结算管理契约](feature-docs/2026-07-13-order-settlement-management/contract-changes.md)。
- `GET /order/store-order/settlement-page` 响应增加 `estimatedPaymentDate`（`date | null`），仅对已成功分账且有 `sharingTime` 的订单，按当前 AdaPay 结算策略推算；详见[订单结算管理契约](feature-docs/2026-07-13-order-settlement-management/contract-changes.md)。

## 订单结算管理商圈筛选

- `GET /admin-api/order/store-order/settlement-page` 新增可选 `businessRegionId`（商圈 ID）查询参数，按应收应付记录保存的商圈快照筛选结算记录；原 `shopId` 店铺筛选继续有效，同时传入时结果需同时满足两个条件。租户隔离以结算记录的租户 ID 为准。
- 管理后台订单结算管理页提供商圈下拉筛选；选择商圈后查询分页接口，清空商圈则恢复全部商圈范围。
- 详细契约见[订单结算管理商圈筛选契约](feature-docs/2026-11-09-order-settlement-business-region/contract-changes.md)。

## 订单结算管理分账日期筛选

- `GET /admin-api/order/store-order/settlement-page` 新增可选 `sharingTimeStart`、`sharingTimeEnd` 查询参数，格式为 `YYYY-MM-DD HH:mm:ss`，按订单关联的最新本地分账记录的实际分账时间筛选；起止时间均包含，未分账记录不因该条件命中。
- 管理后台订单结算管理页提供“分账日期”范围筛选；日期范围默认覆盖所选日期的 `00:00:00` 至 `23:59:59`，与支付时间及其他查询条件同时生效。

## 应收应付订单级结算对账

- `GET /admin-api/pay/receivable-payable/page` 支持可选筛选参数 `businessRegionId`（商圈 ID）和 `shopId`（店铺 ID）；商圈 ID 作为快照冗余保存在应收应付主记录中，订单计费和 OpenAPI 计费保存对应店铺的商圈 ID，历史记录由迁移回填。商圈与店铺筛选均直接匹配应收应付主记录字段，分页列表和总数使用相同条件。
- 应收应付列表记录增加 `reconciliation_status`：`MATCHED`（一致）、`DIFFERENT`（有差异）、`PENDING`（结算未完成或缺少可比较明细）、`NOT_APPLICABLE`（已回退等不适用场景）。仅使用本地应收应付主体快照与本地分账结算记录比较，不在读取列表或明细时请求 AdaPay。店铺收入类应收主体（`subject_type=MERCHANT`）与实际店铺角色分账（`role=SHOP`）按订单店铺收入总额比较，不以应收快照中的店铺收款人 `recipientId` 作为匹配键；该快照仍保留其原分账收款人含义。平台及其他收款主体继续按收款人 ID 独立比较。
- `GET /admin-api/pay/receivable-payable/page` 列表响应增加 `sharing_time`，取该应收应付记录关联的最新本地分账记录的实际分账时间；无分账记录或尚未分账时为 `null`。管理后台应收应付列表以“分账时间”列展示，时间格式为 `YYYY-MM-DD HH:mm:ss`。
- 应收应付明细接口增加 `settlement_items`，仅在结算成功时从本地分账订单明细读取结算主体、角色、收款人、Member ID（脱敏）和金额；`parties` 也返回收款人 Member ID（脱敏）。两张表分别展示本地应收主体汇总与实际分账明细；分账明细优先按 `receivable_payable_party_id` 归属当前应收订单，再按本地收款人 ID 保留收款人级明细，防止拼单支付把其他订单的分账记录并入当前对账。店铺绑定收款人的实际分账仍逐收款人显示；仅用于店铺收入对账时，将该订单 `role=SHOP` 的实际金额合计与 `subject_type=MERCHANT` 的应收金额比较。应收上的收款人 ID 不用于决定店铺收入归属；平台及配送、固定/其他主体等仍按各自收款人 ID 独立比较。Member ID 只用于展示，不以脱敏值作为匹配键。
- 分页查询新增可选 `sharingTimeStart`、`sharingTimeEnd`（`YYYY-MM-DD`）日期参数，按关联的最新本地分账记录 `sharing_time` 筛选；起止日期均包含，无分账时间的记录不匹配日期筛选。分页结果与总数使用相同条件。管理后台店铺下拉支持输入搜索，分账日期使用日期范围筛选。
- 分页查询新增可选 `payTimeStart`、`payTimeEnd`（`YYYY-MM-DD`）日期参数，按本地店铺订单 `pay_time` 或 OpenAPI 支付单 `paid_time` 筛选；起止日期均包含。分页结果与总数使用相同条件。管理后台应收应付页提供支付时间范围筛选。
- 分页查询新增可选 `reconciliationStatus` 筛选参数，支持 `MATCHED`、`DIFFERENT`、`PENDING`、`NOT_APPLICABLE`；按现有订单级对账状态语义筛选，分页结果与总数均在对账状态过滤后计算。管理后台应收应付页提供对账状态下拉筛选。

## AdaPay 分账收款人同步

- `POST /admin-api/pay/profit-recipient/sync` 使用 `pay:profit-recipient:create` 权限，普通 Member 按当前租户 AdaPay 配置及输入的 `memberId` 查询个人或企业 Member，并查询其已有结算账户；只允许关联当前租户 AdaPay 商户下可查到的 Member。
- 创建店铺级收款人请求中的 `shopId` 只用于 Member ID 命名空间，不写入收款人记录或建立店铺绑定；实际绑定在店铺编辑页或同步请求的 `shopIds` 中维护。
- 店铺级同步请求可选传入 `shopIds: Long[]`，只创建或刷新一条本地收款人记录；传入店铺时将同一收款人 ID 写入所选店铺的 `yshop_store_shop.profit_sharing_recipient_id` 和绑定历史，未传店铺时暂不关联店铺。店铺关联只保存在店铺主收款人字段及 `yshop_adapay_profit_recipient_binding_history`，收款人表不再保存单店 `shop_id` / `shop_name`。收款人分页响应以 `shopIds` / `shopNames` 返回当前绑定店铺集合，`shopId` 筛选按绑定关系查询。同步创建的收款人默认禁用、店铺分账保持原状态。门店编辑页可调整绑定，候选项包含当前租户已启用的店铺级收款人及当前店铺已绑定的收款人。平台级同步仍使用单条平台记录，不能提交 `shopIds`。
- 当 `memberId="0"` 时表示当前租户的 AdaPay 平台商户，按平台级“平台”角色同步，跳过 Member/CorpMember 查询。平台商户使用 AdaPay 基本账户，不创建结算账户对象；本地以 Member 类型 `0` 标记平台商户、账户绑定状态标记为已绑定且结算账户 ID 为空。平台商户银行卡详情不从本同步接口读取或保存。
- 店铺级同步以当前租户 `memberId` 查找并复用本地收款人；若传入店铺，则写入相应主绑定与关系历史，不把某个店铺固化到收款人记录。未选择店铺时允许创建未绑定的店铺级收款人，之后可在门店编辑页绑定。每个所选店铺的绑定通过店铺服务写入；不覆盖已有启用中的其他收款人绑定。旧版 `shopId` 单店请求继续兼容。新建收款人默认禁用。普通 Member 没有远端结算账户时保存为未绑定。平台商户同步规则见上项。
- 门店可绑定同一租户下任意店铺级收款人；候选列表包括所有已启用的店铺级收款人及当前门店已关联的收款人。当前主绑定保存在 `yshop_store_shop.profit_sharing_recipient_id`，历史及非主对账关系保存在 `yshop_adapay_profit_recipient_binding_history`；两者均与 `profit_sharing_enabled` 独立维护。启用分账仍要求收款人已启用；更换启用中门店的收款人须从门店编辑页显式操作。
- 同步为幂等操作，不创建或修改 AdaPay Member/结算账户；不返回完整银行卡号或证件号码。结算账户摘要只保存脱敏卡号/姓名、银行及地区信息。
- 个人 Member 缺少姓名或证件字段时，按已查询结算账户 `account_info` 回退；银行名称为空时按 `bank_code` 匹配本地银行字典，号码仅按远端脱敏值保存和展示。详见[分账收款人同步类型选择契约](feature-docs/2026-11-07-adapay-member-type-sync/contract-changes.md)。
- 企业 Member 同步时保存 AdaPay `CorpMember.query` 返回的 `audit_state` / `audit_desc`，在收款人查询响应中返回枚举字段 `memberAuditState` 和说明字段 `memberAuditDesc`，并于管理后台详情展示；个人 Member 和平台商户不设置这两个字段。状态码 `A/B/C/D/E` 分别表示待审核、审核失败、开户失败、开户成功但未创建结算账户、开户和创建结算账户成功；未知码映射为 `UNKNOWN`。保留 AdaPay 返回的原始状态描述。详见[企业 Member 审核状态同步契约](feature-docs/2026-11-09-adapay-corp-audit-state/contract-changes.md)。

## AdaPay 分账收款人信息与结算账户维护

- `PUT /admin-api/pay/profit-recipient/update` 更新本地分账收款人资料。请求只含 `memberInfo` 时更新本地 Member 信息快照，不改绑定的结算账户；请求只含 `settleAccount` 时创建并绑定/更换 AdaPay 结算账户，不改 Member 信息。收款人级别、角色和 Member 类型保持不变；店铺关系由店铺绑定接口维护，不属于收款人资料更新。
- 管理页面将 Member 信息编辑与结算账户绑定/更换作为两个独立操作；完整银行卡信息只在绑定/更换请求中提交，列表与详情仅返回脱敏摘要。
- 结算账户类型 `1` 为个人借记卡，对应 AdaPay `bank_acct_type=2`；必填卡号、户名、手机号及证件号/类型，其中手机号和证件信息从 Member 资料带入，银行代码和开户省市无需填写。类型 `2` 为对公账户，对应 AdaPay `bank_acct_type=1`；卡号、户名、手机号、银行代码及开户省市必填，银行支行可选。

## 后台订单按商圈和店铺筛选

- `GET /admin-api/order/store-order/page` 支持可选 `businessRegionId`、`shopId` 和 `shopIds` 查询参数。`businessRegionId` 通过当前租户有效店铺筛选订单；`shopId` 保持单店兼容；`shopIds` 为店铺 ID 集合，按所选店铺筛选订单。多条件同时传入时取交集，且保留登录用户自身店铺的数据范围限制；空 `shopIds` 不作为筛选条件。
- 管理后台外卖订单列表提供商圈和多选店铺筛选；店铺候选项通过门店分页接口远程查询，并按所选商圈及店铺标签过滤。输入至少 2 个字符后按店铺名称远程搜索，少于 2 个字符不发起名称搜索。切换商圈会清空已选店铺；选择商圈后候选项仅来自该商圈，未选择商圈时可从全部店铺中选择。

## 管理后台订单详情支付流水号

- `GET /admin-api/order/store-order/get?id={id}` 与 `GET /admin-api/order/store-order/getInfo?orderId={orderId}` 的 `data` 响应新增可空字符串字段 `transactionId`，表示订单支付流水号；未记录时为 `null`。
- 字段从订单记录的 `transaction_id` 返回；不改变支付状态、写入行为、权限或租户隔离规则。详见[订单详情支付流水号契约](feature-docs/2026-11-05-order-detail-transaction-id/contract-changes.md)。

## 门店批量标签与标签筛选

- 门店分页查询支持可选 `tagId`，按 `yshop_store_tag_ref` 中存在的门店-标签关联过滤结果。
- `PUT /admin-api/store/shop/batch-tags` 接收 `shopIds` 与 `tagIds`，为所选门店追加标签并保留已有标签；重复标签幂等处理。操作按当前租户及用户可管理门店范围校验。

## OAuth2 客户端凭证授权

- `POST /admin-api/system/oauth2/token` 支持 `grant_type=client_credentials`；客户端通过 HTTP Basic 传递 `client_id` / `client_secret`，可选 `scope` 必须是该客户端登记范围的子集，且客户端须启用该授权类型并处于启用状态。
- 成功响应返回 Bearer `access_token`、`expires_in` 和授权范围，不返回 `refresh_token`。令牌主体类型为 OAuth2 客户端，不代表会员或管理员；客户端凭证不授予 `/app-api` 或 `/admin-api` 的会员/管理员身份。外部业务接口须使用独立 OpenAPI 路由并显式校验 scope。
- 客户端令牌可通过 `DELETE /admin-api/system/oauth2/token?token={access_token}` 撤销；到期后重新申请。客户端密钥仅保存在服务端，调用必须使用 HTTPS。

## 第三方支付 OpenAPI（实现中）

- 第三方业务支付接口使用独立 `/open-api` 前缀，不使用会员 `/app-api` 或后台 `/admin-api` 身份；支持微信 JSAPI 与汇付支付创建、支付查询、全额退款，以及统一使用 `payment` scope 的微信商家转账发起。商家转账复用当前租户已配置的微信小程序商户和转账场景，第三方提交当前租户会员 `userId`，平台读取其小程序 OpenID 并返回用户确认收款所需 `packageInfo`；最终状态由微信回调/查单确认并通过现有 Webhook 通知。OpenAPI 不提供独立转账查询或撤销接口。详细契约见 [第三方支付 OpenAPI Feature Contract](feature-docs/2026-11-02-third-party-payment-openapi/contract-changes.md)。
- 后端 Web MVC 根据 `controller.openapi` 包自动附加 `/open-api` 前缀；OAuth2 客户端表启用标准多租户隔离。客户端在当前租户上下文中创建、查询和认证，申请 token 与调用支付接口均须携带匹配的 `tenant-id` 请求头，令牌固化当前租户。客户端不能跨租户访问。
- OpenAPI 支付统一使用 `payment` scope，创建、查询、退款接口均校验此范围。客户端 scope 以逗号分隔文本维护，不支持通配符；申请 token 时可显式请求已登记的 scope 子集，省略 `scope` 时授予客户端登记的全部 scope。商户支付配置页负责启用租户的 OpenAPI 支付接入并维护 Webhook 地址，不建立 client 到支付配置的绑定表。业务订单和支付结果按租户及 client 隔离。
- 详细 API、状态和通知契约见 [第三方支付 OpenAPI Feature Contract](feature-docs/2026-11-02-third-party-payment-openapi/contract-changes.md)。

- `POST /open-api/v1/payments/transfers` 使用 `payment` scope 向微信 OpenID 发起商家转账；请求含 `openid`、`amount`（人民币分正整数）、租户内唯一 `outBillNo` 和可选 `remark`。后端要求该 OpenID 对应当前租户会员，并复用当前租户微信支付配置及统一用户转账记录。请求未知时使用原 `outBillNo` 重试；接口受理不代表款项到账。详见[第三方用户转账契约](feature-docs/2026-11-07-openapi-user-transfer/contract-changes.md)。

## OpenAPI AdaPay 结算与对账

- [AdaPay 分账收款人同步类型选择](feature-docs/2026-11-07-adapay-member-type-sync/contract-changes.md)：普通 Member 请求必须显式提交个人/企业类型，后端不再从 `member_id` 推断；`member_id=0` 固定表示平台商户并使用 AdaPay 平台商户基本账户。
- [AdaPay 分账收款人本地删除](feature-docs/2026-11-07-adapay-recipient-local-delete/contract-changes.md)：新增仅删除本地收款人记录及本地结算账户快照的操作，不调用 AdaPay 删除接口；保留现有远端删除操作。
- OpenAPI 支付创建请求提交商圈代码；平台按当前租户商圈配置解析专用默认店铺，不接受客户端指定店铺、计费模板或收款人。请求金额全额作为计费基数，无优惠和平台补贴。
- AdaPay 支付成功时，以支付创建时保存的计费上下文快照幂等生成通用应收应付事实；OpenAPI 内部使用 paymentId 关联账务，clientOrderNo 保持为客户端外部订单号，不关联商城订单表。
- 客户端可用 `payment` scope 按自身 clientOrderNo 主动请求 AdaPay 结算；系统每日 00:05 自动任务处理相同待结算队列。主动/自动执行及全额退款互斥；分账处理中或成功时拒绝退款，退款成功后不再结算，退款失败恢复资格。
- 现有 02:00 AdaPay 日终对账增加 OpenAPI AdaPay 支付来源；成功分账沿用 PaymentConfirm/Div 对账。微信账单对账和 AdaPay Refund/RefundDiv 退款对账不在本 feature。
- 详细字段、路由、状态和迁移见 [OpenAPI AdaPay 结算与对账 Feature Contract](feature-docs/2026-11-04-openapi-adapay-settlement/contract-changes.md)。

### AdaPay 对账账单店铺筛选

- `GET /admin-api/pay/adapay-bill/{charge,confirm,div}-details/page` 均可选传入 `shopIds: Long[]`，按明细保存的 `shop_id` 过滤；未传或空数组表示不按店铺筛选。租户隔离和账单日期/版本筛选保持不变。
- 店铺快照仍仅在账单导入时通过 Charge `payment_id` 匹配同租户店铺订单 `transaction_id` 后保存；筛选不会补写或回填历史快照。详见 [AdaPay 对账单管理契约](feature-docs/2026-11-11-adapay-bill-management/contract-changes.md)。

## 活动模板画像中奖策略（2026-10-30）

活动模板增加公平开奖、偏向新用户、偏向流失/低频用户和留存唤醒分层四种策略；开奖与即时抽奖按会员用户画像阶段赔率加权，缺失画像按公平处理。期次保存策略快照，游戏模式不变。详见 [活动模板中奖策略契约](feature-docs/2026-10-30-activity-winning-strategy/contract-changes.md)。

## 微信支付配置选项调整

- 管理后台不再提供微信支付 V2 配置选项或微信付款码配置 ID；配置 API 拒绝新增或更新 `payType=wxPay`。
- 运行时不再注册微信 V2 支付平台，也移除了微信付款码（V2 MICROPAY）分支；已有 V2 配置记录保留在数据库，但不能用于支付。
- 不变更请求/响应结构和数据库 schema。

## 微信支付 V3 应答验签模式

- 管理端可在微信支付配置表单中下载平台证书。后端使用当前表单中的商户号、商户 API 私钥、商户 API 证书序列号和 APIv3 密钥调用平台证书接口，并解密返回当前有效的证书 PEM 与序列号；管理端回填到当前表单（存为 `STR`），由用户提交配置后持久化。
- 商户配置 API 增加 `wechatPayVerifyMode`：`PUBLIC_KEY`（默认）或 `PLATFORM_CERTIFICATE`，新增和编辑配置均保存该值。
- `PUBLIC_KEY` 模式下，`wechatPayPublicKeyId` 是微信支付公钥 ID，`wechatPayPublicKey` 保存微信支付公钥 PEM 内容或后端可读文件路径。
- `PLATFORM_CERTIFICATE` 模式下，`wechatPayPublicKeyId` 是微信支付平台证书序列号，`wechatPayPublicKey` 保存平台证书 PEM 内容或后端可读文件路径；`certStoreType` 仅支持 `STR`（内容）和 `PATH`（路径）。
- 退款查询和商家转账创建/查询的应答验签按所选模式加载对应 RSA 公钥，并校验响应 `Wechatpay-Serial` 与配置 ID 匹配。请求签名仍使用商户 API 私钥和商户 API 证书序列号，不受此模式影响。
- `keyPrivate` / `keyPublic` 属于 Adapay RSA 配置；微信 V3 配置表单不展示这两个字段。

## 会员详情微信打款

- `POST /admin-api/pay/member-transfer/create`：请求 `userId`、`amount`、`outBillNo`（客户端生成并在同一次打款重试中复用）。后端按当前租户读取会员，仅使用 `routineOpenid`；缺失时拒绝打款。金额以元传入，必须大于 0，精度最多两位。
- 成功响应包含 `outBillNo`、`transferBillNo`、`state`、`packageInfo`。该接口创建微信支付 API v3 商家转账单；微信可能要求用户确认收款，接口受理不等于款项到账。
- `GET /admin-api/pay/member-transfer/query?outBillNo={outBillNo}`：查询该商户转账单，返回单号、状态、转账金额（分）、备注和失败原因。管理端显示公众号 OpenID 与小程序 OpenID；只有存在 `routineOpenid` 时允许发起打款。
- `GET /admin-api/pay/member-transfer/page`：按 `userId` 分页查询该会员的微信打款记录，返回商户单号、微信转账单号、金额（分）、状态、转账备注、失败原因和创建时间。记录由后端在会员打款请求时持久化，按当前租户隔离；查询单笔转账结果时同步更新记录状态。
- `POST /admin-api/pay/member-transfer/cancel?outBillNo={outBillNo}`：撤销当前租户下该会员打款记录对应的转账单；仅允许本地状态为 `ACCEPTED`、`PROCESSING`、`WAIT_USER_CONFIRM` 或 `TRANSFERING` 时发起。响应状态为 `CANCELING` 或 `CANCELLED`；撤销受理不代表撤销完成，仍需查单确认最终状态。
- 新增会员微信打款记录表，保存会员 ID、商户单号（租户内唯一）、微信转账单号、`package_info`、金额（分）、状态、备注、失败原因及标准审计字段；不保存 OpenID 或支付密钥。历史上已经提交的打款单无法从本地记录恢复，该列表自部署后记录新发起的打款。
- 接口权限为独立的 `member:user:transfer`。复用当前租户微信小程序支付商户配置及商家转账能力。

## App 用户微信打款记录

- `GET /app-api/pay/member-transfer/page`：分页查询当前登录会员自己的微信打款记录。支持 `userId` 或 `externalUserId` 至少传一个；两者同时传入时必须指向同一会员。查询条件必须与当前登录会员一致，禁止按其他用户标识读取记录。
- 请求分页字段为 `pageNo`、`pageSize`（最大 100）。记录按创建时间倒序，受当前租户隔离。
- 响应包括 `id`、`userId`、`outBillNo`、`transferBillNo`、`appId`、`mchId`、`packageInfo`、`transferAmount`（分）、`state`、`transferRemark`、`failReason`、`createTime`。`appId` / `mchId` 通过当前租户的 `wx_miniapp` 支付配置关联查询，需与前端调起用户确认收款页时传入的值一致；不单独保存在打款记录表中。`packageInfo` 仅用于用户确认收款，记录无该参数时为空。

## 活动微信打款

- 活动奖品规则新增微信打款现金兑奖；后台财务新增只读“用户转账”列表，会员详情和财务列表复用同一转账明细数据源。
- 统一记录新增类型：`MEMBER_MANUAL`、`ACTIVITY_WINNER_CASH`、`ACTIVITY_REFERRAL_REWARD_CASH`。推荐奖励现金类型独立可筛选，备注包含活动、期次和推荐阶梯；既有会员人工打款记录迁移为 `MEMBER_MANUAL`。
- Activity 通过 `yshop-module-pay-api` 发起转账；统一记录增加 `transfer_type` 和业务 `remark`，活动/期次/层级写入备注，不增加来源 ID 或期次字段。转账使用由兑奖来源派生的稳定商户单号及现有租户内唯一约束幂等。
- `GET /admin-api/pay/user-transfer/page` 使用独立 `pay:user-transfer:query` 权限，支持分页以及类型、状态、用户、备注关键字和时间过滤；`GET /admin-api/pay/member-transfer/page?userId={id}` 保持会员详情范围并扩展返回类型/备注。
- `POST /admin-api/pay/user-transfer/refresh?outBillNo={outBillNo}` 使用 `pay:user-transfer:query` 权限，按当前租户查询微信商家转账单并同步本地转账状态；仅允许刷新当前租户已保存的转账记录，返回微信最新转账单信息。
- 商家转账复用商户配置中的异步 `notifyUrl`；同一回调入口按事件类型分发普通支付成功 `TRANSACTION.SUCCESS` 和转账终态 `MCHTRANSFER.BILL.FINISHED`。微信终态通知验签、解密并幂等更新；非终态转账由后端查单兜底。未知请求结果复用原商户单号，不生成重复打款。
- 本期目标仓库为 backend/admin；用户确认收款页面和 H5/小程序集成延期，后台现金规则开放前须完成客户端调起确认收款阶段。详见 [活动微信打款 Feature Contract](feature-docs/2026-10-27-activity-wechat-transfer/contract-changes.md)。

## 活动报名推荐人 ID（2026-10-11）

`POST /app-api/activity/registration/create` 新增可选 query 参数 `referrerUserId`（Long，backend 会员 ID）。H5 从小程序入口 `referrerUserId` 读取推荐人，报名时以 API 参数 `referrerUserId` 原样传递，不得映射为外部 ID。后端按当前租户校验该会员存在；不存在则报名失败。移除 `referrerExternalUserId` 参数支持。活动分享短链接统一使用下划线参数 `referrer_user_Id`（当前登录会员 ID）。`channelCode` 保持不变，无数据库变更。

平台规则见 [ARCHITECTURE.md](ARCHITECTURE.md)，机器快照见 `CONTRACT/`；功能契约按功能目录维护。

- [小程序码生成](feature-docs/2026-09-07-miniapp-qrcode/contract-changes.md)：新增 app-api，复用微信 SDK 与 infra 临时文件存储。
- [活动页面小程序短链接](feature-docs/2026-09-21-activity-miniapp-short-link/contract-changes.md)：app-api 根据活动模板和推荐人生成微信小程序短链接文本。
- [管理后台生成活动小程序短链接](feature-docs/2026-10-16-activity-admin-short-link/contract-changes.md)：新增 admin-api，根据活动期次生成不带会员推荐人的微信小程序短链接。
- [企业微信外部素材](feature-docs/2026-09-08-wecom-external-material/contract-changes.md)：素材组支持由系统 Provider 配置驱动的有序多结果外部素材。
- [会员企微客户筛选](feature-docs/2026-09-11-member-wecom-customer-filter/contract-changes.md)：会员分页接口支持按是否存在已匹配企微客户关联记录筛选。
- [会员 ID 查询](feature-docs/2026-09-25-member-id-query/contract-changes.md)：会员分页接口支持按会员 ID 精确查询。
- [会员外部用户 ID](feature-docs/2026-09-13-member-external-user-id/contract-changes.md)：会员增加可选外部系统用户 ID，供后台维护和查询展示。
- [会员详情企业微信信息](feature-docs/2026-10-20-member-detail-wecom-info/contract-changes.md)：会员详情展示当前租户内通过会员 ID 或 UnionID 关联的企业微信客户资料和匹配状态。
- [企业微信客户朋友圈](feature-docs/2026-09-11-wecom-customer-moments/contract-changes.md)：朋友圈素材组支持文字、图片或单个链接附件，并按企业微信接口规则校验附件类型。
- [企业微信客户联系人客户标签](feature-docs/2026-09-20-wecom-customer-contact-tags/contract-changes.md)：客户联系人支持单个和批量添加、移除企业微信客户标签，不使用内部标签。
- [企业微信客户联系人按客户员同步](feature-docs/2026-09-13-wecom-customer-contact-follow-user-sync/contract-changes.md)：客户联系人同步接口支持可选客户员 UserID，未传时保持全部客户员同步。
- [企业微信群临时二维码](feature-docs/2026-10-22-wecom-customer-group-temporary-qrcode/contract-changes.md)：管理端临时生成指定客户群进群二维码，通过 Redis 延迟队列在 1 小时后调用企业微信删除进群配置，不持久化业务数据。
- [活动抽奖次数与中奖限制](feature-docs/2026-09-13-activity-management/contract-changes.md)：报名默认 1 次抽奖机会，支持后台和用户端增加次数，并支持按活动限制每人最多中奖一次；用户端报名身份从登录态解析，不再由客户端传入当前用户 `externalUserId`。
- [活动报名订单条件](feature-docs/2026-09-13-activity-management/contract-changes.md)：报名条件支持按配置天数判断会员在 N 天内是否有已确认订单；当前外部订单接口仅支持 1 天；同一条件类型可配置多个条件实例。
- [活动推荐报名查询](feature-docs/2026-09-13-activity-management/contract-changes.md)：用户端支持按活动期次查询当前登录用户推荐的有效报名记录。
- [活动报名条件分类与说明编辑](feature-docs/2026-09-17-activity-management-refactor/contract-changes.md)：报名条件分为内置和扩展两类，支持按租户编辑条件说明。
- [活动报名条件实例管理](feature-docs/2026-09-18-activity-condition-instance-management/contract-changes.md)：条件类型由后端注册，租户可管理带参数的条件实例，并按模板引用阻止删除。
- [活动模板奖品回显](feature-docs/2026-09-13-activity-management/contract-changes.md)：管理端活动模板详情和分页响应返回 `prizes`，用于编辑表单回显模板奖品配置。
- [活动群活码配置](feature-docs/2026-09-13-activity-management/contract-changes.md)：活动模板支持从图片素材库选择群活码图片，并在生成期次时写入快照供用户端详情返回。
- [活动中奖记录兑奖](feature-docs/2026-09-19-activity-winner-claim/contract-changes.md)：开奖只生成中奖记录；后台支持单条中奖记录兑奖、中奖管理批量兑奖和期次批量兑奖，兑奖状态随中奖记录返回。
- [活动中奖企业微信通知](feature-docs/2026-09-21-activity-winner-notification/contract-changes.md)：中奖管理支持由活动管理员向中奖客户发送企业微信中奖通知。
- [活动中奖通知状态](feature-docs/2026-09-21-activity-winner-notification/contract-changes.md)：中奖记录持久化企业微信通知状态，后台支持展示和筛选。
- [活动中奖批量通知](feature-docs/2026-09-25-activity-winner-batch-notification/contract-changes.md)：中奖管理支持按勾选记录批量创建企业微信中奖通知任务。
- [活动线下兑奖码](feature-docs/2026-09-21-activity-offline-claim-code/contract-changes.md)：开奖规则支持线下兑奖，并为每条中奖记录生成唯一兑奖码。
- [活动模板报名人数限制](feature-docs/2026-09-21-activity-registration-limit/contract-changes.md)：后台按活动模板配置每期报名人数上限，报名时由后端原子校验。
- [活动中奖公示长图](feature-docs/2026-09-21-activity-winner-public-poster/contract-changes.md)：管理端和用户端按活动期次查询最多展示 100 条有效中奖记录，管理端生成公示长图，用户端展示脱敏中奖名单。
- [活动邀请报名增加抽奖机会](feature-docs/2026-09-21-activity-invite-chance/contract-changes.md)：后台开启后，被推荐人成功报名且推荐人已报名时，推荐人自动增加一次抽奖/游戏机会；用户端详情返回开关状态，抽奖或游戏后分享提示好友报名奖励。
- [活动推荐阶梯奖励](feature-docs/2026-10-16-activity-referral-rewards/contract-changes.md)：保留推荐增加抽奖/游戏机会配置，另按期次统计新人和普通推荐阶梯并使用独立奖品数量；管理后台按推荐人查询统计并可兑换，推荐人也可通过用户端自助兑奖；中奖管理不包含推荐奖励。
- [活动即时抽奖模式](feature-docs/2026-09-22-activity-lottery-mode/contract-changes.md)：活动模板支持开奖/抽奖两种模式，抽奖模式由 app-api 按概率即时抽奖并以 requestId 幂等。
- [活动模板兜底奖励](feature-docs/2026-09-18-activity-prize-draw-rule-management/contract-changes.md)：模板可独立选择一个不配置数量或概率的兜底奖品；开奖/即时抽奖常规规则未命中有效奖品时使用期次兜底快照生成中奖结果。
- [活动游戏模式](feature-docs/2026-10-15-activity-game-mode/contract-changes.md)：管理员手动新增游戏展示名称，活动模板选择游戏并配置三关奖品；新配置使用现有 H5 跳跃玩法，用户端会话由后端推进和结算。
- [活动期次更换群活码](feature-docs/2026-10-18-activity-period-group-qrcode/contract-changes.md)：管理后台可为未结束活动期次更新群活码图片快照，不影响活动模板和历史业务记录。
- 活动游戏关卡提交不再使用数字挑战：`POST /app-api/activity/period/game/submit` 改为接收客户端报告的 `passed` 布尔值；后端保留会话、关卡顺序、幂等和奖品结算校验，响应移除 `challenge`。
- [活动用户端兑奖](feature-docs/2026-09-19-activity-winner-claim/contract-changes.md)：用户端可兑奖自己的中奖记录，报名和中奖结果返回兑奖状态；执行失败保持待兑奖并可重试。
- [活动期次状态与结束操作](feature-docs/2026-09-13-activity-management/contract-changes.md)：期次生命周期状态与报名开关解耦，后台支持显式结束期次，状态扫描任务每 5 分钟推进期次状态和报名开关。
- 用户端 `GET /app-api/activity/period/detail` 与 `/latest` 的期次详情响应新增 `drawStatus`：`0` 未开奖、`1` 开奖中、`2` 已开奖、`3` 开奖失败。H5 定时开奖模式仅在 `drawStatus=2` 且用户无中奖记录时展示未中奖结果。
- [活动用户端奖品展示](feature-docs/2026-09-23-activity-app-prize-display/contract-changes.md)：用户端活动详情奖品响应移除库存、已中奖数量和中奖概率字段，保留内部抽奖数据。
- [活动 H5 Ticket 认证](feature-docs/2026-09-15-activity-h5-auth/contract-changes.md)：已登录客户端通过一次性 ticket 安全进入 H5，兑换 backend Bearer Token。
- [外卖用户画像](feature-docs/2026-10-19-member-user-profile/contract-changes.md)：新增租户隔离的画像数据、按订单频率和注册时间计算并持久化的用户阶段、由后端阶段枚举统一提供编码/中文名称/颜色及阶段选项接口、会员 ID 和主商圈代码展示与筛选、只读管理端分页查询和全量阶段分布统计。
- [用户画像企微关联筛选](feature-docs/2026-10-20-user-profile-wecom-filter/contract-changes.md)：用户画像分页和阶段分布新增是否关联企业微信筛选，分页响应返回关联状态；后端按当前租户会员与企微联系人关系判定。
- [活动报名管理画像展示](feature-docs/2026-10-20-activity-registration-profile-display/contract-changes.md)：报名分页响应补充期次奖品名称和会员用户阶段，用户阶段从当前租户关联会员的最新用户画像读取。
- [店铺商品导入异步确认](feature-docs/2026-10-28-store-product-import-async/contract-changes.md)：店铺商品导入预览和确认均改为后台异步处理，管理端通过现有查询接口跟踪 `PREVIEWING`、`DRAFT`、`PROCESSING`、`IMPORTED` 和 `FAILED` 状态。

活动 H5 认证在 dev 环境额外支持 Mock Ticket：当 `yshop.security.mock-enable` 和
`yshop.security.mock-webview-ticket-enable` 同时开启时，`test` 前缀加数字用户 ID（例如
`test590471`）可直接兑换该 dev 用户的 backend Token；租户由
`yshop.security.mock-webview-ticket-tenant-id` 配置。该能力不使用 Redis Ticket，生产环境必须关闭。

## 小程序无手机号登录

- `POST /app-api/member/auth/auth-session` 继续接收 `wx.login()` 返回的一次性 `code`。
- 后端通过微信 `jscode2session` 获取并校验 `openid`，按当前 `tenant-id` 查询小程序会员；不存在时创建一个手机号为空的会员并绑定 `routine_openid`。
- 查询或创建成功后统一签发并返回 `accessToken`、`refreshToken`、`expiresTime`、`openId` 和 `userInfo`。
- 客户端不得直接提交 `openid` 作为身份凭证；重试必须重新调用 `wx.login()` 获取新 `code`。
- `auth-session` 的登录副作用是明确的：首次调用可能创建会员并写入登录记录。旧客户端只读取 `openId` 的行为保持兼容。

## 饭火轮新店外部素材

- 新店素材复用当前租户的 `we7_mall_host`（微擎商城域名），不再读取 `fhl_new_store_request_url`。
- 客户端参照热门商品接口，以商城域名拼接 `/app/index.php`，通过 GET 查询新店，携带 `i=2`、`c=entry`、`a=wxapp`、`do=getTopFixedPriceProducts`、`m=hlmall`、`businessModule=store` 和商圈参数 `region_code`。
- 响应沿用 `status=success`、`data` 数组，每个门店包含 `id`、`name`、`logo`；素材继续随机选取最多 3 家有效门店。

## 饭火轮每日活动红包外部素材

- Provider：`FHL_DAILY_ACTIVITY_COUPON_MINI_PROGRAM`，输出类型为 `MINI_PROGRAM`，每次最多返回 1 条。
- Provider 参数为 `businessRegionCode`（商圈编码）和 `coverImageUrl`（优惠券封面图片）；封面由管理端图片组件选择，不写入外部接口凭据。
- 后端复用当前租户的 `we7_mall_host`，以商城域名拼接 `/app/index.php`，通过 GET 调用 `GetDailyShareCoupon`，携带 `i=2`、`t=0`、`v=4.9.9`、`from=wxapp`、`c=entry`、`a=wxapp`、`m=hlmall`、`businessModule=coupon`、签名和 `region_code`。
- 响应要求 `status=success`；从 `data` 中只取第一条有效优惠券，使用 `id` 生成小程序页面 `hlmall/pages/coupon/receive?scene={id}`，标题取优惠券 `name`，图片取 Provider 的 `coverImageUrl`。

## 企业微信客户朋友圈周期发送

- `POST /admin-api/mp/wecom-moment/schedule/create`：创建周期发送计划。请求包含 `accountId`、`materialGroupId`、`senderUserids`、`dailyTimes`（`HH:mm` 数组，单计划每天可配置多个时间），以及可选 `startDate`、`endDate`。
- `GET /admin-api/mp/wecom-moment/schedule/page`：查询周期发送计划及执行状态。
- `POST /admin-api/mp/wecom-moment/schedule/cancel`：取消尚未结束的周期发送计划。
- 每个到期时间点独立创建一条 `mp_wecom_moment_task` 朋友圈任务；原有 `POST /admin-api/mp/wecom-moment/create` 即时发送接口保持兼容。
- backend Quartz handler `wecomMomentScheduledPushJob` 每 10 分钟扫描执行。图片和链接封面在实际执行时调用朋友圈专用素材上传接口，不复用普通素材上传逻辑。

## 店铺多分账收款人绑定与结算匹配

- `yshop_store_shop.profit_sharing_recipient_id` 继续唯一表示店铺主分账收款人；本系统订单分账与应收应付店铺收款主体只使用该主收款人。
- 店铺可另绑多个非主收款人并标记 `VALID` / `INVALID`；标记仅作关系记录，不改变本系统出账授权，也不影响订单结算管理同步分账状态时按该店铺绑定关系匹配 AdaPay `Member ID`。
- 订单结算管理同步时，主收款人及全部非主收款人均可匹配；按完整 Member ID 匹配，不能唯一解析时不猜测归属。外部账单不含来源渠道时，不推断分账渠道来源。
- `GET /admin-api/store/shop/profit-recipient-bindings` 与 `PUT /admin-api/store/shop/profit-recipient-bindings` 维护绑定；分别使用 `store:shop:query` 和 `store:shop:update` 权限。原单主收款人绑定接口保持兼容。详细 DTO、数据迁移与匹配规则见[店铺多分账收款人绑定与结算匹配契约](feature-docs/2026-11-09-shop-profit-recipient-roles/contract-changes.md)。


### AdaPay 对账单管理：门店快照与筛选

- Charge 明细支持支付ID、商户订单号精确筛选；PaymentConfirm 支持商户支付ID筛选；Div 支持商户支付ID、MemberId 筛选。
- 三类明细表冗余 `shop_id`、`shop_name`（迁移 V2026111103）：导入时 Charge 以账单支付ID匹配订单 `transactionId` 取得门店快照，PaymentConfirm、Div 经商户支付ID关联同版本 Charge 继承；分页查询直接读冗余字段，不实时联表。
- 关联只补充展示字段，不改变原始账单、不执行对账判断；未匹配时仍返回原始明细，门店字段为空。查询必须保持租户隔离。

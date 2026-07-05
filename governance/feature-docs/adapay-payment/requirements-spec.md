## Feature: Adapay Third-Party Payment Integration

### Scope

**In-scope**

- 新增 Adapay（汇付天下）第三方支付渠道，集成 `com.holuntech:pay-java-adapay:2.14.14-SNAPSHOT` 适配模块。
- 实现 Adapay 支付回调消息处理器，将支付成功通知接入现有 Redis Stream MQ 链路（PayNoticeProducer -> PayNoticeConsumer -> AppStoreOrderService.paySuccess）。
- 在 `MerchantPayServiceConfigurer` 中注册 Adapay 支付平台，使其通过 eGzosN 框架自动加载 `merchant_details` 表中对应的商户配置。
- 扩展支付类型枚举 `PayTypeEnum` 支持 `"adapay"` 支付方式，并在 `paySuccess` 中正确显示 Adapay 的支付方式文案。
- 扩展 `PayIdEnum` 添加 Adapay 对应的支付 ID（如 `ADAPAY_H5`），供管理后台商户详情表单使用。
- 管理后台 `MerchantDetailsForm.vue` 的 `payType` 下拉框新增 Adapay 选项，`detailsId` 下拉框新增 Adapay H5 等选项。
- 管理后台所有显示 `payType` 的订单视图（storeOrder/index、OrderDetail、desk/Order、score/order 等）新增 `"adapay"` 到 "Adapay支付" 的映射。
- 管理后台 `constants.ts` 的 `PayChannelEnum` 和 `PayType` 枚举新增 Adapay 条目。
- 管理后台收银结算页面（settlement.vue / settlement2.vue）新增 Adapay 支付方式选项。

**Out-of-scope**

- 新增数据库表或修改 `merchant_details` 表结构（现有表结构已足够通用，直接复用）。
- 修改 `PayNoticeProducer`、`PayNoticeMessage`、`PayNoticeConsumer` 的核心逻辑（现有 Stream Key `"order.pay.notice"` 通用，无需变更）。
- 修改 `AppStoreOrderService.paySuccess` 的核心业务逻辑（仅需新增 payType 文案映射）。
- 新增或修改小程序端（miniapp）代码（小程序端仅展示支付方式文案，无需修改后端调用链路；如需在 C 端展示，由后续需求独立处理）。
- 修改支付退款（refund）逻辑。
- 新增权限点（复用现有 `pay:merchant-details:create/update/delete`）。
- 发送微信模板消息、短信、推送等用户通知。
- 修改 `paId == 1`、`refund_status` 等不相关的订单状态语义。

**约束引用**

- `governance/CONTRACTS.md`：Admin API 前缀为 `/admin-api`，使用统一 `CommonResult` 结构；跨模块调用须通过 `-api` 模块。
- `governance/ARCHITECTURE.md`：支付回调通过 Redis Stream MQ 异步处理 (`order.pay.notice`)；租户隔离由 MyBatis Plus `TenantLineInnerInterceptor` 自动注入；历史订单金额、佣金不可变，支付成功回调不触发额外变更。
- 多租户：`merchant_details` 表通过 `tenant_id` 隔离，不同租户可独立配置 Adapay 商户参数。

### Data Model Changes

| 位置 | 变更 |
|------|------|
| `PayTypeEnum` (`yshop-module-order-api`) | 新增 `ADAPAY("adapay", "Adapay支付")` |
| `PayIdEnum` (`yshop-framework/yshop-common`) | 新增 `ADAPAY_H5("adapay_h5", "Adapay支付H5")` — 后续可根据需要扩展 APP/小程序等 |
| `merchant_details` 表 | 无 DDL 变更。新增 Adapay 商户配置记录，`payType` 值为 `"adapay"`（与 `AdapayPaymentPlatform.PLATFORM_NAME` 一致，经 JAR 反编译验证），其他字段（`appid`、`mchId`、`keyPrivate`、`keyPublic`、`signType`、`notifyUrl` 等）复用现有列 |

### API Requirements

#### 已有接口无新增

无需新增或修改后端 API 端点。以下接口已满足 Adapay 需求：

- `POST /pay/merchant-details/create` — 创建 Adapay 商户配置，`payType` 传入 `"adaPay"`
- `PUT /pay/merchant-details/update` — 更新 Adapay 商户配置
- `GET /pay/merchant-details/page` — 分页查询，可按 `payType` 筛选 Adapay 配置
- `DELETE /pay/merchant-details/delete` — 删除 Adapay 配置
- 支付回调端点由 eGzosN `pay-spring-boot-starter` 自动提供，无需业务代码额外暴露

### Backend Requirements

#### 1. Maven 依赖

- 在 `backend/yshop-module-pay/yshop-module-pay-api/pom.xml` 新增：
  ```xml
  <dependency>
      <groupId>com.holuntech</groupId>
      <artifactId>pay-java-adapay</artifactId>
      <version>2.14.14-SNAPSHOT</version>
  </dependency>
  ```
- 确认 `com.holuntech` 的 Maven 仓库已在 `backend/pom.xml` 或本地 `settings.xml` 中配置（`pay-java-adapay` 不是公共 Maven Central 包，需私有仓库或本地安装）。

#### 2. 支付回调消息处理器

- 新建 `AdapayPayMessageHandler.java` 于 `backend/yshop-module-pay/yshop-module-pay-api/src/main/java/co/yixiang/yshop/module/pay/config/handlers/`
- 实现 `PayMessageHandler<AdapayPayMessage, AdapayPayService>`（泛型类型以 `pay-java-adapay` 实际 API 为准）
- 标注 `@Component`、`@Slf4j`
- 注入 `PayNoticeProducer`
- `handle()` 逻辑：
  1. 校验交易状态为支付成功（具体状态值参考 Adapay 回调文档）
  2. 从回调消息中提取订单号 `orderId`
  3. 调用 `payNoticeProducer.sendPayNoticeMessage(orderId, "adapay")`
  4. 返回支付网关要求的成功响应

#### 3. 平台注册

- 修改 `MerchantPayServiceConfigurer.configure(PayMessageConfigurer)`：
  1. 注入 `AdapayPayMessageHandler`
  2. 通过 `PaymentPlatforms.getPaymentPlatform(AdapayPaymentPlatform.PLATFORM_NAME)` 获取 Adapay 平台实例
  3. 调用 `configurer.addHandler(adapayPlatform, adapayPayMessageHandler)` 注册处理器

#### 4. 枚举扩展

- `PayTypeEnum` 新增 `ADAPAY("adapay", "Adapay支付")`
- `PayIdEnum` 新增 `ADAPAY_H5("adapay_h5", "Adapay支付H5")`
- `AppStoreOrderServiceImpl.paySuccess()` 新增 `"adapay"` 到 `PayTypeEnum.ADAPAY` 的映射分支（约第 930-936 行）

### Frontend Requirements

#### 管理后台 (`admin`)

1. **`admin/src/utils/constants.ts`**：
   - `PayChannelEnum` 新增 `ADAPAY_H5: { code: 'adapay_h5', name: 'Adapay支付H5' }`
   - `PayType` 新增 `ADAPAY: 'ADAPAY'`

2. **`admin/src/views/pay/merchantDetails/MerchantDetailsForm.vue`**：
   - `payType` 下拉框新增 `<el-option label="Adapay支付" value="adaPay" />`
   - `detailsId` 下拉框新增 `<el-option label="Adapay支付H5" :value="'adapay_h5'+tenantId" />`

3. **所有显示 `payType` 的订单视图**（共约 6 个文件），新增 `"adapay"` 显示映射：

   | 文件 | 映射变换 |
   |------|---------|
   | `admin/src/views/mall/order/storeOrder/index.vue` | `adapay` = 'Adapay支付' |
   | `admin/src/views/mall/order/storeOrder/OrderDetail.vue` | `adapay` = 'Adapay支付' |
   | `admin/src/views/mall/desk/shopDesk/Order.vue` | `adapay` = 'Adapay支付' |
   | `admin/src/views/score/order/index.vue` | `adapay` = 'Adapay支付' |
   | `admin/src/views/site/order/OrderDetail.vue` | `adapay` = 'Adapay支付' |
   | (收银结算页) `admin/src/views/mall/cashier/settlement.vue` 和 `settlement2.vue` | 支付方式选项新增 Adapay |

### Edge Cases

| 场景 | 处理 |
|------|------|
| Adapay 回调重复通知 | `appStoreOrderService.paySuccess` 中 `StoreOrderDO` 更新使用 `LambdaQueryWrapper` 按 `orderId` 匹配，幂等覆盖 `paid`、`payType`、`payTime` 字段；库存扣减带 Redisson 分布式锁，二次触发不重复扣减。 |
| Adapay 回调失败（网络超时、签名错误） | eGzosN 框架自动验签并在失败时返回错误响应；`AdapayPayMessageHandler` 仅处理 `TRADE_SUCCESS` 状态，失败状态直接返回 `FAIL`。 |
| 同一订单通过不同支付渠道重复支付 | 订单已 `paid == 1` 时，`paySuccess` 仍会更新 `payType` 为最后回调的渠道，但库存锁防止重复扣减。建议后续验收时确认此场景的幂等行为是否符合预期。 |
| `merchant_details` 缺少 Adapay 配置记录 | eGzosN 框架在查找商户配置时，若 `payType = "adaPay"` 且 `detailsId` 匹配的记录不存在，回调处理将抛异常；Adapay 会收到失败响应并重试。管理员应在启用 Adapay 前完成商户配置。 |
| 租户隔离 | 每个租户独立创建 `merchant_details` 记录（含 `tenant_id`），Adapay 回调由 eGzosN 框架根据 `appid`/`detailsId` 自动匹配对应租户的商户配置。 |
| 管理后台 Adapay 表单字段适配 | `MerchantDetailsForm.vue` 的表单字段（`appid`、`mchId`、`keyPrivate`、`keyPublic`、`signType`、`notifyUrl` 等）为通用字段，直接复用于 Adapay。若 `pay-java-adapay` 需要额外字段（如 `apiKey`、额外证书等），需在 DO/VO/表单中同步新增。建议先确认 `pay-java-adapay` 的 `MerchantDetails` 接口字段。 |
| Admin 菜单/路由 | 菜单 "支付管理 > 支付服务商配置" 由后端 `/system/auth/get-permission-info` 动态下发，前端无需修改路由注册。若需新增独立 Adapay 配置菜单项，需后端同步新增菜单权限记录。 |
| Adapay SDK 的 Maven 可用性 | `com.holuntech:pay-java-adapay:2.14.14-SNAPSHOT` 需确认 Maven 私服已部署该包，且所有开发/CI 环境可解析。若不可用，需本地 `mvn install` 安装或配置额外仓库。 |

### Acceptance Criteria

1. `backend/yshop-module-pay/yshop-module-pay-api/pom.xml` 包含 `pay-java-adapay` 依赖，项目可正常编译。
2. `AdapayPayMessageHandler` 实现 `PayMessageHandler` 接口，正确注入 `PayNoticeProducer`，并在收到支付成功回调后将 `orderId` 和 `payType = "adapay"` 通过 Redis Stream MQ 发送至 `order.pay.notice`。
3. `MerchantPayServiceConfigurer.configure(PayMessageConfigurer)` 中已注册 `AdapayPaymentPlatform` 及其 `AdapayPayMessageHandler`。
4. `PayTypeEnum` 包含 `ADAPAY("adapay", "Adapay支付")`；`paySuccess` 方法中 `"adapay"` 正确映射到 `PayTypeEnum.ADAPAY.getDesc()`。
5. `PayIdEnum` 包含至少一个 Adapay 条目（如 `ADAPAY_H5("adapay_h5", "Adapay支付H5")`）。
6. 管理后台可通过 "支付管理 > 支付服务商配置" 新增 `payType = "adaPay"` 的 Adapay 商户记录，表单包含 Adapay 对应的 `detailsId` 选项。
7. 管理后台所有订单列表/详情页中，付款方式为 `"adapay"` 的订单正确显示为 "Adapay支付"。
8. 管理后台收银结算页面可选择 Adapay 作为支付方式。
9. 模拟 Adapay 支付成功回调后，订单状态正确更新为已支付（`paid = 1`），`payType` 字段记录为 `"adapay"`。
10. 不同租户可独立配置各自的 Adapay 商户参数，互不干扰。

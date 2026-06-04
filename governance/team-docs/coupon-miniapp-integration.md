## Feature: 小程序使用优惠券功能

### Scope

**In Scope:**
1. 小程序 coupons 页面接入真实 API（获取我的优惠券、可领取优惠券、领取优惠券）
2. 小程序 payment 页面接入优惠券选择和使用
3. 后端 Device 模块订单创建支持传入 couponId
4. 后端 Order API 透传 couponId 到订单创建流程

**Out of Scope:**
- 后端优惠券管理功能（已存在）
- 后端订单优惠券计算逻辑（已存在）
- 新增优惠券类型或规则

### 现状分析

**后端已有能力：**
- `AppCouponController` 提供 C-end API: `/coupon/count`, `/coupon/my`, `/coupon/not`, `/coupon/receive`
- `AppStoreOrderServiceImpl.createOrder()` 已完整支持优惠券验证、金额扣减、标记已使用
- `AppOrderParam` 已有 `couponId` 字段
- `AppStoreOrderDTO` 已有 `couponId` 和 `couponPrice` 字段

**缺失环节：**
- `OrderApiImpl.createAppOrder()` 未将 `AppStoreOrderDTO.couponId` 设置到 `AppOrderParam`
- `DeviceOrderReqVO` 没有 `couponId` 字段
- `DeviceManagementServiceImpl.placeOrder()` 未处理优惠券

**小程序现状：**
- `pages/coupons/coupons.js` 全 mock 数据，未调用真实 API
- `pages/payment/payment.js` `selectCoupon()` 提示"功能开发中"
- payment 页面下单时未传 `couponId`

### 后端改动

#### 1. DeviceOrderReqVO 新增字段
```java
@Schema(description = "优惠券ID")
private Long couponId;
```

#### 2. DeviceManagementServiceImpl.placeOrder() 增加优惠券处理
```
- 从 deviceOrderReqVO 获取 couponId
- 如果 couponId 不为空：
  - 查询 CouponUserDO 验证有效性（status=0, 在有效期内）
  - 验证商品金额 >= couponUserDO.least
  - 设置 appStoreOrderDTO.couponId = couponId
  - 设置 appStoreOrderDTO.couponPrice = couponUserDO.value
- 调用 orderApi.createAppOrder(appStoreOrderDTO)
```

#### 3. OrderApiImpl.createAppOrder() 透传 couponId
```java
appOrderParam.setCouponId(String.valueOf(appStoreOrderDTO.getCouponId()));
```

### 小程序改动

#### 1. pages/coupons/coupons.js 接入真实 API
- `onLoad` 调用 `/app-api/coupon/my?type=0` 获取可用优惠券
- 增加"可领取" tab，调用 `/app-api/coupon/not` 获取可领取列表
- 兑换功能调用 `/app-api/coupon/receive`（支持 id 和 code 两种模式）
- `useCoupon` 选择优惠券后返回上一页（带 couponId 参数）

#### 2. pages/payment/payment.js 接入优惠券
- `onLoad` 时获取当前店铺可用优惠券数量 `/app-api/coupon/count`
- `selectCoupon()` 跳转到 coupons 页面（或显示 picker）
- 选择优惠券后更新 `selectedCoupon` 和 `finalAmount`
- `calculateFinalAmount()` 减去优惠券金额（最低为 0）
- `handlePay()` 下单时传入 `couponId`
- 余额支付检查需要基于 finalAmount

### API Contract

新增/修改的 API 端点：

| Endpoint | Method | Change | Description |
|----------|--------|--------|-------------|
| `/app-api/device/_order` | POST | 新增 `couponId` 参数 | 创建设备订单时可选传入优惠券 |
| `/app-api/coupon/count` | GET | 已存在 | 查询可用优惠券数量 |
| `/app-api/coupon/my` | GET | 已存在 | 获取我的优惠券 |
| `/app-api/coupon/not` | GET | 已存在 | 获取可领取优惠券 |
| `/app-api/coupon/receive` | POST | 已存在 | 领取优惠券 |

### Data Flow

```
User opens payment page
    ↓
Fetch available coupons: GET /app-api/coupon/count?shop_id=8&type=0
    ↓
User taps "选择优惠券"
    ↓
Navigate to coupons page → select coupon → navigate back with couponId
    ↓
Payment page recalculates finalAmount = productPrice + boxFee - couponDiscount
    ↓
User taps pay
    ↓
POST /app-api/device/_order { imei, productId, shopId, boxFeeSelected, couponId }
    ↓
Backend: validate coupon → create order with coupon discount
    ↓
Pay with balance or WeChat Pay (based on finalAmount)
```

### Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| 优惠券金额大于订单金额 | Low | 后端 `createOrder` 已处理（payPrice < 0 时设为 0） |
| 优惠券重复使用 | Low | 后端标记 `couponUser.status = 1` 且数据库有唯一约束 |
| 跨店铺优惠券误用 | Low | `couponUser.shopId` 匹配 + 通用券(shopId=0) |
| 并发领取超发 | Medium | 后端 `receive` 方法已检查 `receive < distribute` |

### Acceptance Criteria

1. 小程序 coupons 页面展示真实的可用优惠券列表
2. 用户可以在 payment 页面选择优惠券，应付金额实时更新
3. 下单时 couponId 正确传递到后端
4. 使用优惠券后，订单金额正确扣减
5. 优惠券使用后状态变为"已使用"
6. 余额支付检查金额基于减去优惠券后的金额
7. 不选择优惠券时，下单流程不受影响

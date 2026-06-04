## Technical Design: MiniApp 订单详情页

### Database Changes
- 无

### API Design
- 复用现有接口：`GET /app-api/order/detail/{key}`
- 接口返回 `AppStoreOrderQueryVo`
- MiniApp 使用 `orderId` 作为主展示标识，`unique` 作为支付和退款等操作补充标识

### MiniApp Changes
- 新增页面：`miniapp/pages/order-detail/`
- `pages/orders/orders` 增加整卡点击跳转
- 详情页复用现有支付、退款跳转能力
- 详情页内部对状态、支付方式、金额信息进行展示态归一化

### Module Impact
- `miniapp/pages/orders`
- `miniapp/pages/order-detail`
- `miniapp/app.json`
- `governance/CONTRACTS.md`

### Sequence Diagram
1. 用户打开订单列表页
2. 点击某条订单进入详情页
3. MiniApp 请求 `/app-api/order/detail/{key}`
4. Backend 返回订单详情
5. MiniApp 渲染详情页
6. 用户可执行继续支付或申请退款

### Risk Assessment
- 中风险：订单状态语义依赖 `statusDto` 与原始字段混用，前端需统一显示规则
- 低风险：页面新增对现有结构侵入较小

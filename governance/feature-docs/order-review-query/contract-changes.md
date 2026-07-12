# Contract Changes: 按订单 ID 查询评价接口

## API

| 属性 | 值 |
|------|-----|
| 端点 | `GET /app-api/order/reply/list` |
| 参数 | `oid` (Long, required) |
| 鉴权 | `@PreAuthenticated`（登录用户即可访问） |
| 响应 | `CommonResult<List<AppStoreProductReplyQueryVo>>` |

### 响应结构（AppStoreProductReplyQueryVo）

```json
[{
  "productScore": 5,
  "serviceScore": 5,
  "comment": "很好喝",
  "merchantReplyContent": "感谢惠顾",
  "merchantReplyTime": "2024-01-01 12:00:00",
  "pictures": "url1,url2",
  "createTime": "2024-01-01 10:00:00",
  "nickname": "用户昵称",
  "avatar": "avatar_url",
  "cartInfo": "{...}"
}]
```

## DB

N/A — 不新增表、不修改表结构

## MQ

N/A

## 权限

App 端：`@PreAuthenticated`（登录即可，无需额外权限码）

## 依赖

无新增依赖

## ADR

N/A — 不涉及架构决策

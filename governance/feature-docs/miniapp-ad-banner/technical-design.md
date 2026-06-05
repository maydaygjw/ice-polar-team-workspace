# 技术设计文档：小程序首页广告轮播

## 架构概览
纯前端改动，后端复用已有 `AppAdController.getList()` API。

## API 契约
```
GET /app-api/ad/list?shop_id=8
```

响应结构（已有）：
```json
{
  "code": 0,
  "data": {
    "list": [
      { "id": 1, "image": "https://.../ad1.jpg" },
      { "id": 2, "image": "https://.../ad2.jpg" }
    ],
    "isActive": true
  },
  "msg": "success"
}
```

## 小程序端改动

### 文件变更清单
| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `miniapp/pages/scan/scan.wxml` | 修改 | 新增轮播广告区域 |
| `miniapp/pages/scan/scan.wxss` | 修改 | 新增轮播广告样式 |
| `miniapp/pages/scan/scan.js` | 修改 | 新增广告数据获取逻辑 |

### 数据模型
```javascript
// scan.js data 新增字段
{
  banners: [],        // 广告图列表
  bannerCurrent: 0    // 当前轮播索引
}
```

### 生命周期
- `onLoad()` / `onShow()`：调用 `fetchBanners()` 获取广告列表
- `onBannerChange(e)`：更新 `bannerCurrent`

### 视觉规范
- 轮播容器：宽度 100%，高度 280rpx，圆角 24rpx
- 图片填充模式：`mode="aspectFill"`
- 指示器：自定义为圆点样式，激活状态使用品牌主色
- 外边距：与品牌头部间距 24rpx，与主内容区间距 24rpx
- 阴影：`0 4rpx 24rpx var(--brand-shadow-card)`

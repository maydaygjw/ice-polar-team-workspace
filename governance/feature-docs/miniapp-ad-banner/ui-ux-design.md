# UI/UX 设计稿：首页广告轮播

## 布局位置

```
┌─────────────────────────────┐
│  品牌头部 (brand-header)     │
├─────────────────────────────┤
│                             │
│  ┌─────────────────────┐    │
│  │   [轮播广告图]        │    │  ← 新增：banner-swiper
│  │   ● ○ ○             │    │
│  └─────────────────────┘    │
│                             │
├─────────────────────────────┤
│  主内容区 (main-content)     │
│  ┌─────────────────────┐    │
│  │   设备连接卡片        │    │
│  └─────────────────────┘    │
└─────────────────────────────┘
```

## 样式规范

### 轮播容器 `.banner-swiper`
- width: 100%
- height: 280rpx
- border-radius: 24rpx
- overflow: hidden
- box-shadow: 0 4rpx 24rpx var(--brand-shadow-card)

### 轮播项 `.banner-item`
- width: 100%
- height: 100%

### 轮播图片 `.banner-image`
- width: 100%
- height: 100%
- border-radius: 24rpx

### 指示器
- 使用 swiper 组件 `indicator-dots` + `indicator-active-color`
- activeColor: `#2196F3` (品牌主色)
- color: `rgba(255,255,255,0.5)`

### 间距
- 与品牌头部间距: margin-top: 24rpx
- 与主内容区间距: margin-bottom: 24rpx

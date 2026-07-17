# UI/UX 设计：店铺删除级联清理

## 变更点

- 管理端店铺列表页删除按钮的确认弹窗。

## 文案

中文：
> 删除店铺将级联删除该店铺下的商品、分类、桌号、广告、预约规则等配置数据，且不可恢复；订单、财务记录和管理员账号将保留。确认继续吗？

English：
> Deleting this shop will also delete its products, categories, tables, ads, appointment rules and other config data, and cannot be undone. Orders, financial records and admin accounts will be kept. Continue?

## 交互

- 使用 `message.confirm`（Element Plus `ElMessageBox.confirm`），类型 `warning`。
- 用户点击"确定"后调用 `ShopApi.deleteShop(id)`；点击"取消"则无任何操作。

## 文件

- `admin/src/views/mall/store/shop/index.vue`
- `admin/src/locales/zh-CN.ts`
- `admin/src/locales/en.ts`

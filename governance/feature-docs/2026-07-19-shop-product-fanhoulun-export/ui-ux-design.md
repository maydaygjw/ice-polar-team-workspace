# UI/UX 增量 — 店铺商品饭火轮模板导出

## 商品管理列表页

- 在「新增」按钮旁增加「导出饭火轮模板」按钮。
- 按钮使用 `type="success" plain`，图标 `ep:download`。
- 按钮受权限 `shop:store-product:export` 控制。
- 点击后先调用 `message.exportConfirm()` 二次确认。
- 导出过程中按钮显示 loading，避免重复提交。

## 导出参数

- 商家账号登录时隐藏门店选择器，导出请求不带 `shopId`，由后端自动取当前登录门店。
- 平台账号登录时，取页面当前选中的 `queryParams.shopId` 作为导出参数。
- 若平台账号未选择门店，点击导出时提示「请选择门店」。

## 下载行为

- 后端返回 `dishes.xls` 二进制流。
- 前端通过 `download.excel(data, 'dishes.xls')` 触发下载。

## 空数据提示

- 即使门店没有普通商品，也允许导出空表头文件，不额外拦截。

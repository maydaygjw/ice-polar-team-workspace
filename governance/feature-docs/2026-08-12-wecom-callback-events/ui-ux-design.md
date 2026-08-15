# 企业微信回调配置 UI 增量

## 表单

- 在企业微信配置弹窗的客户联系 Secret 下增加“客户联系回调”分区。
- Token 与 EncodingAESKey 使用可切换可见性的密码输入框，分别限制为 32 和 43 字符。
- 两项均可留空，但只填写一项或格式不符时阻止提交。
- 编辑时不回显敏感值；`callbackConfigured=true` 时提示“当前已配置，同时留空将保留原值”。

## 列表

- 增加“事件回调”列，以“已配置/未配置”标签展示 `callbackConfigured`。

## 安全与可用性

- 请求 DTO 与响应 DTO 分离，提交时不携带 `secretMasked`、`callbackConfigured` 等只读字段。
- 页面不展示 Token 或 EncodingAESKey 的明文、掩码或片段。

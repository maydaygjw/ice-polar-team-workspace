# 小程序码生成

## Scope / Use Cases
已登录的小程序用户提交 path 和 scene，获得可展示或下载的小程序码图片 URL。本次仅交付后端接口，不调整小程序页面或旧 Base64 接口。

## Business Rules
使用当前租户的小程序主账户生成；图片作为临时文件保存，预期保留 48 小时，实际删除由存储生命周期负责。返回 URL 和预期过期时间。

## Frontend Requirements
调用方携带现有登录凭证和租户上下文；path 是页面路径，参数放在 scene。

## Edge Cases / Acceptance Criteria
- 合法输入成功生成图片并返回可访问 URL。
- path、scene 必填；非法路径、超长或非法 scene 在调用微信前拒绝。
- 未登录不能生成；不同租户使用各自主账户，存储目录按租户隔离。
- 微信或存储失败返回错误，不返回成功空值。
- 不把临时图片登记为永久业务文件。

## Assumptions
2026-09-07 用户确认“按 URL 返回，无补充”。默认 430px，local 环境生成 develop 版本，其他环境生成 release 版本，沿用现有行为。

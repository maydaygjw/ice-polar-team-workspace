# 契约增量

## API
POST `/app-api/mp/miniapp/qrcode`，JSON 请求：
```json
{"path":"pages/index/index","scene":"shopId=123"}
```
path 必填，只接受无前导斜杠、无查询参数的页面路径；scene 为 1–32 个微信允许的可见 ASCII 字符（字母、数字、!#$&'()*+,/:;=?@-._~）。
成功：
```json
{"code":0,"data":{"url":"https://oss.example/temporary/miniapp-qrcode/153/example.png","expiresAt":"2026-09-09T00:00:00Z"},"msg":""}
```
expiresAt 为业务预期过期时间，不表示 URL 在此时精确失效。保留期 48 小时。
使用现有登录鉴权及 tenant-id 上下文，不允许指定其他租户/appId。参数错误沿用统一校验错误；微信生成失败 `1006011000`，上传失败 `1006011001`；账户未配置沿用现有错误。
新增接口，不改变 `/app-api/member/user/generate-mini`。

## 外部调用与存储
复用微信 SDK 4.6.0 的 createWxaCodeUnlimitBytes，path 映射 page，scene 原样传递；430px、透明背景、local→develop，其余→release；沿用 checkPath=false。凭证由租户主账户提供，不接受客户端密钥。
复用 infra-api TemporaryFileApi，目录 `temporary/miniapp-qrcode/{tenantId}`，唯一对象名、不创建文件业务记录。存储配置需要支持图片 URL 读取，并配置临时目录生命周期清理；本次不修改远端配置。应用不额外重试；每次生成独立图片。

# 企业微信商圈欢迎语模板技术设计

## 模块影响

- `backend`：企业微信 API 客户端、欢迎语模板领域、管理端接口、数据库迁移、菜单权限和测试。
- `admin`：企业微信目录下的欢迎语管理列表和编辑表单。
- `miniapp`：N/A，复用 backend 已配置的默认小程序账户，不修改小程序端。
- `icepolar-dms`：N/A。

## 关键决策

### 1. 本地模板作为业务事实来源

本地记录负责保存商圈归属、租户隔离、启用状态和后台展示数据。企业微信图片 URL是后续发送所需的外部素材地址，不作为本地主键。这样未来发送阶段可以直接根据 `account_id + business_region_id` 获取模板。

### 2. 附件类型互斥

模板保留 `attachment_type`，并使用同一张 `local_image_url` 保存图片附件或小程序封面。图片分支保存 `wecom_image_url`；小程序分支保存默认账户 `mini_app_app_id` 和页面 `mini_app_page`，不保存临时素材 ID。服务层拒绝两种分支同时存在或字段不完整。

### 3. 图片上传由后端编排

管理端只把文件提交给后端。后端先校验并保存系统文件，再使用企业微信账号 Secret 获取 access token，调用 `media/uploadimg`。Secret、token和企业微信接口调用细节不进入前端。

### 4. 小程序默认账户与临时素材

默认小程序账户由 `MpAccountService` 按当前租户查询 `is_miapp=1 && is_main=1`，接口只向管理端返回名称和 AppID。管理阶段小程序封面只保存到文件服务；事件发送前使用 `FileApi.getFileContentByUrl(local_image_url)` 调用 `media/upload?type=image`，将新 media_id 放入 `miniprogram.pic_media_id` 并立即发送。

### 5. 发送分支

客户添加事件处理器继续按 `account_id + business_region_id` 读取启用模板：图片使用 `image.pic_url`，小程序使用 `miniprogram.title/name`、`appid`、`page` 和发送前新上传的封面 `pic_media_id`。同一模板只构造一个附件，保持“文字后单附件”。

### 6. 不引入新的 MQ

图片上传必须向管理员返回企业微信素材 URL，且单次图片体积受限，使用同步 HTTP 调用即可。本期不引入异步任务、消息队列或定时补偿。

### 7. 欢迎语发送后的客户标签

欢迎语发送成功后，使用同一企业微信账号为外部联系人添加两个标签：当前商圈代码和当前租户名称。标签名称按企业微信客户标签库全局查询；不存在时创建到“自动标签”标签组，再调用 `externalcontact/mark_tag` 添加。标签处理与欢迎语发送结果独立，标签接口失败只记录告警，不使用同一个 WelcomeCode 重试欢迎语。

## 处理流程

```text
Admin 表单
  → multipart 上传到后端
  → 文件服务保存 local_image_url
  → 企业微信 media/uploadimg
  → 得到 wecom_image_url
  → 保存/更新本地模板
```

## 外部系统策略

- 认证：复用 `WecomApiClient` 的 CorpID + 客户联系 Secret + access token 获取逻辑。
- 超时：沿用现有企业微信 HTTP 客户端超时配置。
- 重试：网络错误最多有限重试；参数、权限、额度和图片校验错误不重试。
- 幂等：本地按租户、企业微信配置、商圈唯一；企业微信图片上传失败时不保存可用模板。
- 日志：记录 accountId、errcode 和错误分类；不记录 Secret、access token 或完整图片二进制。
- 外部 URL：企业微信 `pic_url` 与系统本地文件 URL 分开保存。
- 临时素材：不写入模板数据库；发送时动态上传，避免过期素材被复用。

## 风险

- 企业微信图片 URL不能作为普通站点图片地址，后台预览必须使用本地文件 URL。
- 企业微信图片素材存在企业级数量限制，图片上传失败时直接提示外部错误。
- `WelcomeCode` 具有短时效，发送阶段必须在事件处理器中即时完成，不得在模板保存时发送。

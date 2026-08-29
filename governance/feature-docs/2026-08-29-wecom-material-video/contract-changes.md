# 企业微信素材支持视频契约变更

## 范围

本次变更扩展既有企业微信素材组，不新增接口路径，不影响小程序和 DMS。

## Admin API

企业微信素材统一 DTO 的 `type` 新增 `VIDEO`，并新增 `localVideoUrl` 字段：

- `VIDEO` 必须提交文件服务中的 `localVideoUrl`。
- 视频仅支持 MP4，文件大小必须大于 5 字节且不超过 10MB。
- `localVideoUrl` 由管理端上传组件产生，后端发送前读取文件内容并向企业微信临时上传。
- 素材响应返回 `localVideoUrl`；不返回企业微信临时 `media_id`。

素材组原有规则不变：每组最多一个文字素材、九个非文字素材；视频计入非文字素材数量。

## 企业微信外部 API

- `POST /cgi-bin/media/upload?type=video`：发送群发任务前上传视频，获取本次任务使用的 `media_id`。
- `POST /cgi-bin/externalcontact/add_msg_template`：视频附件形态为
  `{ "msgtype": "video", "video": { "media_id": "MEDIA_ID" } }`。
- `POST /cgi-bin/externalcontact/send_welcome_msg`：使用相同的视频附件形态。

临时 `media_id` 不落库、不返回前端；企业微信素材上传或发送失败时返回现有业务错误结构，并使用视频专用错误码。

## Database

在 `mp_wecom_material` 增加可空字段 `local_video_url`，用于保存文件服务地址。历史数据无需回填。

迁移文件：`backend/sql/upgrade-2026-08-29-wecom-material-video.sql`。

## Machine Contract

实现完成后按治理流程重新生成 `backend/openapi.json` 并收集到 `governance/CONTRACT/backend-api.json`；本次仅增加已有请求/响应模型字段和 `type` 语义，不新增 HTTP 路径。

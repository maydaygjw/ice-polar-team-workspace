# 活动期次更换群活码

## API

### Admin API

`POST /admin-api/activity/period/group-qrcode`：更新指定活动期次的群活码图片快照。

请求体：

```json
{
  "periodId": 123,
  "groupQrcodeImage": "https://oss.example/activity/group-qrcode.png"
}
```

- 权限：`activity:period:update`。
- `periodId` 必须属于当前租户且期次存在。
- `groupQrcodeImage` 必须为非空图片 URL，最大 512 个字符。
- 已结束期次不可更换；未开始或进行中的期次允许更换。
- 只更新期次快照中的群活码图片，不修改活动模板、期次生命周期、报名记录或中奖记录。
- 用户端后续读取该期次详情时返回新的 `groupQrcodeImage`。

成功响应：

```json
{"code":0,"data":true,"msg":"success"}
```

## Frontend behavior

管理后台活动期次列表增加“更换群活码”操作。打开后展示当前群活码预览，并从图片素材库选择一张新图片；保存前要求确认，成功后关闭弹窗并刷新期次列表。

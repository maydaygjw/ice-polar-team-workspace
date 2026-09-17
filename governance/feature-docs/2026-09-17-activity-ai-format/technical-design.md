# 技术设计

管理端调用活动模块 Admin API；活动模块的 AI 服务读取服务端配置，调用百炼文本模型并提取 `choices[0].message.content`。提示词要求只输出可被 WangEditor 接受的 HTML，并保留原文事实、链接和图片。

前端收到结果后在弹窗中用 DOMPurify 展示原文和结果，用户点击应用后才写入 `form.content`。

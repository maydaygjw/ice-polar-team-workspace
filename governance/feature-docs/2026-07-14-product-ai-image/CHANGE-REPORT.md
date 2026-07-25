# Change Report

## 业务结果

商品编辑页封面图旁新增“AI 生成图片”和预览区。后端根据商品名称、简介和详情调用百炼万相同步文生图；用户点击“采用此图片”后，后端下载临时图片、上传 master file client（部署为 OSS）并更新商品封面。

## 影响仓库

- backend：新增 AI 图片接口、百炼 HTTP 客户端、短期采用凭证和配置。
- admin：新增生成、预览、采用交互及 API client。
- governance：新增需求、设计、契约、测试和评审记录，更新跨仓库 API 合同。

## 契约与迁移

- 新增 `generate`、`use` 两个管理端接口。
- 无数据库迁移、无 MQ 主题、无真实密钥。
- 默认模型 `wan2.6-t2i`，同步接口路径可通过环境变量覆盖。

## 验证结果

- Backend 编译通过。
- 百炼同步客户端单元测试 1/1 通过。
- Admin `pnpm build:prod` 通过。
- 真实百炼/OSS E2E 未执行，详见 `test-notes.md`。

## 建议提交信息

`feat(product): add synchronous AI cover image generation`


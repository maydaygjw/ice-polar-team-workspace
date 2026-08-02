# 引流海报技术设计

## 1. 设计目标

本设计实现后台制作企业微信引流海报：同步企业微信已有的永久「联系我」二维码，上传背景图，在前端将二维码叠加到背景图并生成 `1125 × 1500` 的最终图片，保存到现有文件存储。

本期影响 `backend` 和 `admin`，不新增小程序接口或页面，不实现 AI 图片生成。

## 2. 关键决策

### 2.1 模块归属

- 企业微信联系我同步和引流海报业务归属 `yshop-module-mp`，与现有 `wecom-account`、`wecom-customer-group` 保持一致。
- 商圈只作为海报投放范围和数据权限依据。`mp` 不直接依赖 `store-biz`，通过新增/扩展 `store-api` 查询商圈摘要。
- 图片存储复用 `yshop-module-infra` 的 `FileApi`，不直接依赖具体 OSS、MinIO 或本地文件客户端。

### 2.2 前端作为最终编辑和渲染源

- 管理后台使用 Canvas 实时预览背景图和二维码叠加效果。
- 二维码支持拖拽移动和右下角拖拽缩放，坐标和尺寸使用 `1125 × 1500` 原始画布坐标保存。
- 保存时前端将 Canvas 导出为 PNG，先上传 OSS，再把最终图片 URL 和二维码几何参数提交给后端。
- 后端不再读取背景图或二维码、不绘制文字、不做图片合成和二维码解码，只校验 URL、二维码位置/尺寸和业务关联关系。
- 本期不引入 AI 图片处理和新的前端依赖。

### 2.3 二维码快照

- 同步记录使用企业微信 `config_id` 作为唯一业务标识。
- 同步时保存企业微信当前 `qr_code` 信息，并下载一份本地二维码快照供合成使用。
- 海报保存二维码图片快照和 `config_id`；后续同步不会修改历史海报。
- 企业微信删除并重新创建的联系我配置视为新的二维码记录。

### 2.4 同步方式

- 管理员手动点击同步，当前不增加定时任务和 MQ。
- `list_contact_way` 负责分页获得配置 ID，`get_contact_way` 负责读取详情。
- 同步过程按配置逐条处理，单条失败记录原因并继续处理其他配置。
- 同一企业微信账号下使用 `(tenant_id, account_id, config_id)` 做幂等去重。

## 3. 总体流程

```text
Admin
  │
  ├─ 同步联系我
  │      └─ Backend ── list_contact_way ──┐
  │                                      └─ get_contact_way
  │                                            └─ 下载二维码快照 → 文件存储
  │
  ├─ 上传背景图 → 文件存储
  │
  └─ 编辑/保存海报
         └─ Admin Canvas
              ├─ 按 3:4 画布展示背景
              ├─ 叠加联系我二维码
              ├─ 拖拽二维码和调整尺寸
              ├─ 导出 1125 × 1500 PNG
              ├─ 上传最终 PNG 到文件存储
              └─ Backend 保存图片 URL 和几何参数
```

## 4. 模块影响

| 模块 | 影响 | 说明 |
|---|---|---|
| `backend/yshop-module-mp` | 新增业务能力 | 联系我同步、二维码快照、海报 CRUD、图片 URL 和几何参数校验 |
| `backend/yshop-module-mall/yshop-module-store-api` | 扩展 API | 提供商圈摘要和启用状态查询，避免跨模块依赖 `store-biz` |
| `backend/yshop-module-infra-api` | 复用文件上传能力 | 前端上传最终 PNG，后端不读取图片内容 |
| `admin/src/views/mp/wecom` | 新增页面 | 引流海报列表、Canvas 编辑、同步和预览 |
| `miniapp` | 无变化 | 小程序对接延期 |
| `icepolar-dms` | 无变化 | 与设备系统无关 |

## 5. 数据模型

### 5.1 企业微信联系我同步记录

建议表名：`mp_wecom_contact_way`。

| 字段 | 说明 |
|---|---|
| `id` | 主键 |
| `account_id` | 企业微信配置 ID |
| `config_id` | 企业微信联系我配置 ID |
| `qr_code_url` | 企业微信当前二维码地址 |
| `qr_file_url` | 下载后的本地二维码快照地址 |
| `remark` | 企业微信备注 |
| `type` / `scene` | 企业微信联系我类型和场景快照 |
| `user_list` | 使用成员快照 JSON |
| `party_list` | 使用部门快照 JSON |
| `is_temp` | 是否临时会话，永久二维码才允许选择 |
| `status` | 本地可用、失效、同步失败 |
| `last_sync_time` | 最近同步时间 |
| `tenant_id` | 租户编号 |
| `creator/updater/create_time/update_time/deleted` | 通用审计和逻辑删除字段 |

约束和索引：

- 唯一约束：`tenant_id + account_id + config_id`。
- 查询索引：`tenant_id + account_id + status + last_sync_time`。
- `config_id`、二维码地址和 Secret 不在日志中明文输出；Secret 仍只保存在服务端配置/现有账号记录中。

### 5.2 引流海报

建议表名：`mp_wecom_lead_poster`。

| 字段 | 说明 |
|---|---|
| `id` | 主键 |
| `business_region_id` | 投放商圈 ID |
| `contact_way_id` | 本地联系我同步记录 ID |
| `config_id_snapshot` | 生成时的企业微信配置 ID 快照 |
| `background_url` | 原始背景图地址 |
| `main_title` / `sub_title` / `tail_title` | 历史字段，保留数据库兼容性，本期不再维护 |
| `qr_snapshot_url` | 生成时使用的二维码快照地址 |
| `qr_x` / `qr_y` | 二维码左上角在 `1125 × 1500` 画布中的坐标 |
| `qr_size` | 二维码正方形尺寸 |
| `image_url` | 最终海报 OSS 地址 |
| `template_version` | 模板版本，首版为 `v1` |
| `status` | 停用/启用 |
| `sort` | 展示排序 |
| `tenant_id` | 租户编号 |
| `creator/updater/create_time/update_time/deleted` | 通用审计和逻辑删除字段 |

约束和索引：

- 查询索引：`tenant_id + business_region_id + status + sort`。
- 海报记录保留生成快照，不因联系我同步或背景源文件变化而重写历史图片。
- 删除采用逻辑删除；二维码同步记录只有在没有引用时才允许物理清理，首期不做自动清理。

## 6. 前端图片编辑方案

### 6.1 输入标准化

1. 背景图上传后在前端以 `1125 × 1500` 的 Canvas 容器展示，按 3:4 比例 cover，避免拉伸变形。
2. 联系我二维码以图片图层叠加在 Canvas 上，默认提供一个居中尺寸。
3. 拖动二维码更新 `qrX`、`qrY`；拖动右下角控制点更新 `qrSize`，最小尺寸为 `160`，且不能超出画布边界。
4. 编辑已有海报时读取保存的 `qrX`、`qrY`、`qrSize`，恢复二维码位置和大小。
5. 预览辅助框和缩放控制点仅用于编辑，不写入最终图片。

### 6.2 画布坐标

画布使用固定的 `1125 × 1500` 坐标系，背景图作为底图，二维码是唯一可编辑图层。`template_version=v1` 表示当前前端编辑器规则。

初始区域如下，默认值由前端编辑器提供，保存时由后端校验：

| 区域 | 约束 |
|---|---|
| 背景图 | 覆盖整个 `1125 × 1500` 画布 |
| 二维码 | 正方形，位置和尺寸可编辑，不能超出画布 |

后台预览显示二维码编辑框和缩放控制点；系统不分析背景内容，也不自动寻找空白区域。

### 6.3 输出和存储

- 合成顺序：背景 → 二维码。
- Canvas 导出 PNG，尺寸固定为 `1125 × 1500`。
- 前端通过现有文件上传接口保存最终 PNG，获得 OSS URL 后再调用海报 create/update 接口。
- 图片访问地址必须可被后续客户端直接访问，不依赖后台登录态。
- OSS 图片必须允许管理后台以 CORS 方式读取，才能被 Canvas 导出；若跨域限制，前端提示检查 OSS CORS 配置。

## 7. 企业微信同步设计

### 7.1 调用链

- 复用现有 `WecomAccountDO` 的 CorpID 和客户联系 Secret。
- 使用现有 token 获取和缓存策略。
- 调用 `list_contact_way`，处理 `cursor` 直到无下一页。
- 对每个 `config_id` 调用 `get_contact_way`。
- 过滤临时会话、无二维码地址和仅小程序按钮配置。
- 下载二维码、校验图片、保存本地快照，然后幂等更新同步记录。

### 7.2 超时、重试和幂等

- 单次企业微信请求设置连接和读取超时；具体值沿用现有 WecomApiClient 配置，未配置时使用短超时默认值。
- 网络异常和服务端错误允许有限次数重试；权限、参数和配置不存在等业务错误不重试。
- 同一账号同步使用分布式锁，避免并发同步覆盖结果。
- 单条配置失败写入同步结果，不回滚已成功保存的其他配置。
- 企业微信返回的 `config_id` 作为幂等键，不以二维码 URL 作为唯一键。

## 8. API 设计摘要

所有后台接口使用 `/admin-api` 前缀和统一响应结构。

### 8.1 联系我同步接口

| 方法 | 路径 | 作用 |
|---|---|---|
| `POST` | `/admin-api/mp/wecom-contact-way/sync?accountId={id}` | 同步指定企业微信配置 |
| `GET` | `/admin-api/mp/wecom-contact-way/page` | 查询同步记录 |
| `GET` | `/admin-api/mp/wecom-contact-way/simple-list` | 获取可选择二维码 |
| `GET` | `/admin-api/mp/wecom-contact-way/get?id={id}` | 获取二维码详情 |

同步响应包含 `accountId`、`total`、`created`、`updated`、`failed` 和 `failedMessages`。

### 8.2 海报接口

| 方法 | 路径 | 作用 |
|---|---|---|
| `POST` | `/admin-api/mp/wecom-lead-poster/create` | 保存前端生成并上传的海报 |
| `PUT` | `/admin-api/mp/wecom-lead-poster/update` | 保存前端重新编辑并上传的海报 |
| `DELETE` | `/admin-api/mp/wecom-lead-poster/delete?id={id}` | 删除海报 |
| `GET` | `/admin-api/mp/wecom-lead-poster/page` | 分页查询海报 |
| `GET` | `/admin-api/mp/wecom-lead-poster/get?id={id}` | 查询海报详情 |
| `PUT` | `/admin-api/mp/wecom-lead-poster/update-status?id={id}&status={status}` | 启用/停用 |

海报保存请求至少包含：前端已上传的最终 `imageUrl`、`contactWayId`、`businessRegionId`、`backgroundUrl`、`qrX`、`qrY` 和 `qrSize`；模板版本由后端固定为 `frontend-v1`。前端预览不调用后端接口。

## 9. 权限和数据范围

建议权限标识：

- `mp:wecom-lead-poster:query`
- `mp:wecom-lead-poster:create`
- `mp:wecom-lead-poster:update`
- `mp:wecom-lead-poster:delete`
- `mp:wecom-lead-poster:sync`

海报查询和写入必须同时校验：

1. 当前租户；
2. 商圈启用状态；
3. 商圈对应部门数据范围；
4. 联系我二维码属于当前租户和企业微信账号。

## 10. 迁移、兼容和回滚

- 新增迁移脚本：`backend/sql/upgrade-2026-08-02-wecom-lead-poster.sql`。
- 禁止修改 `backend/sql/yixiang-drink.sql`。
- 迁移新增两张业务表及索引，保留完整 `DROP TABLE` 回滚语句；正式执行前确认环境是否允许回滚数据表。
- 不修改现有企业微信账号、客户群和客户联系人表语义。
- 不修改现有小程序广告接口。
- 实现后重新生成 `backend/openapi.json`，再更新 `governance/CONTRACT/backend-api.json`。

## 11. 验证策略

- 后端：同步幂等、分页、权限、商圈校验、图片 URL 和二维码几何参数校验。
- 后台：背景上传、Canvas 拖拽、二维码缩放、编辑回显、导出上传、同步结果和失败状态测试。
- 图片验收：输出尺寸为 `1125 × 1500`、PNG 可打开、二维码可扫描、历史海报不受重新同步影响。
- 构建命令：`(cd backend && mvn -pl yshop-module-mp/yshop-module-mp-biz -am test)`；`(cd admin && pnpm ts:check && pnpm build:prod)`。

## 12. 风险与取舍

- 企业微信历史联系我配置可能无法通过列表接口返回；同步页面需展示接口限制，不能承诺全量历史数据。
- 外部二维码地址不可作为历史图片源；本地快照失败时不允许生成海报。
- 背景构图仍依赖上传素材；通过 3:4 Canvas 预览降低误用，不在本期引入背景自由裁切编辑器。
- Canvas 导出或 OSS 上传失败不能保存海报记录；采用“先上传、后落库”的顺序，异常时记录可清理的孤儿文件日志。

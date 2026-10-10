# NTTU10 引流海报查询失败

- 诊断时间：2026-10-10 09:35–09:42，Asia/Shanghai。
- 环境：生产；已通过生产机 Nginx 配置确认 `yshop-api.holuntech.com` 转发到 8888。
- 状态：根因已确认，未修改业务数据、代码或部署。
- 影响：租户 154、商圈代码 NTTU10 的引流海报查询。

## 证据

接口 GET `/app-api/wecom/lead-poster/get-by-business-region?region_code=NTTU10`，请求头 `tenant-id: 154`，返回 HTTP 200、业务码 `1006010012`、消息“引流海报不存在”。

实际后端为 `yshop-server` 容器，运行 JAR 内 commit 为 `a04747f3fe84fc64cb3dbf7b68416a6c8d7fee48`。通过运行 JAR 配置及进程环境解析数据源，对生产库 `yshop` 执行只读事务。

| 表 | ID | 关联/代码 | status | deleted | 说明 |
|---|---|---|---|---|---|
| business_region | 18 | NTTU10 | 0 | 0 | 南通大学启东校区，当前有效商圈 |
| business_region | 24 | NTTU10 | 0 | 1 | 同名同代码商圈，已逻辑删除 |
| mp_wecom_lead_poster | 12 | business_region_id=24 | 0 | 0 | 已启用、图片非空，但关联已删除商圈 |

以上记录均属于租户 154。该租户现有海报记录中没有关联商圈 18 的海报。

代码路径：`AppWecomLeadPosterController.getByBusinessRegion` → `WecomLeadPosterServiceImpl.getImageUrlByBusinessRegionCode` → `BusinessRegionQueryApiImpl.getEnabledRegionByCode` → `WecomLeadPosterMapper.selectEnabledByBusinessRegionId`。先查有效商圈，再按其 ID 查询启用且图片非空的海报；没有匹配海报即返回上述错误。

## 结论与建议

根因是海报关联商圈错误：请求解析到有效商圈 18，但海报 12 关联已逻辑删除的商圈 24。修正商圈代码或请求头无法解决这条关联错误。

建议管理员确认海报 12 的内容后，在后台将所属商圈重新选择为有效的“南通大学启东校区”（ID 18）并保存，再按原始请求复验。若后台不能操作，交由人工按生产数据修复流程处理，仅调整经确认的关联记录。后续由后端负责人排查商圈删除与海报关联校验，防止残留无效关联。

测试库只作为对照，不作为本结论依据；仓库环境说明与实际域名/进程部署已有漂移。

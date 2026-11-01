# H5 定时开奖未中奖状态诊断与修复

## 发生时间和环境

- 环境：dev，H5 API 租户 `158`
- 请求时间：2026-11-01 23:37（Asia/Shanghai）
- 活动期次：`67`；报名记录：`52`

## 影响与复现

定时开奖完成且当前报名未中奖时，H5 仍显示“等待开奖中”。`my-result` 返回 `winner=false`、`winners=[]`、`drawChancesUsed=1`、`remainingDrawChances=0`。

## 证据

- dev access log 在 2026-11-01 23:37 记录 `/app-api/activity/period/latest` 和 `/app-api/activity/period/my-result?periodId=67` 请求，HTTP 200。
- dev 数据库只读查询：期次 67 的 `draw_mode=1`、`status=2`、`draw_status=2`、`draw_time=2026-11-02 22:00:00`、`draw_time_actual=2026-11-01 23:37:37`、`actual_winner_count=1`。报名 52 有效且 1 次机会已用；其有效中奖记录数为 0。本期有效中奖记录总数为 1，属于其他报名。
- 后端 `getMyResult` 仅在找到该报名对应的中奖记录时置 `winner=true`；`winner=false` 本身不能区分尚未开奖和已开奖未中奖。
- 用户端期次详情 VO 原先没有 `drawStatus`，所以 H5 无法读到期次已开奖状态。期次 `status` 仍为 `2`，旧逻辑因此回到等待页。

## 根因与修复

根因已证实：开奖任务已完成，但用户端期次详情未暴露开奖状态；前端缺少判别“未中奖”所需的期次级状态。

- 在 API 契约中定义用户端期次详情 `drawStatus`（`0` 未开奖、`1` 开奖中、`2` 已开奖、`3` 开奖失败）。
- 后端用户端期次详情响应增加 `drawStatus`，由现有期次实体属性映射。
- H5 定时开奖模式在 `drawStatus=2` 且当前用户无中奖记录时进入未中奖页。

## 部署和验收

- 后端提交：`d9638cd1`；云效运行 `136`，构建和部署阶段均 `SUCCESS`。
- H5 提交：`e602b5f`；云效运行 `65`，构建和部署阶段均 `SUCCESS`。
- 部署后从 dev 服务读取期次 67：业务码 `0`，返回 `drawMode=1`、`status=2`、`drawStatus=2`。
- H5 `/` 与 `/activity.html` 均返回 HTTP 200；部署的活动页面 JS chunk 含 `drawStatus` 判断。

## 执行过的只读操作

检查 dev access log；在只读事务中查询期次、报名和中奖记录；读取部署后用户端详情接口；检查 H5 页面及静态资源状态。未修改数据库或运行环境配置。

## 结果

测试环境后端 API 和 H5 均已部署，接口已返回 `drawStatus=2`。H5 现在可基于期次开奖状态和个人中奖记录显示未中奖页。

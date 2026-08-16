# 技术设计：商圈目的地维护

## 模块影响

- `backend/yshop-module-mall/yshop-module-store-biz`：新增目的地 DO、Mapper、Service、管理端 VO/Controller，并纳入商圈模块部门数据权限规则。
- `admin`：商圈列表增加入口；新增隐藏目的地路由、API client、列表页和表单页。
- `backend/sql`：新增幂等建表和审计字段迁移脚本。

## 关键决策

- 目的地使用独立业务表，主键为 Long，包含 `tenant_id`、`business_region_id` 和派生的 `dept_id`。
- Controller 采用 `/business-region/destination/*`，沿用商圈管理权限 `store:business-region:{query,create,update,delete}`，避免新增侧边栏菜单权限和角色授权迁移。
- 前端目的地页作为隐藏静态路由，由商圈列表按钮带 `businessRegionId` 查询参数打开，因此显示为后台标签页但不出现在侧边栏。
- 代码、标签均为可选文本；排序默认 0，列表按排序升序、ID 降序排列。
- `address` 保存地图取点返回的地址；`detailAddress` 为可选人工填写的详细地址，仅用于记录，不参与地图取点。

## 风险与兼容

- 现有商圈权限角色可直接使用目的地能力；后端仍以接口权限和数据权限为最终边界。
- 现有 `backend` 工作区存在与本功能无关的未提交修改，不触碰该文件。

# 变更报告：商圈目的地维护

## 业务结果

- 商圈管理列表增加“商圈目的地”按钮。
- 点击后在新的后台标签页维护当前商圈的目的地。
- 支持名称、代码、地图地址、标签、排序的新增、编辑、分页查询和删除。

## 影响仓库

- `backend`：目的地 CRUD API、数据权限映射、错误码、数据库迁移和单元测试。
- `admin`：目的地 API client、隐藏标签页路由、列表页和地图表单。
- `governance`：功能规格、契约、设计、测试和审查记录。

## 验证

- Backend 编译通过，目的地服务 2 个单元测试通过。
- Admin 生产构建、Prettier、定向 ESLint 通过。
- Admin `ts:check` 受既有依赖类型入口问题阻塞，详见 `test-notes.md`。

## 建议提交标题

`feat(store): add business region destinations`

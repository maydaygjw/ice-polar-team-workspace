# 商品分类排序调节 — 需求规格

## Scope
后台商品分类列表支持**拖拽调节排序**，排序结果持久化并控制列表展示顺序。
- 仓库:`backend`、`admin`。`miniapp` 不动。
- 不补存量数据(全 0 分类保持)。

## Use Cases
- 运营在分类列表拖拽某行到同级目标位置,落库后列表按新顺序展示。
- 运营仍可在新增/编辑弹窗手动填写排序值。

## Business Rules
- 分类为两级树,排序在**同级**(同 `parentId`)内进行;跨级拖拽禁止。
- 同级拖拽后 `sort` 重排为 `0,1,2…` 连续值,批量落库。
- 列表统一按 `sort ASC, id ASC` 排序(DB 层)。

## Frontend Requirements
- 树表格加拖拽手柄列;sortablejs 挂 `tbody`,限制同级拖移。
- 拖拽结束批量提交受影响同级的 `{id, sort}`。
- 保留弹窗内排序数字框。

## Edge Cases
- 全 0 存量数据:首次拖拽后同级获得连续 sort,其余未动行维持。
- 拖拽到不同 parent:前端禁止。
- 批量提交部分失败:整体事务回滚,前端重新拉取。

## Acceptance Criteria
- 拖拽同级行后刷新,顺序保持。
- 跨级无法拖入。
- 新接口校验空集合/空 id 返回参数错误。
- 列表 DB 排序稳定(sort ASC, id ASC)。

## Assumptions
- 复用 `product:category:update` 权限,不新增菜单/SQL。
- sort 采用连续重排策略。

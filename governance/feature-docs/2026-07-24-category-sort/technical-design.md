# 技术设计 — category-sort

## 模块影响
- backend `yshop-module-product-biz`:category controller / service / vo / mapper。
- admin `views/mall/product/category/index.vue`、`api/mall/product/category.ts`。

## 关键决策
1. **拖拽 = 行拖拽 + 同级批量落库**,不复用单条 update(避免 N 次请求、保证同级连续重排原子性)。
2. **排序口径统一下沉 DB**:Mapper `sort ASC, id ASC`,删控制器内存排序,树父子关系稳定。
3. **sort 连续重排**(同级 0..n),批量 `updateBatchById` 一次覆盖,逻辑最简。
4. **复用 update 权限**,不加菜单/SQL。
5. 前端限制**仅同级拖移**(校验同 parentId),不引入跨级。

## 实现要点
### backend
- VO `ProductCategoryUpdateSortReqVO`(@Data,items @NotEmpty;Item{id @NotNull, sort @NotNull})。
- Controller 新增 `PUT /update-sort`,perm `product:category:update`。
- Service/Impl 新增 `updateCategorySort`,`@Transactional(rollbackFor=Exception.class)`,`updateBatchById`。
- Mapper `selectList` 两条分支 `orderByDesc(getId)` → `orderByAsc(getSort).orderByAsc(getId)`;Controller 删除 `list.sort(...)`。

### admin
- `category.ts` 新增 `updateCategorySort(items)` → PUT `/product/category/update-sort`。
- `index.vue`:
  - 模板加拖拽手柄列(`.drag-icon`)。
  - `onMounted`/`getList` 后用 sortablejs 挂 `tbody`,handle `.drag-icon`。
  - `onEnd` 校验同 parent;重算同级 sort 0..n;收集受影响项调 `updateCategorySort`;成功 `getList()`。
  - 保留 CategoryForm 排序数字框。

## 迁移/回滚
无 DB 迁移。回滚 = revert 两仓库提交。

## 风险
- el-table 树表 + `default-expand-all` 下行拖拽:仅同 `parentId` 行可互换;跨级 onEnd 拦截。
- 全 0 存量:首次拖拽同级重排后正常,未动行保持 0(不主动补)。

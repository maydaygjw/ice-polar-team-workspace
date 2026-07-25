# 契约变化 — category-sort

功能级契约增量,仅展开变化项。

## API(新增)
```
PUT /admin-api/product/category/update-sort
权限: product:category:update  (复用,无新增菜单/SQL)
Request: ProductCategoryUpdateSortReqVO
  items: List<Item>  @NotEmpty
    Item.id:   Long    @NotNull
    Item.sort: Integer @NotNull
Response: CommonResult<Boolean>
```
- Service: `void updateCategorySort(List<ProductCategoryUpdateSortReqVO.Item>)`,`@Transactional`,`updateBatchById`。

## API(行为修正)
```
GET /admin-api/product/category/list
```
- DB 排序由 `id DESC` 改为 `sort ASC, id ASC`;删除控制器内存 `list.sort(...)`。返回字段不变。

## DB
无结构变更。`yshop_store_product_category.sort` 已存在,不新增 `upgrade-*.sql`。

## 权限 / MQ / 依赖 / 外部系统
无变化(复用 update 权限;无 MQ;无新依赖——admin 已有 vuedraggable/sortablejs)。

# 商品不限制库存验证记录

## 验证范围

- 后端库存校验、扣减、恢复路径支持商品/规格/选项 `stock == -1`。
- 管理端商品、规格、选项库存输入允许 `-1`；列表/导入预览展示“不限制库存”。
- 店铺导入支持“不限制库存”开关，开启后导入的商品和规格库存统一为 `-1`。

## 后端编译

```bash
(cd .worktrees/backend-product-unlimited-stock && mvn -pl yshop-module-mall/yshop-module-product-biz,yshop-module-mall/yshop-module-order-biz,yshop-module-mall/yshop-module-store-import-biz -am clean compile -DskipTests)
```

结果：**BUILD SUCCESS**（14.997 s）

## 管理端构建

```bash
(cd .worktrees/admin-product-unlimited-stock && pnpm install --frozen-lockfile && pnpm build:prod)
```

结果：**Build successful**

## 类型检查

```bash
(cd .worktrees/admin-product-unlimited-stock && pnpm ts:check)
```

结果：**失败**，错误为项目预置类型定义缺失，与本次修改无关：
- `Cannot find type definition file for '@intlify/unplugin-vue-i18n/types'`
- `Cannot find type definition file for '@types/qrcode'`
- `Cannot find type definition file for 'element-plus/global'`
- `Cannot find type definition file for 'vite-plugin-svg-icons/client'`

主目录 `admin` 执行同样命令报相同错误，确认非本次引入。

## 单元/E2E 测试

- 未新增/修改单元测试；后端无针对库存的现有单元测试可复用。
- E2E 不在本期范围（`e2e: false`）。

## 验证结论

- 后端编译通过，核心库存路径已按契约改造。
- 管理端生产构建通过；`ts:check` 失败为既有环境问题。

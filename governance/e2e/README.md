# E2E 测试

测试用例位于 `specs/`。API 测试案例位于 `specs/api/`，技术约定见 [`specs/api/README.md`](specs/api/README.md)；页面 E2E 案例例如店铺导入：

```text
specs/features/shop-import/shop-import.spec.ts
```

```bash
# 只运行 API 测试
(cd governance/e2e && npx playwright test specs/api)
```

默认不录制视频。需要录制时设置 `E2E_RECORD_VIDEO=1`；该开关对所有 Playwright 用例生效。

```bash
# 默认运行，不生成视频
(cd governance/e2e && npx playwright test)

# 录制全部用例
(cd governance/e2e && E2E_RECORD_VIDEO=1 npx playwright test)

# 只录制店铺导入案例
(cd governance/e2e && \
  E2E_RECORD_VIDEO=1 \
  E2E_SHOP_IMAGE=/Users/gejunwen/code/holun-team/ice-polar-team-workspace/admin/dist/card01.jpg \
  npx playwright test specs/features/shop-import/shop-import.spec.ts --workers=1)
```

视频输出到 `test-results/videos/`。店铺导入案例还支持 `E2E_HEADLESS=1` 切换为无头浏览器。

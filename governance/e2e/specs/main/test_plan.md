# E2E 测试计划：main 回归

## 环境前置条件

| 条件 | 说明 |
|------|------|
| 目标环境 | `E2E_BASE_URL` 指向可访问的 admin 部署，默认 `https://yshop-admin.holuntech.com/` |
| 测试账号 | 环境变量 `E2E_TENANT`、`E2E_USERNAME`、`E2E_PASSWORD` 提供有效账号 |
| 验证码 | 测试环境需关闭滑块验证码（`VITE_APP_CAPTCHA_ENABLE=false`），否则登录成功用例无法自动完成 |
| 浏览器 | Chromium，中文 locale |

## 用例清单

| 编号 | 用例名称 | 文件 | 状态 |
|------|----------|------|------|
| LOGIN-01 | 账号密码登录成功并进入首页 | `login.spec.ts` | ✅ 已实现 |
| LOGIN-02 | 错误密码登录失败并提示 | `login.spec.ts` | ✅ 已实现 |
| LOGIN-03 | 空字段提交触发表单校验 | `login.spec.ts` | ✅ 已实现 |

## 用例说明

### LOGIN-01 账号密码登录成功并进入首页

1. `page.goto('/login')`
2. 填写租户名、用户名、密码
3. 点击“登录”
4. 断言左侧菜单 `.el-menu--vertical` 可见，且 URL 离开 `/login`

### LOGIN-02 错误密码登录失败并提示

1. 进入 `/login`
2. 填写正确用户名、错误密码
3. 点击“登录”
4. 断言仍停留在 `/login`，且出现 `.el-message--error` 错误提示

### LOGIN-03 空字段提交触发表单校验

1. 进入 `/login`
2. 清空所有输入框
3. 点击“登录”
4. 断言出现 `.el-form-item.is-error` 校验错误样式，且仍停留在 `/login`

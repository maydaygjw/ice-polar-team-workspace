# Change Report

## Business result

- 新增企业微信客户朋友圈第一版能力：文字 + 最多 9 张图片或 1 个链接，选择多个客户管理员创建发表任务。
- 企业微信仍要求客户管理员在客户端确认后完成发表；第一版不支持定时和可见客户筛选。

## Repositories

- `backend`：朋友圈任务表、管理端接口、企业微信 API 调用和图片/链接封面媒体上传。
- `admin`：朋友圈创建页（按素材组选择）、客户管理员多选和任务列表。

## Contracts and migration

- 新增朋友圈任务 API、权限和 `mp_wecom_moment_task` 表。
- 迁移文件：`backend/sql/upgrade-2026-09-11-wecom-customer-moments.sql`。
- 追加迁移：`backend/sql/upgrade-2026-09-12-wecom-customer-moment-link.sql`。

## Verification

- backend 定向 Maven compile：通过。
- `git diff --check`：通过。
- admin `pnpm ts:check`：未通过，仓库已有大量无关类型错误；新增 moment 文件未命中错误。
- 真实企业微信联调、单元测试、API 测试、E2E：未执行。

## Risks

- 当前环境无法创建 submodule worktree 分支；源码变更保留在当前 master 工作目录，未 commit。
- 企业微信外部媒体和异步任务需真实环境验证。

## Suggested PR

`feat(mp): add wecom customer moments`

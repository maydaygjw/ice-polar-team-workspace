---
name: gitee-pr-submit
description: >
  当用户想要提交 Gitee Pull Request（PR）时触发此 skill。
  自动从当前 git 仓库推断 owner、repo、当前分支等信息，基于 commit 历史生成 PR 标题和内容，并调用 Gitee API v5 创建 PR。
  适用于以下场景：用户说"提交 PR"、"创建 Pull Request"、"提个 PR"、"发 PR 到 Gitee"、"帮我开个 PR"、"push 完提 PR"等。
  只要有 Gitee 仓库且需要创建 PR，就应该使用此 skill，即使用户没有明确提到 Gitee。
compatibility:
  - Python 3.x
  - 需要 `requests` 库（pip install requests）
  - 需要 `git` 命令行工具
  - 需要环境变量 `GITEE_ACCESS_TOKEN`
---

# Gitee PR 提交 Skill

## 用途

通过 Gitee API v5 自动创建 Pull Request，减少手动填写 PR 信息的重复劳动。

## 工作流程

1. **检查环境**：确认 `GITEE_ACCESS_TOKEN` 环境变量已设置
2. **提取仓库信息**：从 `git remote -v` 自动解析 owner 和 repo
3. **确定分支**：
   - `head`：当前 git 分支
   - `base`：通过 `git symbolic-ref refs/remotes/origin/HEAD` 自动检测目标分支（通常是 `master` 或 `main`）
4. **生成 PR 内容**：
   - `title`：取最近一条 commit message 的第一行
   - `body`：汇总最近 1-10 条 commit（排除 merge commits），格式为 `- commit message`
5. **调用 API**：POST `https://gitee.com/api/v5/repos/{owner}/{repo}/pulls`
6. **输出结果**：返回 PR 链接和编号

## 使用方法

直接运行脚本：

```bash
python ~/.agents/skills/gitee-pr-submit/scripts/create_pr.py [选项]
```

### 命令行参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--title` | PR 标题 | 最近 commit message 的第一行 |
| `--body` | PR 内容 | 最近 commits 汇总 |
| `--base` | 目标分支 | 自动检测 origin/HEAD |
| `--head` | 源分支 | 当前 git 分支 |
| `--owner` | 仓库 owner | 从 git remote 解析 |
| `--repo` | 仓库名 | 从 git remote 解析 |
| `--draft` | 是否创建为草稿 PR | false |
| `--labels` | 标签，逗号分隔 | 无 |
| `--assignees` | 审查人员，逗号分隔 | 无 |
| `--testers` | 测试人员，逗号分隔 | 无 |
| `--prune-source-branch` | 合并后删除源分支 | false |
| `--issue` | 关联 Issue ID | 无 |
| `--milestone` | 里程碑序号 | 无 |
| `--token` | Gitee access token | `$GITEE_ACCESS_TOKEN` |
| `--commits` | 用于生成 body 的 commit 数量 | 10 |
| `--dry-run` | 只打印请求参数，不实际调用 API | false |

### 示例

```bash
# 全自动创建 PR（最常用）
python ~/.agents/skills/gitee-pr-submit/scripts/create_pr.py

# 指定标题和标签
python ~/.agents/skills/gitee-pr-submit/scripts/create_pr.py --title "feat: 新增用户模块" --labels "feat,backend"

# 创建草稿 PR
python ~/.agents/skills/gitee-pr-submit/scripts/create_pr.py --draft

# 仅预览不提交
python ~/.agents/skills/gitee-pr-submit/scripts/create_pr.py --dry-run
```

## 环境变量

| 变量名 | 说明 | 是否必填 |
|--------|------|----------|
| `GITEE_ACCESS_TOKEN` | Gitee 私人令牌 | 是（或通过 `--token` 传入） |

> 获取方式：Gitee 个人设置 → 私人令牌 → 生成新令牌，勾选 `pull_requests` 权限。

## 支持的 Git Remote 格式

脚本会自动解析以下格式的 remote URL：

- `https://gitee.com/owner/repo.git`
- `https://gitee.com/owner/repo`
- `git@gitee.com:owner/repo.git`
- `git@gitee.com:owner/repo`

## 错误处理

脚本会检查以下常见错误并给出清晰提示：

- 未设置 `GITEE_ACCESS_TOKEN`
- 当前目录不是 git 仓库
- 无法解析 git remote URL
- API 调用失败（返回 HTTP 错误码和响应体）
- head 和 base 分支相同

## API 参考

Gitee API v5 - 创建 Pull Request

```
POST https://gitee.com/api/v5/repos/{owner}/{repo}/pulls
```

**Body 参数：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| access_token | string | 是 | 用户授权码 |
| title | string | 是 | PR 标题 |
| head | string | 是 | 源分支（格式：`branch` 或 `username:branch`） |
| base | string | 是 | 目标分支 |
| body | string | 否 | PR 内容 |
| milestone_number | int | 否 | 里程碑序号 |
| labels | string | 否 | 标签，逗号分隔 |
| issue | string | 否 | 关联 Issue ID |
| assignees | string | 否 | 审查人员，逗号分隔 |
| testers | string | 否 | 测试人员，逗号分隔 |
| assignees_number | int | 否 | 最少审查人数 |
| testers_number | int | 否 | 最少测试人数 |
| ref_pull_request_numbers | string | 否 | 依赖的 PR 编号 |
| prune_source_branch | bool | 否 | 合并后删除源分支 |
| close_related_issue | bool | 否 | 合并后关闭关联 Issue |
| draft | bool | 否 | 是否草稿 |
| squash | bool | 否 | 使用 Squash 合并 |

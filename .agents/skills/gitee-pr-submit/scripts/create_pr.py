#!/usr/bin/env python3
"""
Gitee PR 自动提交脚本

自动从 git 仓库推断信息，调用 Gitee API v5 创建 Pull Request。
"""

import argparse
import json
import os
import re
import subprocess
import sys


def run_git(*args: str) -> str:
    """执行 git 命令并返回输出。"""
    result = subprocess.run(
        ["git", *args],
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    if result.returncode != 0:
        print(f"git 命令失败: git {' '.join(args)}", file=sys.stderr)
        print(f"错误: {result.stderr.strip()}", file=sys.stderr)
        sys.exit(1)
    return result.stdout.strip()


def get_remote_info() -> tuple[str, str]:
    """从 git remote 解析 owner 和 repo。"""
    remote_url = run_git("remote", "get-url", "origin")

    # 支持 https://gitee.com/owner/repo.git
    # 支持 git@gitee.com:owner/repo.git
    patterns = [
        r"https?://gitee\.com/([^/]+)/([^/]+?)(?:\.git)?$",
        r"git@gitee\.com:([^/]+)/([^/]+?)(?:\.git)?$",
    ]

    for pattern in patterns:
        match = re.match(pattern, remote_url)
        if match:
            return match.group(1), match.group(2)

    print(f"无法解析 git remote URL: {remote_url}", file=sys.stderr)
    print("支持的格式: https://gitee.com/owner/repo.git 或 git@gitee.com:owner/repo.git", file=sys.stderr)
    sys.exit(1)


def get_current_branch() -> str:
    """获取当前 git 分支。"""
    return run_git("rev-parse", "--abbrev-ref", "HEAD")


def get_default_base_branch() -> str | None:
    """检测远程默认分支（master/main）。"""
    try:
        result = subprocess.run(
            ["git", "symbolic-ref", "refs/remotes/origin/HEAD"],
            capture_output=True,
            text=True,
            encoding="utf-8",
        )
        if result.returncode == 0:
            ref = result.stdout.strip()
            # refs/remotes/origin/main -> main
            if "/" in ref:
                return ref.split("/")[-1]
    except Exception:
        pass
    return None


def get_recent_commits(n: int = 10) -> list[dict]:
    """获取最近 n 条非 merge commit 的提交信息。"""
    format_str = "%H|%s|%b<END>"
    output = run_git("log", f"-n{n}", f"--format={format_str}", "--no-merges")

    commits = []
    if not output:
        return commits

    # 按 <END> 分割每条 commit
    entries = output.split("<END>")
    for entry in entries:
        entry = entry.strip()
        if not entry:
            continue
        parts = entry.split("|", 2)
        if len(parts) >= 2:
            commits.append({
                "hash": parts[0][:8],
                "subject": parts[1],
                "body": parts[2].strip() if len(parts) > 2 else "",
            })

    return commits


def generate_title(commits: list[dict]) -> str:
    """生成 PR 标题（取最近一条 commit 的 subject）。"""
    if commits:
        return commits[0]["subject"]
    return ""


def generate_body(commits: list[dict]) -> str:
    """生成 PR 内容（汇总 commits）。"""
    if not commits:
        return ""

    lines = []
    for commit in commits:
        lines.append(f"- {commit['subject']}")

    return "\n".join(lines)


def create_pr(
    owner: str,
    repo: str,
    title: str,
    head: str,
    base: str,
    token: str,
    body: str = "",
    draft: bool = False,
    labels: str = "",
    assignees: str = "",
    testers: str = "",
    prune_source_branch: bool = False,
    issue: str = "",
    milestone: str = "",
) -> dict:
    """调用 Gitee API 创建 PR。"""
    import requests

    url = f"https://gitee.com/api/v5/repos/{owner}/{repo}/pulls"

    payload = {
        "access_token": token,
        "title": title,
        "head": head,
        "base": base,
    }

    if body:
        payload["body"] = body
    if draft:
        payload["draft"] = True
    if labels:
        payload["labels"] = labels
    if assignees:
        payload["assignees"] = assignees
    if testers:
        payload["testers"] = testers
    if prune_source_branch:
        payload["prune_source_branch"] = True
    if issue:
        payload["issue"] = issue
    if milestone:
        try:
            payload["milestone_number"] = int(milestone)
        except ValueError:
            print(f"警告: milestone '{milestone}' 不是有效数字，已忽略", file=sys.stderr)

    response = requests.post(url, json=payload, timeout=30)

    if response.status_code == 201:
        return response.json()

    # 处理错误
    try:
        error_data = response.json()
        message = error_data.get("message", str(error_data))
    except Exception:
        message = response.text

    print(f"创建 PR 失败 (HTTP {response.status_code}): {message}", file=sys.stderr)

    # 常见错误提示
    if response.status_code == 401:
        print("提示: access_token 无效或已过期，请检查 GITEE_ACCESS_TOKEN", file=sys.stderr)
    elif response.status_code == 403:
        print("提示: 权限不足，请确认令牌有 pull_requests 权限", file=sys.stderr)
    elif response.status_code == 422:
        if "already exists" in message.lower() or "已存在" in message:
            print("提示: 该分支的 PR 可能已经存在", file=sys.stderr)
        elif "head" in message.lower():
            print("提示: 源分支可能不存在或没有推送", file=sys.stderr)

    sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="自动创建 Gitee Pull Request",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  %(prog)s                           # 全自动创建 PR
  %(prog)s --title "feat: xxx"       # 指定标题
  %(prog)s --draft                   # 创建草稿 PR
  %(prog)s --dry-run                 # 仅预览不提交
        """,
    )

    parser.add_argument("--title", help="PR 标题")
    parser.add_argument("--body", help="PR 内容")
    parser.add_argument("--base", help="目标分支（默认自动检测）")
    parser.add_argument("--head", help="源分支（默认当前分支）")
    parser.add_argument("--owner", help="仓库 owner（默认从 git remote 解析）")
    parser.add_argument("--repo", help="仓库名（默认从 git remote 解析）")
    parser.add_argument("--draft", action="store_true", help="创建为草稿 PR")
    parser.add_argument("--labels", help="标签，逗号分隔")
    parser.add_argument("--assignees", help="审查人员，逗号分隔")
    parser.add_argument("--testers", help="测试人员，逗号分隔")
    parser.add_argument("--prune-source-branch", action="store_true", help="合并后删除源分支")
    parser.add_argument("--issue", help="关联 Issue ID")
    parser.add_argument("--milestone", help="里程碑序号")
    parser.add_argument("--token", help="Gitee access token（默认从 GITEE_ACCESS_TOKEN 环境变量读取）")
    parser.add_argument("--commits", type=int, default=10, help="用于生成 body 的 commit 数量（默认 10）")
    parser.add_argument("--dry-run", action="store_true", help="仅打印参数，不实际调用 API")

    args = parser.parse_args()

    # 1. 检查 token
    token = args.token or os.environ.get("GITEE_ACCESS_TOKEN")
    if not token:
        print("错误: 未设置 Gitee access token", file=sys.stderr)
        print("请设置环境变量 GITEE_ACCESS_TOKEN，或使用 --token 参数", file=sys.stderr)
        print("获取方式: Gitee 个人设置 → 私人令牌 → 生成新令牌", file=sys.stderr)
        sys.exit(1)

    # 2. 确认是 git 仓库
    try:
        run_git("rev-parse", "--git-dir")
    except SystemExit:
        print("错误: 当前目录不是 git 仓库", file=sys.stderr)
        sys.exit(1)

    # 3. 解析 owner 和 repo
    owner = args.owner
    repo = args.repo
    if not owner or not repo:
        owner, repo = get_remote_info()
    if args.owner:
        owner = args.owner
    if args.repo:
        repo = args.repo

    # 4. 确定分支
    head = args.head or get_current_branch()
    base = args.base or get_default_base_branch() or "master"

    if head == base:
        print(f"错误: 源分支和目标分支相同 ({head})", file=sys.stderr)
        print("提示: 请切换到 feature 分支后再执行此命令", file=sys.stderr)
        sys.exit(1)

    # 5. 生成 title 和 body
    commits = get_recent_commits(args.commits)
    title = args.title or generate_title(commits)
    body = args.body or generate_body(commits)

    if not title:
        print("错误: 无法生成 PR 标题", file=sys.stderr)
        sys.exit(1)

    # 6. 打印预览
    print("=" * 50)
    print("PR 预览")
    print("=" * 50)
    print(f"仓库:     {owner}/{repo}")
    print(f"源分支:   {head}")
    print(f"目标分支: {base}")
    print(f"标题:     {title}")
    print(f"草稿:     {'是' if args.draft else '否'}")
    if args.labels:
        print(f"标签:     {args.labels}")
    if args.assignees:
        print(f"审查人员: {args.assignees}")
    if args.testers:
        print(f"测试人员: {args.testers}")
    print("-" * 50)
    print("内容:")
    print(body)
    print("=" * 50)

    if args.dry_run:
        print("\n[干运行模式] 未实际调用 API")
        sys.exit(0)

    # 7. 调用 API
    print("\n正在创建 PR...")
    result = create_pr(
        owner=owner,
        repo=repo,
        title=title,
        head=head,
        base=base,
        token=token,
        body=body,
        draft=args.draft,
        labels=args.labels or "",
        assignees=args.assignees or "",
        testers=args.testers or "",
        prune_source_branch=args.prune_source_branch,
        issue=args.issue or "",
        milestone=args.milestone or "",
    )

    # 8. 输出结果
    pr_number = result.get("number")
    pr_url = result.get("html_url")
    print(f"\n✅ PR 创建成功!")
    print(f"编号: #{pr_number}")
    print(f"链接: {pr_url}")


if __name__ == "__main__":
    main()

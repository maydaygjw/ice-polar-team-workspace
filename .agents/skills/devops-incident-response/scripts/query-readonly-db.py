#!/usr/bin/env python3
"""在只读事务中执行一条参数化 SELECT，并限制输出行数。"""

import json
import os
import re
import sys
from typing import Any, List, Tuple

MAX_ROWS = 200
READ_TIMEOUT_SECONDS = 30
DB_ENV_KEYS = ("DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME")


class InputError(Exception):
    """查询输入格式或安全限制不满足。"""


def read_request() -> Tuple[str, List[Any]]:
    try:
        request = json.load(sys.stdin)
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise InputError("标准输入必须是 JSON 对象。") from exc

    if not isinstance(request, dict):
        raise InputError("JSON 输入必须是对象。")

    sql = request.get("sql")
    params = request.get("params", [])
    if not isinstance(sql, str) or not sql.strip():
        raise InputError("JSON 对象必须包含非空 sql 字符串。")
    if not isinstance(params, list):
        raise InputError("params 必须是 JSON 数组。")

    sql = sql.strip()
    if sql.endswith(";"):
        sql = sql[:-1].rstrip()
    if not re.match(r"(?i)^SELECT\b", sql):
        raise InputError("只允许以 SELECT 开始的单条查询。")
    if ";" in sql:
        raise InputError("不允许多语句查询或 SQL 内部的分号。")
    if re.search(r"(?i)\bINTO\s+(OUTFILE|DUMPFILE)\b|\bFOR\s+UPDATE\b|\bLOCK\s+IN\s+SHARE\s+MODE\b", sql):
        raise InputError("查询包含文件写出或行锁语法，已拒绝执行。")

    return sql, params


def main() -> int:
    try:
        sql, params = read_request()
    except InputError as exc:
        print(f"输入错误：{exc}", file=sys.stderr)
        return 2

    missing_keys = [key for key in DB_ENV_KEYS if not os.environ.get(key)]
    if missing_keys:
        print(f"数据库环境配置不完整：缺少 {', '.join(missing_keys)}。", file=sys.stderr)
        return 2

    try:
        import pymysql
    except ImportError:
        print(
            "缺少 PyMySQL；请按 skill references 中的说明安装 requirements.txt。",
            file=sys.stderr,
        )
        return 2

    connection = None
    try:
        connection = pymysql.connect(
            host=os.environ["DB_HOST"],
            port=int(os.environ.get("DB_PORT", "3306")),
            user=os.environ["DB_USER"],
            password=os.environ["DB_PASSWORD"],
            database=os.environ["DB_NAME"],
            connect_timeout=10,
            read_timeout=READ_TIMEOUT_SECONDS,
            write_timeout=10,
            autocommit=False,
            charset="utf8mb4",
            cursorclass=pymysql.cursors.DictCursor,
        )
        with connection.cursor() as cursor:
            cursor.execute("START TRANSACTION READ ONLY")
            cursor.execute(sql, params if params else None)
            rows = cursor.fetchmany(MAX_ROWS + 1)
        connection.rollback()

        truncated = len(rows) > MAX_ROWS
        result = {
            "rows": rows[:MAX_ROWS],
            "truncated": truncated,
            "maxRows": MAX_ROWS,
        }
        print(json.dumps(result, ensure_ascii=False, default=str))
        return 0
    except Exception as exc:  # Avoid printing SQL, connection details, or driver text.
        if connection is not None:
            try:
                connection.rollback()
            except Exception:
                pass
        sqlstate = getattr(exc, "sqlstate", None)
        error_code = exc.args[0] if getattr(exc, "args", None) else None
        details = [type(exc).__name__]
        if error_code is not None and isinstance(error_code, int):
            details.append(f"code={error_code}")
        if isinstance(sqlstate, str):
            details.append(f"sqlstate={sqlstate}")
        print(f"只读查询失败：{' '.join(details)}。", file=sys.stderr)
        return 1
    finally:
        if connection is not None:
            connection.close()


if __name__ == "__main__":
    sys.exit(main())

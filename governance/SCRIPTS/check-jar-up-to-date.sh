#!/usr/bin/env bash
# 对比远端 git commit 与运行中 JAR 内嵌的 commit，判断是否需要重新打包。
# 退出码：0 = 一致，无需打包；1 = 不一致或 JAR 不存在，需要打包。
#
# 用法（远程执行）：
#   ssh ${DEPLOY_USER}@${SERVER_HOST} "bash -s" < governance/SCRIPTS/check-jar-up-to-date.sh \
#     ${YSHOP_CODE_PATH} ${YSHOP_START_PATH} ${YSHOP_JAR}
#
# 用法（本地调试）：
#   bash governance/SCRIPTS/check-jar-up-to-date.sh /path/to/code /path/to/start yshop-server.jar

set -euo pipefail

source_dir="$1"
start_path="$2"
jar_file="$3"

if [ ! -d "${source_dir}" ]; then
  echo "OUT_OF_DATE: source directory not found: ${source_dir}" >&2
  exit 1
fi

if [ ! -f "${start_path}/target/${jar_file}" ]; then
  echo "OUT_OF_DATE: JAR not found at ${start_path}/target/${jar_file}" >&2
  exit 1
fi

# 远端当前 commit（完整 sha）
remote_commit=$(cd "${source_dir}" && git rev-parse HEAD)

# 从 JAR 内解压出 BOOT-INF/classes/git.properties 中的完整 commit；兼容旧 JAR 的 abbrev 字段。
jar_commit=$(unzip -p "${start_path}/target/${jar_file}" BOOT-INF/classes/git.properties 2>/dev/null \
  | grep '^git.commit.id=' | cut -d= -f2 || true)

if [ -z "${jar_commit}" ]; then
  jar_commit=$(unzip -p "${start_path}/target/${jar_file}" BOOT-INF/classes/git.properties 2>/dev/null \
    | grep '^git.commit.id.abbrev=' | cut -d= -f2 || true)
fi

if [ -n "${jar_commit}" ] && [[ "${remote_commit}" == "${jar_commit}"* ]]; then
  echo "OK: commit ${jar_commit}"
  exit 0
else
  echo "OUT_OF_DATE: remote=${remote_commit}, jar=${jar_commit:-none}" >&2
  exit 1
fi

#!/usr/bin/env bash
set -euo pipefail

# Build a reproducible yshop test artifact.
# Usage:
#   bash governance/SCRIPTS/build-backend-test.sh
#
# The default is intentionally a clean, javac-only build. Set
# ALLOW_DIRTY_BUILD=1 only for local diagnostics; never use it for deployment.
# SKIP_MAVEN_BUILD=1 reuses an existing artifact but still runs every artifact
# and worktree validation below.

workspace_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
backend_path="${workspace_root}/backend"
artifact_path="${backend_path}/yshop-server/target/yshop-server.jar"

command -v java >/dev/null || { echo 'java is required' >&2; exit 1; }
command -v mvn >/dev/null || { echo 'mvn is required' >&2; exit 1; }
command -v unzip >/dev/null || { echo 'unzip is required' >&2; exit 1; }
command -v shasum >/dev/null || { echo 'shasum is required' >&2; exit 1; }

java_version="$(java -version 2>&1 | sed -n '1s/.*version "\([0-9][0-9]*\).*/\1/p')"
if [[ "${java_version}" != "17" ]]; then
  echo "Java 17 is required, found: ${java_version:-unknown}" >&2
  exit 1
fi

cd "${backend_path}"
if [[ "${ALLOW_DIRTY_BUILD:-0}" != "1" ]]; then
  if ! git diff --quiet || ! git diff --cached --quiet || [[ -n "$(git ls-files --others --exclude-standard)" ]]; then
    echo 'Backend worktree is dirty; refuse to build a deployable artifact.' >&2
    git status --short >&2
    exit 1
  fi
fi

source_commit="$(git rev-parse HEAD)"
echo "building backend commit: ${source_commit}"

if [[ "${SKIP_MAVEN_BUILD:-0}" != "1" ]]; then
  # Explicitly disable incremental compilation and force javac. This avoids
  # stale annotation-processor output and compiler error stubs being packaged.
  mvn clean -pl yshop-server -am package -DskipTests \
    -Dmaven.compiler.compilerId=javac \
    -Dmaven.compiler.forceJavacCompilerUse=true \
    -Dmaven.compiler.useIncrementalCompilation=false
else
  echo 'reusing existing backend artifact; running validation only'
fi

test -s "${artifact_path}"
artifact_commit="$(unzip -p "${artifact_path}" BOOT-INF/classes/git.properties \
  | sed -n 's/^git.commit.id.full=//p' | head -1)"
artifact_dirty="$(unzip -p "${artifact_path}" BOOT-INF/classes/git.properties \
  | sed -n 's/^git.dirty=//p' | head -1)"

if [[ "${artifact_commit}" != "${source_commit}" ]]; then
  echo "Artifact commit mismatch: source=${source_commit}, artifact=${artifact_commit:-none}" >&2
  exit 1
fi
if [[ "${artifact_dirty}" != "false" ]]; then
  echo "Artifact was built from a dirty worktree: ${artifact_dirty:-unknown}" >&2
  exit 1
fi

# The bad classes observed in the failed deployment were inside nested Spring
# Boot module JARs, so scanning only the outer JAR is insufficient.
temporary_path="$(mktemp -d "${TMPDIR:-/tmp}/yshop-jar-check.XXXXXX")"
trap 'rm -rf "${temporary_path}"' EXIT
while IFS= read -r nested_entry; do
  nested_file="${temporary_path}/$(basename "${nested_entry}")"
  unzip -p "${artifact_path}" "${nested_entry}" > "${nested_file}"
  if unzip -p "${nested_file}" '*.class' 2>/dev/null \
      | grep -aFq 'Unresolved compilation problems'; then
    echo "Invalid compiler output found in ${nested_entry}" >&2
    exit 1
  fi
done < <(unzip -Z1 "${artifact_path}" | grep '^BOOT-INF/lib/.*\.jar$' || true)

artifact_sha256="$(shasum -a 256 "${artifact_path}" | cut -d ' ' -f1)"
echo "artifact=${artifact_path}"
echo "commit=${artifact_commit}"
echo "sha256=${artifact_sha256}"

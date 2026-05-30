#!/bin/bash
# clone-all.sh — Clone all project repositories

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPOS_DIR="$(dirname "$SCRIPT_DIR")/repos"

echo "=== Cloning all repositories ==="
echo "Target directory: $REPOS_DIR"
echo ""

mkdir -p "$REPOS_DIR"
cd "$REPOS_DIR"

# Backend (Java Spring Boot)
if [ ! -d "backend/.git" ]; then
  echo "[1/3] Cloning backend (yshop-drink)..."
  git clone -b master https://gitee.com/icepolar/yshop-drink.git backend
else
  echo "[1/3] backend already exists, skipping"
fi

# Admin Dashboard (Vue3)
if [ ! -d "admin/.git" ]; then
  echo "[2/3] Cloning admin (yshop-drink-vue)..."
  git clone -b master https://gitee.com/icepolar/yshop-drink-vue.git admin
else
  echo "[2/3] admin already exists, skipping"
fi

# Mini Program (Native WeChat)
if [ ! -d "miniapp/.git" ]; then
  echo "[3/3] Cloning miniapp (icepolarminiapp)..."
  git clone -b main https://gitee.com/icepolar/icepolarminiapp.git miniapp
else
  echo "[3/3] miniapp already exists, skipping"
fi

echo ""
echo "=== Done ==="
echo "Repositories cloned to: $REPOS_DIR"
echo ""
echo "Directory layout:"
echo "  repos/backend/   — Java Spring Boot API"
echo "  repos/admin/     — Vue3 Admin Dashboard"
echo "  repos/miniapp/   — Native WeChat Mini Program"

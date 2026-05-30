# Repos

This directory holds cloned sub-project repositories.

These directories are **gitignored** by the workspace repository — they are independent Git repositories.

## Usage

```bash
# Clone all sub-projects
./scripts/clone-all.sh

# Pull latest changes
./scripts/pull-all.sh

# Check status across all repos
./scripts/status-all.sh
```

## Expected Layout After Clone

```
repos/
├── backend/    — yshop-drink (Java Spring Boot API)
├── admin/      — yshop-drink-vue (Vue3 Admin Dashboard)
└── miniapp/    — icepolarminiapp (Native WeChat Mini Program)
```

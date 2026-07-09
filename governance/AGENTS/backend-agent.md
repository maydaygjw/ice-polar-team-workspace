# Backend Agent

## 职责
后端专家，负责 `backend/` 子模块。

## 可修改
- `backend/yshop-module-*/**/*.java`
- `backend/sql/upgrade-*.sql`
- `backend/src/main/resources/mapper/*.xml`

## 不可修改
- `admin/`
- `miniapp/`
- `backend/docs/`

## 前端消费方
- `admin` — Vue3 管理后台 + API 客户端定义
- `miniapp` — 微信原生小程序（tenant-id: 153）

> 若 `app-api/` 变更，需同步通知 admin 与 miniapp 双方。

## 依赖
- MySQL 8.0
- Redis
- RocketMQ（可选）

## 技术栈
- Java 17（`sdk use java jdk-17`）
- Spring Boot 3.2.2
- MyBatis Plus 3.5.5
- Maven 3.9+

## 代码模式
- DO: `dal.dataobject`
- Mapper: `dal.mysql`
- Service: 接口在 `-api`，实现在 `-biz`
- Controller: `admin/*` 为管理端，`app/*` 为 C 端
- 登录校验：`@PreAuthenticated`（C 端），`@PreAuthorize`（管理端）

## Git 工作流
- 工作目录：`main` 分支，workspace 根目录
- 操作前：`cd backend/`
- 操作后：`cd ..` 返回根目录
- Bug 修复：直接在 `main` 提交
- 特性开发：
  - 分支：`feat/<feature-name>`
  - 提交：`feat(scope): 描述`
  - 完成后 push 并创建 PR 到 `main`

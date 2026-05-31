# Local Development Playbook

## 环境准备

- Java 17+
- Maven 3.8+
- Node.js 16+ / pnpm 8.6+
- 微信开发者工具（小程序开发）

## 项目结构

```
workspace/
├── backend/          # Java Spring Boot (端口 8888)
├── admin/            # Vue3 + Vite (端口 80)
└── miniapp/          # 微信小程序
```

---

## Backend

### 编译

```bash
cd backend
mvn clean compile
```

### 打包

```bash
cd backend
mvn clean package -DskipTests
```

### Install 到本地仓库

修改跨模块代码后必须执行，否则 `mvn spring-boot:run` 会加载本地仓库中的旧 jar：

```bash
cd backend
mvn clean install -DskipTests
```

### 启动（Local Profile）

```bash
cd backend/yshop-server
mvn spring-boot:run
```

- 默认 Profile: `local`
- 端口: `8888`
- 数据库/Redis: 连接远程（配置在 `application-local.yaml`）

### 停止

```bash
lsof -ti:8888 | xargs kill -9
```

---

## Admin (管理后台)

### 安装依赖

```bash
cd admin
pnpm install
```

### 启动（Local 环境）

```bash
cd admin
pnpm dev
```

- 端口: `80`
- 自动加载 `.env.local`，API 指向 `http://localhost:8888`

### 停止

`Ctrl+C` 或关闭终端

---

## Miniapp (微信小程序)

### 开发

1. 打开**微信开发者工具**
2. 导入项目 → 选择 `miniapp/` 目录
3. AppID: `wx4df64c96e6540b4e`
4. 点击**编译**按钮预览

### 注意

- 小程序是原生微信小程序（非 Taro/uni-app），无 build 步骤
- API Base URL: `http://yshop-api.holuntech.com`（生产）或 `http://localhost:8888`（本地需改 `config/config.js`）

---

## 常用组合命令

### 一键重启 Backend（修改代码后）

```bash
cd backend
mvn clean install -DskipTests -q
cd yshop-server
mvn spring-boot:run
```

### 同时启动 Backend + Admin

```bash
# Terminal 1
cd backend/yshop-server
mvn spring-boot:run

# Terminal 2
cd admin
pnpm dev
```

---

## 端口速查

| 服务 | 端口 | 地址 |
|------|------|------|
| Backend | 8888 | http://localhost:8888 |
| Admin | 80 | http://localhost:80 |
| Swagger UI | - | http://localhost:8888/swagger-ui |
| Knife4j | - | http://localhost:8888/doc.html |

---

## 踩坑记录

### `mvn spring-boot:run` 加载的是旧代码

**现象**: 修改了 `yshop-module-system-biz` 或 `yshop-module-member-biz` 等依赖模块的代码，重启后未生效。

**原因**: `mvn spring-boot:run` 对当前模块使用 `target/classes`，但对依赖模块从 Maven 本地仓库加载 jar。如果未 `install`，运行的是旧 jar。

**解决**: 修改跨模块代码后，**必须先 `mvn clean install -DskipTests`**，再启动。

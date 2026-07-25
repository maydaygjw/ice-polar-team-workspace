# 部署记录 — miniapp-phonecode-login（生产环境）

## 概要
| 项 | 值 |
|----|----|
| 环境 | 生产环境（prod） |
| 服务器 | 47.116.198.253 |
| 应用 | yshop 后端（端口 8080，systemd 管理 `yshop.service`，`Restart=on-failure`） |
| 部署分支 | `master`（PR #17 已 squash-merge） |
| 部署 commit | `8fe81df` |
| Profile | `prod` |
| 运行 MainPID | 264769 |
| 部署时间 | 2026-06-29 08:05 CST（周一早间，非高峰） |

## 步骤
1. `git pull origin master`（含 #17，新增 v2 + 旧接口 @Deprecated）
2. 备份旧 JAR（`yshop-server.jar.bak.<时间戳>`）
3. `mvn clean package -DskipTests` → BUILD SUCCESS（2:16）
4. `systemctl restart yshop.service`（systemd 管理，**未用 pkill**，避免 Restart=on-failure 抢占端口）
5. 启动成功：`Started YshopServerApplication in 58.99s`，端口 8080 监听，服务 active

## 冒烟验证（服务器本地 curl）
| 用例 | 结果 | 结论 |
|------|------|------|
| v2 无效 phoneCode | `{"code":1004004002,"msg":"登录失败，请联系管理员"}` | 路由生效，getNewPhoneNoInfo 正确拒绝 |
| v2 缺 phoneCode | `{"code":400,"msg":"请求参数不正确:手机号code不能为空"}` | @NotEmpty 校验生效 |
| 旧 auth-miniapp-login | `http_200` | 旧接口仍存活，存量小程序兼容 |

## 回滚
```bash
systemctl stop yshop.service
cp target/yshop-server.jar.bak.<时间戳> target/yshop-server.jar
systemctl start yshop.service
```
（prod 由 systemd 管理，回滚也必须走 systemctl，禁止 pkill）

## 后续
- 后端双接口已上线，存量旧小程序不受影响，新小程序待 icepolarminiapp PR #15 合并发版后切 v2。
- 待旧版小程序流量归零，再删除旧端点/VO/Service/MiniRedisDAO/MINI_AUTH_LOGIN_BAD2。

# 部署记录 — miniapp-phonecode-login（测试环境）

## 概要
| 项 | 值 |
|----|----|
| 环境 | 测试环境（test） |
| 服务器 | 139.196.173.216 |
| 应用 | yshop 后端（端口 8888，nohup 管理，无 systemd） |
| 部署分支 | `feat/miniapp-phonecode-login` |
| 部署 commit | `56cfcd4` |
| Profile | `dev` |
| 运行 PID | 915871 |
| 部署日期 | 2026-06-28 |

## 步骤
1. 服务器 `git fetch + checkout feat/miniapp-phonecode-login`
2. 备份旧 JAR（`yshop-server.jar.bak.<时间戳>`）
3. `mvn clean package -DskipTests` → BUILD SUCCESS
4. 停旧进程 → `nohup java -jar ... --spring.profiles.active=dev`
5. 启动成功：`Started YshopServerApplication in 61.06s`，端口 8888 监听

## 冒烟验证（服务器本地 curl）
| 用例 | 结果 | 结论 |
|------|------|------|
| v2 无效 phoneCode | `{"code":1004004002,"msg":"登录失败，请联系管理员"}` | 路由生效，getNewPhoneNoInfo 正确拒绝 |
| v2 缺 phoneCode | `{"code":400,"msg":"请求参数不正确:手机号code不能为空"}` | @NotEmpty 校验生效 |
| 旧 auth-miniapp-login | `http_200` | 旧接口仍存活，兼容性 OK |

## 备注
- 部署 SOP 中"systemd 启停"不适用于本测试机（无 yshop.service，nohup 管理）。
- 排查中曾出现 `pgrep -f "java -jar target/yshop-server.jar"` **自匹配 SSH 命令行**的假阳性，已改用 `pgrep -x java` + 端口判断真实状态。后续部署脚本应避免该 pattern 自匹配。
- 回滚：停进程后用 `target/yshop-server.jar.bak.<时间戳>` 覆盖 JAR 重启即可。

# 测试记录

## 已完成单元测试

- `WebviewTicketRedisDAOTest`：验证 60 秒 TTL 和原子 Redis 脚本调用。
- `MemberAuthServiceImplTest`：验证 ticket 保存当前用户/租户、兑换 Token 和无效 ticket 拒绝。

## 验证命令

已执行：

```bash
mvn -pl yshop-module-member/yshop-module-member-biz -am test
```

实际执行为定向测试：

```bash
mvn -pl yshop-module-member/yshop-module-member-biz -am \
  -Dtest=MemberAuthServiceImplTest,WebviewTicketRedisDAOTest \
  -Dsurefire.failIfNoSpecifiedTests=false test
```

结果：5 个测试通过。

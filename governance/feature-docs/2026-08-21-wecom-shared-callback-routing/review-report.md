# Review Report

## Scope

- 审查 CorpID 回调入口、State 租户/商圈路由、同 CorpID 凭据一致性校验、账号元数据字段和管理端展示。

## Findings

- 未发现阻塞性问题。
- 回调入口在解密前使用 CorpID 选择配置；解密后只接受 `v1:t{tenantId}:r{businessRegionId}`，并在目标租户上下文中查询账号和启用商圈。
- 同一 CorpID 的多条配置若凭据不一致会拒绝处理，避免静默使用错误应用。
- 迁移脚本使用动态 DDL 兼容重复执行，不修改现有密钥和租户内 CorpID 唯一约束。

## Residual Risks

- 上线前必须在企业微信管理后台把回调 URL 切换为 `/app-api/mp/wecom/callback/{corpId}`，并重新生成或更新旧联系我配置，使 State 写入新格式。
- 同一 CorpID 仍只支持一个欢迎语回调应用；同企业多应用并行需要另行设计应用级路由。

## Conclusion

通过审查，建议进入交付前验证；不包含 commit、push 或部署动作。

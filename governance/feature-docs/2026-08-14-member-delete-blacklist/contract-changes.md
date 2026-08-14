# 会员删除与拉黑契约变更

## 变更范围

- 管理后台会员列表增加删除、拉黑和解除拉黑操作。
- 复用 `yshop_user.status`：`0` 表示正常，`1` 表示已拉黑/禁用，与 `CommonStatusEnum` 保持一致。
- 拉黑会员后，密码、短信、微信小程序、微信公众号登录以及刷新令牌均不得创建可用令牌。
- 拉黑操作同时撤销该会员已有的访问令牌和刷新令牌。
- 删除会员继续使用现有删除接口；删除是高风险操作，前端必须二次确认并受删除权限控制。

## API

### 更新会员状态

`PUT /admin-api/member/user/update-status`

请求体：

```json
{
  "id": 45,
  "status": 1
}
```

- `id`: 会员 ID，Long，必填。
- `status`: `0` 正常，`1` 拉黑，必填。
- 权限：`member:user:update`。
- 返回：通用 Boolean 结果。

### 既有删除接口

`DELETE /admin-api/member/user/delete?id={id}`

- 权限：`member:user:delete`。
- 返回：通用 Boolean 结果。

## 认证语义

会员状态校验必须发生在所有会员认证流程创建或刷新令牌之前。已拉黑会员的已有 OAuth2 访问令牌和刷新令牌在管理端执行拉黑时一并撤销。

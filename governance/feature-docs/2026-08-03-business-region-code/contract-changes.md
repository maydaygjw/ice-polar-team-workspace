# 商圈代码字段 — Contract Changes

## 变更范围

为商圈管理增加 `code`（商圈代码）字段，影响 backend 与 admin 两个仓库。

## 管理后台 API

以下接口的商圈对象增加字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `code` | string | 否 | 商圈代码，最长 64 个字符；历史商圈可为空 |

- `POST /admin-api/business-region/create`：支持提交 `code`。
- `PUT /admin-api/business-region/update`：支持更新 `code`。
- `GET /admin-api/business-region/page`：支持按 `code` 模糊查询，响应项返回 `code`。
- `GET /admin-api/business-region/get`：响应返回 `code`。
- `GET /admin-api/business-region/simple-list`：响应返回 `code`。

本次不新增商圈代码的格式或租户内唯一性约束。

## 数据库

- `business_region.code`：`varchar(64)`，可空，注释为“商圈代码”。
- 增加租户与代码联合索引，服务于管理端查询。
- 使用独立的幂等升级脚本，不修改基线 SQL。

# 用户地址接口（App 端）

> 前端对接文档。所有接口统一返回 `CommonResult`：`{ code, msg, data }`，`code = 0` 表示成功，非 0 时 `msg` 为错误文案，直接 toast 即可。
>
> 除「城市列表」外均需登录，请求头：`Authorization: Bearer <token>`。
>
> 源码：`backend/yshop-module-member/.../controller/app/address/AppUserAddressController.java`

| 方法 | 路径 | 说明 | 需要登录 |
|------|------|------|:---:|
| GET | `/app-api/address/list` | 地址列表 | ✅ |
| POST | `/app-api/address/addAndEdit` | 添加或修改地址 | ✅ |
| POST | `/app-api/address/del/{id}` | 删除地址 | ✅ |
| POST | `/app-api/address/default/set/{id}` | 设置默认地址 | ✅ |
| GET | `/app-api/address/city_list` | 城市列表（省市区三级树） | ❌ |

---

## 1. 地址列表 `GET /app-api/address/list`

**Query 参数**

| 参数 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| page | int | 否 | 1 | 页码 |
| limit | int | 否 | 10 | 每页条数 |

返回当前登录用户的地址数组，只含当前页数据，**无 total 字段**。「加载更多」可用返回数组长度 < limit 判断到底。

**响应样例**

```json
{
  "code": 0,
  "msg": "",
  "data": [
    {
      "id": 24169,
      "uid": 1001,
      "realName": "张三",
      "phone": "13800138000",
      "address": "浙江省杭州市西湖区",
      "province": "浙江省",
      "city": "杭州市",
      "district": "西湖区",
      "detail": "文三路 100 号 1 幢 502",
      "longitude": "120.15507",
      "latitude": "30.27415",
      "isDefault": 1
    }
  ]
}
```

- `isDefault`：1 = 默认，0 = 否。
- 空列表时 `data: []`。

---

## 2. 添加或修改地址 `POST /app-api/address/addAndEdit`

同一个接口：`id` 传空/不传 = 新增，传值 = 修改。Content-Type: `application/json`。

**Body（AppAddressParam）**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 否 | 地址 ID；空串/不传 = 新增 |
| realName | string | **是** | 收货人姓名，1–30 字 |
| phone | string | **是** | 收货手机号 |
| address | string | 否 | 省市区拼接文本（如"浙江省杭州市西湖区"） |
| detail | string | **是** | 详细地址（街道门牌），1–60 字 |
| province | string | 否 | 省 |
| city | string | 否 | 市 |
| district | string | 否 | 区 |
| postCode | string | 否 | 邮编 |
| longitude | string | 否 | 经度 |
| latitude | string | 否 | 纬度 |
| isDefault | int | 否 | 1 = 默认，0 = 否 |

**请求样例**

```json
{
  "id": "",
  "realName": "张三",
  "phone": "13800138000",
  "address": "浙江省杭州市西湖区",
  "detail": "文三路 100 号 1 幢 502",
  "province": "浙江省",
  "city": "杭州市",
  "district": "西湖区",
  "postCode": "310000",
  "longitude": "120.15507",
  "latitude": "30.27415",
  "isDefault": 1
}
```

**响应**：`data` 为地址 ID。

```json
{ "code": 0, "data": 24169, "msg": "" }
```

**后端行为注意**

1. 传 `isDefault=1` 时，后端先把该用户所有地址置为非默认再保存，默认地址唯一。
2. 修改走 `updateById`：字段传 null 不会覆盖旧值（无法清空）；`province/city/district` 不传则保留旧值。

---

## 3. 删除地址 `POST /app-api/address/del/{id}`

路径参数 `id` 为地址 ID，无 body。

```bash
curl -X POST 'https://<host>/app-api/address/del/24169' \
  -H 'Authorization: Bearer <token>'
```

**响应**

```json
{ "code": 0, "data": true, "msg": "" }
```

`id` 为空或非数字时报参数错误（`USER_ADDRESS_PARAM_NOT_EXISTS`）。

---

## 4. 设置默认地址 `POST /app-api/address/default/set/{id}`

路径参数 `id` 为要设为默认的地址 ID，无 body。后端先把该用户其他地址全部置为非默认，再把该地址置为默认。

```bash
curl -X POST 'https://<host>/app-api/address/default/set/24169' \
  -H 'Authorization: Bearer <token>'
```

**响应**

```json
{ "code": 0, "data": true, "msg": "" }
```

---

## 5. 城市列表 `GET /app-api/address/city_list`

**无需登录**。返回中国省市区三级树，叶子节点无 `children`。

**响应样例**（截取）

```json
{
  "code": 0,
  "msg": "",
  "data": [
    {
      "id": 110000,
      "name": "北京",
      "children": [
        {
          "id": 110100,
          "name": "北京市",
          "children": [
            { "id": 110101, "name": "东城区" },
            { "id": 110102, "name": "西城区" }
          ]
        }
      ]
    },
    { "id": 330000, "name": "浙江省", "children": [] }
  ]
}
```

- `id` 为行政区划代码（int），`name` 为地区名。
- 适合三级联动选择器；选择后前端自行拼接 `address` 并拆出 `province/city/district` 提交给 `addAndEdit`。

---

## 对接提示

- 编辑场景：先调 `list` 拿地址对象回填表单，提交 `addAndEdit` 时带 `id`。
- 本地启动后端后可在线查看 API 文档：`http://localhost:8888/doc.html`。

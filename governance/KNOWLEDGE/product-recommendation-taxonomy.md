# 商品推荐标准分类库参考

## 文档定位

本文档为餐饮、饮品商品推荐提供商品标准化和用户属性归一化参考，不是最终数据库设计或 API 契约。

分类体系按以下顺序使用：

1. **主类目分类标准**：定义商品所属的业务分类。
2. **食材分类标准**：定义商品包含的主要食材及其层级。
3. **商品标准属性库**：基于前两项进行精简归类，并补充商品自身的描述、经营和评价属性。
4. **用户属性**：一部分属性映射到商品标准属性库，用于匹配推荐；另一部分描述用户自身特征和活跃度。

## 一、主类目分类标准

主类目用于商品的业务归类、召回覆盖和统计。商品可以有一个主类目和必要的层级类目，但不应通过主类目承载所有推荐语义。

```text
餐饮商品
├── 饮品
│   ├── 茶饮
│   │   ├── 纯茶
│   │   ├── 奶茶
│   │   ├── 水果茶
│   │   ├── 芝士茶
│   │   └── 茶拿铁
│   ├── 咖啡
│   │   ├── 美式
│   │   ├── 拿铁
│   │   ├── 卡布奇诺
│   │   ├── 摩卡
│   │   ├── 冷萃
│   │   └── 手冲
│   ├── 果饮
│   │   ├── 果汁
│   │   ├── 鲜榨果饮
│   │   ├── 气泡果饮
│   │   └── 酸奶果饮
│   ├── 乳饮
│   │   ├── 牛奶
│   │   ├── 酸奶
│   │   └── 奶昔
│   ├── 碳酸饮料
│   ├── 包装水
│   └── 功能饮品
├── 主食
│   ├── 米饭/盖饭
│   ├── 炒饭
│   ├── 面条
│   ├── 米粉
│   ├── 汉堡
│   ├── 三明治
│   └── 卷类
├── 菜品
│   ├── 家常菜
│   ├── 川湘菜
│   ├── 粤菜
│   ├── 日韩料理
│   ├── 东南亚菜
│   ├── 海鲜
│   └── 汤/粥
├── 小吃
│   ├── 炸物
│   ├── 烧烤
│   ├── 卤味
│   ├── 饺子/馄饨
│   ├── 包子/点心
│   └── 小食拼盘
├── 甜品烘焙
│   ├── 蛋糕
│   ├── 面包
│   ├── 冰淇淋
│   ├── 布丁
│   ├── 糖水
│   └── 水果捞
└── 套餐
    ├── 单人套餐
    ├── 双人套餐
    ├── 家庭套餐
    └── 饮品套餐
```

## 二、食材分类标准

食材分类用于描述商品的主要构成。一个商品可以关联多个食材，并区分主食材和辅助食材；食材名称、别名和同义词应统一映射到标准食材。

```text
食材
├── 肉类
│   ├── 猪肉
│   ├── 牛肉
│   ├── 羊肉
│   └── 鸡肉/鸭肉
├── 海鲜
│   ├── 虾
│   ├── 鱼
│   ├── 蟹
│   └── 贝类
├── 蛋奶
│   ├── 鸡蛋
│   ├── 牛奶
│   ├── 芝士
│   └── 酸奶
├── 蔬菜
│   ├── 叶菜
│   ├── 菌菇
│   ├── 根茎
│   └── 茄果
├── 水果
│   ├── 芒果
│   ├── 草莓
│   ├── 柠檬
│   ├── 西瓜
│   └── 橙/柚
├── 主食
│   ├── 米
│   ├── 面
│   ├── 粉
│   └── 面包
└── 调味与饮品原料
    ├── 茶叶
    ├── 咖啡豆
    ├── 糖浆
    ├── 坚果
    └── 香辛料
```

商品名称或配方无法确认食材时，应保留“未知”及其置信度，不应仅凭名称强行推断。过敏原、饮食限制等安全相关信息优先使用商家确认或结构化配方数据。

## 三、商品标准属性库

商品标准属性库是对前两类标准的业务化精简：

- `standard_category` 从主类目树映射为有限的标准类目，便于召回、统计和跨店铺比较。
- `standard_ingredients` 从食材分类树映射为有限的核心食材组，支持多选，并保留主食材标记。
- `taste_profile`、`price_range` 和 `consumption_scene` 与标准类目、核心食材组一样，属于商品标准分类，用于跨商品和用户属性匹配。
- 商品名称、商品描述、上架时间、销量、折扣和评分均属于商品业务属性；它们可以用于检索、排序或展示，但不等同于标准分类。

### 3.1 基于主类目和食材的精简分类

| 属性 | English key | 标准值示例 |
|---|---|---|
| 标准类目 | `standard_category` | 快餐简餐 `fast_food_simple_meal`、中式正餐/地方菜 `chinese_local_cuisine`、面食米粉 `noodle_rice`、火锅串串 `hotpot_skewers`、烧烤炸物小吃 `bbq_fried_snacks`、汉堡披萨西餐 `burger_pizza_western`、日韩/异国料理 `japanese_korean_international`、饮品 `drinks`、甜品烘焙 `desserts_bakery`、水果生鲜商超 `fresh_grocery_other` |
| 核心食材组 | `standard_ingredients` | 谷物米面 `grains_rice_noodles`、猪肉 `pork`、牛羊肉 `beef_lamb`、禽肉 `poultry`、海鲜水产 `seafood_aquatic`、蛋奶乳制品 `egg_dairy`、蔬菜菌菇 `vegetables_mushrooms`、水果 `fruit`、豆制品坚果 `soy_nuts`、茶咖啡及饮品原料 `tea_coffee_beverage_base` |
| 口味风味 | `taste_profile` | 咸香/酱香 `savory_sauce`、鲜香/清鲜 `fresh_umami`、香辣 `fragrant_spicy`、麻辣/椒麻 `mala_numbing_spicy`、酸辣 `sour_spicy`、酸甜 `sweet_sour`、甜香 `sweet_aroma`、清淡/原味 `light_original`、奶香/芝士 `creamy_cheesy`、果香/茶香/咖啡香 `fruity_tea_coffee` |
| 价格区间 | `price_range` | 0–10 元 `0_10`、10–15 元 `10_15`、15–20 元 `15_20`、20–25 元 `20_25`、25–30 元 `25_30`、30–50 元 `30_50`、50–80 元 `50_80`、80–120 元 `80_120`、120–300 元 `120_300`、300 元以上 `300_plus` |
| 消费场景 | `consumption_scene` | 早餐 `breakfast`、午餐 `lunch`、下午茶 `afternoon_tea`、晚餐 `dinner`、夜宵 `late_night`、独食简餐 `solo_meal`、办公工作餐 `office_meal`、家庭用餐 `family_meal`、聚餐多人 `group_dining`、约会庆祝 `date_celebration` |

上述标准分类用于商品与用户属性的统一匹配。具体的二级类目和食材叶子节点仍应回溯到前两节的标准 ID；商品可以同时拥有多个核心食材，并标记 `primary` 主食材和 `secondary` 辅助食材。

### 3.2 商品业务属性

| 中文属性 | English key | 类型/取值 | 主要用途 |
|---|---|---|---|
| 商品名称 | `product_name` | 商品实际填写的名称字符串 | 检索和展示 |
| 商品描述 | `product_description` | 商品实际填写的描述文本 | 展示商品卖点和组成信息 |
| 上架时间 | `listed_at` | 时间戳 | 新品识别、时间衰减和排序 |
| 月销量 | `monthly_sales` | 非负整数，按约定统计窗口计算 | 热度排序和趋势判断 |
| 是否折扣 | `is_discounted` | 布尔值 | 促销召回和排序 |
| 店铺评分 | `shop_rating` | 数值，如 0–5 分 | 店铺质量排序和过滤 |
| 商品评分 | `product_rating` | 数值，如 0–5 分 | 商品质量排序和过滤 |

商品名称、商品描述、规格、价格和店铺信息应按商家实际填写保留；标准化只作用于类目、食材和推荐标签。例如：

```text
商品名称：超大杯冰霸芒果芝芝
商品描述：冰饮芒果茶搭配芝士奶盖，突出芒果果香与奶香口感。
标准类目：饮品 > 茶饮 > 水果茶
核心食材组：水果、蛋奶乳制品、茶咖啡及饮品原料
标准标签：芒果、芝士、果香、甜、冷饮、下午茶
商品属性：上架时间、月销量、是否折扣、店铺评分、商品评分
```

商品 JSON 示例：

```json
{
  "product_name": "超大杯冰霸芒果芝芝",
  "product_description": "冰饮芒果茶搭配芝士奶盖，突出芒果果香与奶香口感。",
  "standard_category": "drinks",
  "standard_ingredients": [
    "fruit",
    "egg_dairy",
    "tea_coffee_beverage_base"
  ],
  "taste_profile": [
    "sweet_aroma",
    "fruity_tea_coffee",
    "creamy_cheesy"
  ],
  "price_range": "10_15",
  "consumption_scene": ["afternoon_tea", "office_meal"],
  "listed_at": "2026-08-01T10:00:00+08:00",
  "monthly_sales": 1280,
  "is_discounted": true,
  "shop_rating": 4.8,
  "product_rating": 4.7
}
```

### 3.3 用户自身属性

用户自身属性不映射为商品标签，但可用于用户分群、活跃度判断、推荐频率控制和排序特征。

| 中文属性 | English key | 类型/说明 |
|---|---|---|
| 性别 | `gender` | 枚举或未知；不得据此推断具体口味 |
| 注册时间 | `registered_at` | 时间戳，可进一步计算注册天数 |
| 月订单数 | `monthly_order_count` | 统计窗口内的订单数 |
| 周订单数 | `weekly_order_count` | 统计窗口内的订单数 |
| 总订单数 | `total_order_count` | 用户累计有效订单数 |
| 当天订单数 | `today_order_count` | 当天有效订单数，可用于频控和场景判断 |

示例：

映射型属性只记录 `confidence`，表示系统对该属性判断的可信程度，取值范围为 `0`–`1`。

```json
{
  "profile": {
    "gender": "unknown",
    "registered_at": "2026-01-15T10:00:00+08:00",
    "monthly_order_count": 8,
    "weekly_order_count": 3,
    "total_order_count": 42,
    "today_order_count": 1
  },
  "mapped_attributes": [
    {"dimension": "standard_category", "value": "drinks", "sentiment": "positive", "confidence": 0.8},
    {
      "dimension": "standard_ingredients",
      "value": [
        {"value": "fruit", "sentiment": "positive", "confidence": 0.7},
        {"value": "soy_nuts", "sentiment": "negative", "confidence": 0.9}
      ]
    },
    {"dimension": "taste_profile", "value": "sweet_aroma", "sentiment": "positive", "confidence": 0.6},
    {"dimension": "price_range", "value": "10_15", "sentiment": "positive", "confidence": 0.5},
    {"dimension": "consumption_scene", "value": "afternoon_tea", "sentiment": "positive", "confidence": 0.6}
  ]
}
```

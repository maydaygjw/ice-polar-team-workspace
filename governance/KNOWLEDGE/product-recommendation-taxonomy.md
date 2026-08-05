# 商品推荐标准分类库参考

## 文档定位

本文档为餐饮、饮品商品推荐提供商品标准化和用户偏好归一化参考，不是最终数据库设计或 API 契约。

分类体系参考美团公开的美食知识图谱思路，将商品信息拆分为类目、标准商品名、基础属性和业务主题属性四类；具体分类根据本系统的餐饮、饮品业务进行裁剪和扩展。

参考：[美团技术团队：美团外卖美食知识图谱的迭代及应用](https://tech.meituan.com/2021/05/27/Food-Knowledge-Graph.html)

## 一、主类目树

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

## 二、商品标准属性库

商品不应只有一个主类目，应允许使用多个正交标签。

| 中文属性 | English key | 10 个标准值（中文 / English） |
|---|---|---|
| 类目 | `category` | 快餐简餐 `fast_food_simple_meal`、中式正餐/地方菜 `chinese_local_cuisine`、面食米粉 `noodle_rice`、火锅串串 `hotpot_skewers`、烧烤炸物小吃 `bbq_fried_snacks`（烧烤、炸物、卤味）、汉堡披萨西餐 `burger_pizza_western`、日韩/异国料理 `japanese_korean_international`、饮品 `drinks`（奶茶、咖啡、果饮）、甜品烘焙 `desserts_bakery`、水果生鲜商超 `fresh_grocery_other` |
| 核心食材 | `ingredients` | 谷物米面 `grains_rice_noodles`、猪肉 `pork`、牛羊肉 `beef_lamb`、禽肉 `poultry`、海鲜水产 `seafood_aquatic`、蛋奶乳制品 `egg_dairy`、蔬菜菌菇 `vegetables_mushrooms`、水果 `fruit`、豆制品坚果 `soy_nuts`、茶咖啡及饮品原料 `tea_coffee_beverage_base` |
| 口味风味 | `taste_profile` | 咸香/酱香 `savory_sauce`、鲜香/清鲜 `fresh_umami`、香辣 `fragrant_spicy`、麻辣/椒麻 `mala_numbing_spicy`、酸辣 `sour_spicy`、酸甜 `sweet_sour`、甜香 `sweet_aroma`、清淡/原味 `light_original`、奶香/芝士 `creamy_cheesy`、果香/茶香/咖啡香 `fruity_tea_coffee` |
| 价格区间 | `price_range` | 0–10 元 `0_10`、10–15 元 `10_15`、15–20 元 `15_20`、20–25 元 `20_25`、25–30 元 `25_30`、30–50 元 `30_50`、50–80 元 `50_80`、80–120 元 `80_120`、120–300 元 `120_300`、300 元以上 `300_plus` |
| 消费场景 | `consumption_scene` | 早餐 `breakfast`、午餐 `lunch`、下午茶 `afternoon_tea`、晚餐 `dinner`、夜宵 `late_night`、独食简餐 `solo_meal`、办公工作餐 `office_meal`、家庭用餐 `family_meal`、聚餐多人 `group_dining`、约会庆祝 `date_celebration` |

`standard_product_name` 仅用于商品标准化和同品聚合，不作为核心推荐属性。过敏原、饮食限制、库存、上下架、营业状态和配送资格属于硬性过滤条件，不参与普通推荐权重。

商品名称和标准商品名分开保存：

```text
商家商品名：超大杯冰霸芒果芝芝
标准商品名：芒果芝士茶
标准类目：饮品 > 茶饮 > 水果茶
标准标签：芒果、芝士、果香、甜、冷饮、下午茶
```

## 三、食材分类库

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

## 四、用户偏好库

用户偏好不要只保存“喜欢某个商品”，而应映射到商品使用的标准标签：

```json
{
  "positive_preferences": [
    {"dimension": "category", "value": "茶饮", "weight": 0.8},
    {"dimension": "ingredients", "value": "芒果", "weight": 0.7},
    {"dimension": "taste_profile", "value": "甜香", "weight": 0.6}
  ],
  "negative_preferences": [
    {"dimension": "ingredients", "value": "花生", "weight": 0.9},
    {"dimension": "taste_profile", "value": "香辣", "weight": 0.8}
  ],
  "constraints": [
    {"dimension": "sugar", "value": "无糖或低糖"},
    {"dimension": "price_range", "value": "15-25元"}
  ]
}
```

用户偏好来源可信度建议按以下顺序处理：

```text
主动选择偏好 > 购买 > 加购 > 收藏 > 点击 > 曝光
```

每条偏好至少记录：

- `source`：explicit / order / cart / favorite / click；
- `weight`：偏好强度；
- `confidence`：置信度；
- `last_seen_at`：最近发生时间；
- `decay_rate`：偏好衰减速度；
- `positive / negative`：喜欢或排斥。

## 五、标准化规则

1. 商家原始名称、描述和规格必须保留，标准化结果单独维护。
2. 一个商品可以有多个食材、口味、风味和场景标签。
3. 同义词和别名应映射到同一个标准标签，例如“芝芝”“芝士”“奶盖”可以归入相应的芝士/奶盖标签体系。
4. 商品标准标签与用户偏好必须引用同一套标签 ID，不能分别维护两套名称。
5. 价格、库存、上下架、营业状态和配送资格属于实时业务属性，不属于商品语义标签。
6. “低糖”“无糖”“纯素”“过敏原”等标签应尽量来自商家确认或结构化配方，不能仅凭商品名称推断。
7. 分类库应支持新增、合并、拆分和停用分类，并保留版本号。
8. 分类无法确定时保留未知标签和置信度，不强行归类。
9. 一级类目用于召回覆盖和统计，二级类目用于区分盖饭、汤面、烧烤、奶茶、咖啡等具体商品形态；二级类目不限制数量。
10. `ingredients` 采用多标签，同时区分主食材和辅助食材；不能只保留一个食材组。
11. `taste_profile` 最多保留 2–3 个标签，优先使用具体味型；不再使用“浓郁”这类区分度低的泛标签。
12. `price_range` 由原始 `unit_price` 或套餐价格计算，区间只用于展示和粗粒度匹配；推荐排序优先使用原始数值和用户价格偏好。
13. `consumption_scene` 最多保留 2 个商品适用场景，不因为商品属于盖饭或饮品就自动填满午餐、晚餐和独食；当前时间、用户位置和用餐人数属于请求上下文。

## 六、MVP 建议

第一版只使用以下五个核心推荐属性：

| 中文字段 | English key | 说明 | 推荐权重 |
|---|---|---|---:|
| 类目 | `category` | 主类目及层级类目 ID | 0.20 |
| 核心食材 | `ingredients` | 一个或多个标准食材组 ID | 0.30 |
| 口味风味 | `taste_profile` | 咸香/酱香、鲜香/清鲜、香辣、麻辣/椒麻、酸辣、酸甜、甜香、清淡/原味、奶香/芝士、果香/茶香/咖啡香 | 0.25 |
| 价格区间 | `price_range` | 商品或套餐价格标准区间；排序同时使用原始价格 | 0.15 |
| 消费场景 | `consumption_scene` | 早餐、午餐、下午茶、晚餐、夜宵、独食、办公、家庭、聚餐、约会 | 0.10 |

五项推荐权重合计为 `1.00`。商品标准名仅用于归一化；过敏原、饮食限制和实时可售条件先作为硬性过滤处理。

## 七、商品属性示例矩阵

以下示例覆盖 10 个一级类目，并为每个类目补充一个二级类目。实际商品可以同时拥有多个核心食材、口味风味和消费场景标签。

| 商品 | 类目 `category` | 核心食材 `ingredients` | 口味风味 `taste_profile` | 价格区间 `price_range` | 消费场景 `consumption_scene` |
|---|---|---|---|---|---|
| 香辣鸡腿饭 | 快餐简餐 `fast_food_simple_meal` > 盖饭 `rice_meal` | 谷物米面 `grains_rice_noodles`、禽肉 `poultry` | 咸香/酱香 `savory_sauce`、香辣 `fragrant_spicy` | 15–20 元 `15_20` | 午餐 `lunch`、办公工作餐 `office_meal` |
| 宫保鸡丁 | 中式正餐/地方菜 `chinese_local_cuisine` > 川菜 `sichuan_cuisine` | 禽肉 `poultry`、豆制品坚果 `soy_nuts` | 咸香/酱香 `savory_sauce`、香辣 `fragrant_spicy` | 30–50 元 `30_50` | 晚餐 `dinner`、家庭用餐 `family_meal` |
| 兰州牛肉面 | 面食米粉 `noodle_rice` > 汤面 `noodle_soup` | 谷物米面 `grains_rice_noodles`、牛羊肉 `beef_lamb` | 咸香/酱香 `savory_sauce`、鲜香/清鲜 `fresh_umami` | 10–15 元 `10_15` | 午餐 `lunch`、独食简餐 `solo_meal` |
| 麻辣牛肉火锅套餐 | 火锅串串 `hotpot_skewers` > 火锅 `hotpot` | 牛羊肉 `beef_lamb`、蔬菜菌菇 `vegetables_mushrooms` | 麻辣/椒麻 `mala_numbing_spicy`、咸香/酱香 `savory_sauce` | 80–120 元 `80_120` | 聚餐多人 `group_dining`、家庭用餐 `family_meal` |
| 烧烤拼盘 | 烧烤炸物小吃 `bbq_fried_snacks` > 烧烤 `barbecue` | 牛羊肉 `beef_lamb`、禽肉 `poultry` | 咸香/酱香 `savory_sauce`、麻辣/椒麻 `mala_numbing_spicy` | 50–80 元 `50_80` | 夜宵 `late_night`、聚餐多人 `group_dining` |
| 鸡肉汉堡套餐 | 汉堡披萨西餐 `burger_pizza_western` > 汉堡 `burger` | 谷物米面 `grains_rice_noodles`、禽肉 `poultry`、蛋奶乳制品 `egg_dairy` | 咸香/酱香 `savory_sauce`、奶香/芝士 `creamy_cheesy` | 20–25 元 `20_25` | 独食简餐 `solo_meal`、办公工作餐 `office_meal` |
| 日式照烧鸡饭 | 日韩/异国料理 `japanese_korean_international` > 日式料理 `japanese_cuisine` | 谷物米面 `grains_rice_noodles`、禽肉 `poultry` | 咸香/酱香 `savory_sauce`、鲜香/清鲜 `fresh_umami` | 30–50 元 `30_50` | 午餐 `lunch`、晚餐 `dinner` |
| 芒果芝士奶茶 | 饮品 `drinks` > 奶茶 `milk_tea` | 水果 `fruit`、蛋奶乳制品 `egg_dairy`、茶咖啡及饮品原料 `tea_coffee_beverage_base` | 甜香 `sweet_aroma`、果香/茶香/咖啡香 `fruity_tea_coffee`、奶香/芝士 `creamy_cheesy` | 10–15 元 `10_15` | 下午茶 `afternoon_tea`、办公工作餐 `office_meal` |
| 芒果千层 | 甜品烘焙 `desserts_bakery` > 蛋糕 `cake` | 水果 `fruit`、蛋奶乳制品 `egg_dairy`、谷物米面 `grains_rice_noodles` | 甜香 `sweet_aroma`、果香/茶香/咖啡香 `fruity_tea_coffee`、奶香/芝士 `creamy_cheesy` | 20–25 元 `20_25` | 下午茶 `afternoon_tea`、约会庆祝 `date_celebration` |
| 精品水果拼盘 | 水果生鲜商超 `fresh_grocery_other` > 水果 `fresh_fruit` | 水果 `fruit` | 甜香 `sweet_aroma`、果香/茶香/咖啡香 `fruity_tea_coffee` | 30–50 元 `30_50` | 家庭用餐 `family_meal`、办公工作餐 `office_meal` |

核心目标是：用户喜欢“芒果、果香、低糖、冷饮”，系统能够推荐其他符合这些标签的商品，而不是只能推荐用户以前买过的同一商品。

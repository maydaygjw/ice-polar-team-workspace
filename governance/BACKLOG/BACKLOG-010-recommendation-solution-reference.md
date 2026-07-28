# BACKLOG-010 个性化推荐系统方案参考

> 本文是个性化推荐方案的中文参考稿，保留原始方案的设计思路和示例，供后续 `create-team` 阶段引用。

## 一、总体思路

可以构建一个轻量级推荐系统，让 LLM 只负责离线用户画像提取、商品语义标准化和候选商品重排，而不在本地训练协同过滤、矩阵分解或深度学习模型。实时推荐请求不调用 LLM。

关键原则是：不要让 LLM 直接从完整商品目录中推荐，而是先通过 SQL 生成小规模候选集，再让 LLM 对候选商品进行排序。

整体架构：

```text
订单数据
    ↓
LLM 离线处理
    ↓
结构化用户偏好画像
    ↓
SQL 候选商品召回
    ↓
LLM 离线候选重排并生成推荐列表
    ↓
业务规则过滤
    ↓
在线读取预生成结果并执行确定性业务过滤
```

本质上是：

```text
SQL 候选召回 + LLM 离线画像/标签/重排 + 在线确定性排序
```

不需要在本地训练推荐模型。

## 一点五、推荐链路的职责划分

推荐链路不应把“候选召回、初排和 LLM 重排”混成一个步骤，建议明确拆成：

```text
候选召回 → 离线初排 → 离线 LLM 重排 → 在线业务过滤
```

| 阶段 | 主要职责 | 是否个性化 | 是否使用 LLM | 结果规模 |
|---|---|---:|---:|---:|
| 候选召回 | 从热门、复购、偏好品类、价格、新品和促销等来源找到潜在商品 | 部分 | 否 | 100–500 |
| 离线初排 | 用 SQL/Java 的确定性规则缩小候选范围 | 是 | 否 | 30–50 |
| 离线 LLM 重排 | 做细粒度语义匹配、控制多样性、生成推荐角色和理由 | 是 | 是 | 10–20 |
| 在线业务过滤 | 处理库存、上架、营业、配送和促销等实时条件 | 是 | 否 | 最终结果 |

候选召回只负责“找得到”。多个来源合并去重后，为每个用户和场景生成候选集。离线初排不调用 LLM，负责把 100–500 个候选缩小到 30–50 个。LLM 只接收这批小范围候选，离线生成 10–20 个推荐结果。在线请求只读取预生成结果并执行实时业务过滤。

## 二、将原始订单转换为用户偏好画像

假设订单数据如下：

```json
[
  {
    "time": "2026-07-20 11:42",
    "merchant": "鸡肉饭店",
    "items": [
      {
        "name": "香辣鸡肉饭",
        "category": "米饭",
        "price": 18,
        "tags": ["辣", "鸡肉", "大份"]
      }
    ],
    "amount": 18
  },
  {
    "time": "2026-07-22 21:10",
    "merchant": "深夜小吃",
    "items": [
      {
        "name": "炸鸡套餐",
        "category": "油炸食品",
        "price": 25,
        "tags": ["油炸", "鸡肉", "夜宵"]
      }
    ],
    "amount": 25
  }
]
```

周期性地将压缩后的订单摘要发送给 LLM，让它生成结构化画像：

```json
{
  "preferred_categories": [
    {"name": "米饭", "weight": 0.86},
    {"name": "油炸食品", "weight": 0.74}
  ],
  "preferred_flavors": [
    {"name": "辣", "weight": 0.81}
  ],
  "preferred_ingredients": [
    {"name": "鸡肉", "weight": 0.91}
  ],
  "price_range": {
    "min": 15,
    "max": 28,
    "preferred": 21
  },
  "time_preferences": [
    {"period": "午餐", "weight": 0.82},
    {"period": "夜宵", "weight": 0.65}
  ],
  "behavior_summary": "偏好香辣鸡肉类食品，午餐通常选择饱腹的米饭，晚上偶尔购买油炸小吃。",
  "negative_preferences": [],
  "confidence": 0.83
}
```

应使用结构化输出或 JSON Schema 约束模型输出，而不是解析任意自然语言。结构化输出能够让模型遵守预定义 JSON Schema，便于校验和存储。

建议画像包含以下信息：

- 用户长期偏好和近期偏好；
- 品类、口味、食材及偏好权重；
- 价格区间；
- 用餐时间偏好；
- 正向偏好、负向偏好和行为摘要；
- 画像置信度、订单数量、最近订单时间和画像版本。

不要在每次请求时重新生成画像。可以在以下情况下更新：

- 用户完成新的 3–5 个订单；
- 现有画像已经过期数天；
- 用户近期行为与画像明显不一致；
- 用户主动修改偏好。

## 三、使用 LLM 标准化商品数据

当商品名称和分类不规范时，推荐效果会明显下降。例如：

```text
超级香辣鸡肉饭
大份鸡肉套餐
秘制辣味脆皮鸡
第一招牌套餐
```

可以使用 LLM 离线标准化商品信息：

```json
{
  "product_id": 10023,
  "standard_category": "米饭",
  "subcategories": ["鸡肉饭", "套餐"],
  "ingredients": ["鸡肉", "米饭"],
  "flavors": ["辣", "咸香"],
  "meal_periods": ["午餐", "晚餐"],
  "portion_size": "大份",
  "suitable_scenarios": ["饱腹正餐", "学生午餐"],
  "dietary_properties": [],
  "semantic_description": "一份适合午餐或晚餐的大份香辣鸡肉饭套餐。",
  "quality_confidence": 0.92
}
```

该语义信息应与原始商品数据分开存储。原始商品名称、价格、库存和上下架状态仍以业务系统为准。

## 四、使用 SQL 生成候选商品，而不是让 LLM 查询全量商品

LLM 不应接收 1 万或 10 万个商品。先通过 SQL 生成约 30–100 个候选商品。

对校园配送场景，候选商品至少需要满足：

```text
可售商品
∩ 当前营业商家
∩ 可配送到用户所在校区/楼栋
∩ 库存有效
∩ 适合当前用餐时段
∩ 价格处于合理范围
```

候选来源可以包括以下几类。

### 热门商品

```sql
SELECT product_id
FROM product_sales_daily
WHERE site_id = :siteId
  AND stat_date >= CURRENT_DATE - INTERVAL 7 DAY
ORDER BY order_count DESC
LIMIT 30;
```

### 用户曾购买商品

```sql
SELECT product_id
FROM orders
WHERE user_id = :userId
  AND created_at >= NOW() - INTERVAL 90 DAY
GROUP BY product_id
ORDER BY COUNT(*) DESC, MAX(created_at) DESC
LIMIT 20;
```

### 品类匹配商品

读取用户画像中的高偏好品类，再查询商品语义画像：

```sql
SELECT product_id
FROM product_semantic_profile
WHERE standard_category IN ('米饭', '油炸食品')
LIMIT 30;
```

### 新品和促销商品

```sql
SELECT product_id
FROM products
WHERE site_id = :siteId
  AND status = 'AVAILABLE'
  AND created_at >= NOW() - INTERVAL 14 DAY
ORDER BY sales_count DESC
LIMIT 20;
```

最终将多个来源的候选集合并、去重，作为离线任务的输入交给 LLM 重排，并保存预生成的推荐结果。在线请求不执行 LLM 重排。

这里不需要复杂的推荐算法，主要是确定性过滤和 SQL 排序。

## 五、让 LLM 离线对候选商品进行重排

离线任务发送给 LLM 的内容包括：

- 用户偏好画像；
- 时间段、站点等推荐场景；
- 候选商品；
- 最近推荐曝光记录；
- 业务约束。

示例请求：

```json
{
  "user_profile": {
    "preferred_categories": ["米饭", "油炸食品"],
    "preferred_flavors": ["辣"],
    "preferred_ingredients": ["鸡肉"],
    "preferred_price": 21,
    "behavior_summary": "偏好香辣、饱腹的鸡肉类食品。"
  },
  "context": {
    "time": "2026-07-28 11:35",
    "meal_period": "午餐",
    "weather": "炎热",
    "site_id": 12
  },
  "recent_exposures": [10023, 10031, 10052],
  "candidates": [
    {
      "product_id": 10023,
      "name": "香辣鸡肉饭",
      "price": 18,
      "category": "米饭",
      "tags": ["辣", "鸡肉", "大份"],
      "sales_7d": 532
    },
    {
      "product_id": 10024,
      "name": "番茄牛肉饭",
      "price": 22,
      "category": "米饭",
      "tags": ["牛肉", "酸甜"],
      "sales_7d": 310
    }
  ]
}
```

要求模型返回：

```json
{
  "recommendations": [
    {
      "product_id": 10023,
      "score": 92,
      "reason_codes": [
        "PREFERRED_INGREDIENT",
        "PREFERRED_FLAVOR",
        "PRICE_MATCH",
        "MEAL_PERIOD_MATCH"
      ],
      "reason": "符合用户对香辣鸡肉的偏好，且价格处于其午餐常用区间。"
    }
  ]
}
```

Prompt 中必须明确：

1. 只能选择候选集中的商品 ID；
2. 不得创建或修改商品 ID；
3. 排除不可售或违反业务规则的商品；
4. 优先考虑偏好匹配、场景匹配和多样性；
5. 避免推荐过多同一商家或同一品类的商品；
6. 最多返回 10 个商品；
7. 必须输出符合 Schema 的 JSON。

## 六、将 LLM 排序与业务排序分开

不能把 LLM 返回的分数当作经过校准的概率，只把它当作一种排序信号，并与确定性信号组合：

```text
最终分数 =
    0.55 × LLM 分数
  + 0.15 × 热门度
  + 0.10 × 商家质量
  + 0.10 × 新鲜度
  + 0.10 × 业务分数
```

例如：

```java
double finalScore =
        0.55 * normalize(llmScore)
      + 0.15 * normalize(sales7d)
      + 0.10 * merchantRating
      + 0.10 * freshnessScore
      + 0.10 * promotionScore;
```

LLM 不得决定以下内容：

- 商品是否有库存；
- 商家是否营业；
- 是否支持配送；
- 商品价格是否有效；
- 是否违反饮食、法律或平台约束；
- 促销是否适用。

这些判断必须由后端确定性规则完成。

## 七、最轻量的实现方式

### 离线任务

每晚或每隔数小时执行：

1. 汇总每个用户最近 30–100 个订单；
2. 调用 LLM 更新用户画像；
3. 对新商品调用 LLM 生成商品语义信息；
4. 将结果保存到 MySQL。

大量离线任务可以使用 Batch API 等异步批处理能力，避免同步调用。

### 在线请求

1. 从 Redis/MySQL 读取离线生成的推荐列表；
2. 根据当前时间、站点和用户可配送范围选择对应列表；
3. 过滤下架、无库存、未营业和不可配送商品；
4. 使用确定性业务规则补充排序；
5. 必要时从 SQL 读取热门、复购和促销商品作为降级候选；
6. 将最终结果缓存 10–30 分钟。

参考请求规模：

- 一个用户画像约 300–800 tokens；
- 30 个候选商品约 1,500–3,000 tokens；
- 输出约 300–600 tokens。

在线请求不包含 LLM 调用，因此不会因为模型响应增加推荐接口的实时延迟。

## 八、增强方案：使用远程 Embedding

当商品目录和流量增长后，可以使用托管 Embedding API，而不在本地训练模型。

例如，为用户偏好生成向量：

```text
偏好香辣鸡肉餐，喜欢饱腹的米饭，午餐预算约 20 元，
晚上偶尔购买油炸小吃。
```

再为商品描述生成向量：

```text
大份香辣鸡肉饭套餐，适合午餐或晚餐，价格 18 元。
```

可使用以下存储和检索组件：

- PostgreSQL + pgvector；
- Elasticsearch/OpenSearch 向量检索；
- Redis 向量检索；
- Milvus；
- Pinecone；
- 其他托管向量数据库。

增强后的架构：

```text
用户订单
    ↓
LLM 用户偏好摘要
    ↓
托管 Embedding API
    ↓
向量召回 Top 50
    ↓
LLM 重排 Top 10
```

初期仍建议优先采用 SQL 方案，简单且容易验证效果。

## 九、冷启动策略

### 新用户

可以让用户选择少量偏好：

```text
偏好餐食： [米饭] [面食] [快餐] [清淡餐]
偏好口味： [辣] [清淡] [甜] [咸香]
预算：     [15 元以下] [15–25 元] [25 元以上]
```

也可以根据以下信息推断临时意图：

- 当前搜索关键词；
- 点击过的商品；
- 当前浏览分类；
- 当前时间；
- 校区/站点热门商品；
- 已领取的优惠券；
- 进入推荐页面的渠道。

临时画像示例：

```json
{
  "preferred_categories": ["米饭"],
  "preferred_flavors": ["辣"],
  "price_range": {
    "min": 15,
    "max": 25
  },
  "profile_type": "session",
  "confidence": 0.46
}
```

### 新商品

使用 LLM 生成的商品语义画像参与推荐，不必等待商品积累历史订单。

## 十、避免推荐结果过于同质化

LLM 容易反复选择最明显的商品，应增加明确的多样性约束：

- 同一商家最多推荐 2 个商品；
- 同一品类最多推荐 4 个商品；
- 至少包含 1 个熟悉商品；
- 至少包含 1 个探索商品；
- 至少包含 1 个当前热门商品；
- 24 小时内不要重复曝光同一商品，除非用户已经购买。

可以让 LLM 为每个推荐商品标记推荐角色：

```json
{
  "product_id": 10023,
  "recommendation_role": "safe_choice"
}
```

可选角色：

```text
repeat_purchase   复购商品
safe_choice       安全选择
similar_alternative 相似替代
new_discovery     新品发现
popular_now       当前热门
promotion_match   促销匹配
```

这样得到的推荐列表会比单纯按相似度排序更有层次。

## 十一、无需训练算法的反馈闭环

记录每次推荐事件：

```sql
CREATE TABLE recommendation_event (
    event_id          BIGINT PRIMARY KEY,
    user_id           BIGINT NOT NULL,
    request_id        VARCHAR(64) NOT NULL,
    product_id        BIGINT NOT NULL,
    position          INT NOT NULL,
    source            VARCHAR(32),
    reason_codes      JSON,
    clicked           BOOLEAN DEFAULT FALSE,
    ordered           BOOLEAN DEFAULT FALSE,
    created_at        DATETIME NOT NULL
);
```

周期性地将反馈摘要发送给 LLM：

```json
{
  "previous_profile": "上一版用户画像",
  "recent_feedback": {
    "recommended": 60,
    "clicked": 12,
    "ordered": 3,
    "ignored_categories": ["沙拉", "甜点"],
    "ordered_categories": ["米饭", "面食"]
  }
}
```

要求 LLM 谨慎更新画像：

- 不要因为一次忽略就删除长期偏好；
- 购买行为权重大于点击行为；
- 近期订单权重大于较早订单。

推荐行为的隐式反馈优先级可以直接写入提示词：

```text
购买 > 加购 > 收藏 > 点击 > 曝光
```

## 十二、主要限制与应对

### 成本和延迟

离线重排会产生 token 成本和任务耗时。可以通过以下方式控制：

- 限制候选商品数量；
- 使用成本较低的重排模型；
- 使用 Redis 缓存；
- 离线批量生成部分推荐；
- 只有在画像、商品或推荐场景发生变化时重新生成。

### 排序不完全稳定

相同候选商品可能得到略有不同的排序。建议：

- 将 temperature 设置为 0；
- 使用结构化输出；
- 校验所有商品 ID；
- 在 LLM 结果后增加确定性排序。

### 协同信号不足

LLM 不会自动知道“购买商品 A 的用户经常购买商品 B”。可以通过 SQL 计算简单的共购统计，再作为候选或排序信息提供给 LLM：

```sql
SELECT
    a.product_id AS source_product,
    b.product_id AS related_product,
    COUNT(DISTINCT a.order_id) AS co_order_count
FROM order_item a
JOIN order_item b
  ON a.order_id = b.order_id
 AND a.product_id <> b.product_id
GROUP BY a.product_id, b.product_id;
```

这不是训练模型，但可以提供有价值的协同购买证据。

### LLM 分数不是概率

分数 90 不代表 90% 的购买概率，只能用于相对排序。

## 十三、推荐实施阶段

### 第一阶段：离线 SQL + LLM，在线读取结果

```text
用户订单汇总
    → LLM 用户画像
    → 离线 SQL 候选召回
    → LLM 离线候选重排
    → 保存推荐列表
    → 在线读取并过滤
```

用于验证个性化推荐是否改善点击率和转化率。

### 第二阶段：加入行为反馈

接入以下行为：

```text
曝光、点击、收藏、加购、购买、复购、负反馈
```

使用这些数据更新用户画像，并控制重复曝光。

### 第三阶段：托管 Embedding

当商品规模和访问量增长后：

```text
LLM 用户画像
    → 离线 Embedding 召回
    → LLM 离线候选重排
    → 保存推荐列表
    → 在线业务规则排序
```

## 十四、针对当前平台的建议

### LLM 离线处理：画像与标签

- 商品语义标准化；
- 用户偏好提取；
- 用户画像更新；
- 新商品冷启动语义分析。

### SQL 离线/在线处理

- 可售性和库存过滤；
- 热门商品候选；
- 复购商品候选；
- 品类和价格匹配候选；
- 新品和促销候选。

### LLM 离线处理：候选重排

- 离线对 30–50 个候选商品排序；
- 离线生成推荐理由和理由码；
- 离线控制推荐多样性；
- 离线识别复购、探索和促销等推荐角色。

### Backend 负责

- 校验推荐商品 ID；
- 应用业务规则；
- 过滤库存、营业、配送和价格异常；
- 缓存推荐结果；
- 收集曝光、点击和下单反馈；
- LLM 异常时降级到热门和规则推荐。

最终目标是在不训练和部署本地推荐模型、且不让 LLM 参与实时推荐的情况下，构建一个轻量、可解释、可逐步增强的个性化推荐系统。

# 打印方向与单双面设置技术设计

能力同步阶段复用 `LiankePrinterParams.orientations` 与 `duplexes`。打印域将数字编码转换为稳定的中文 Option 名称，再调用 product API 以通用 `ProductOptionGroupSpecDTO` 重建分组。

下单策略从 Option 快照提取“方向”和“双面”，通过 `PrintSpecResolver` 转成链科编码，并同时写入解析上下文与 `extra_params`。支付成功后 `PrintShopService` 从快照填充 `PrintJobSubmitDTO`，由 `LiankePrinterGateway` 负责协议字段输出。

不把链科能力查询放入 product 事务；同步前先完成远程能力查询，再进行商品 Option 重建。下单时不重新依赖设备实时能力，使用下单时已校验并冻结的快照。

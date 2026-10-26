---
url: "https://pay.weixin.qq.com/doc/v3/partner/4013059103.md"
title: "使用Java加载密钥时，抛出异常InvalidKeyException: Illegal key size"
doc_id: 4013059103
api_version: "apiv3"
url_display: "https://pay.weixin.qq.com/doc/v3/partner/4013059103"
title_display: "APIv3/合作伙伴/通用规则/开发须知/常见问题/使用Java加载密钥时，抛出异常InvalidKeyException- Illegal key size"
---

>更新时间：2024.11.20

受到美国法律的约束，早期Java的运行时限制了JCE支持的密钥长度，即默认不支持256位的AES。解决的方法有三个：

- （推荐）升级Java 8u162+，[默认使用ulimited policy](https://bugs.openjdk.java.net/browse/JDK-8170157)

- Java 8u151和8u152，可以在你的程序中直接放开策略


```
Security.setProperty("crypto.policy", "unlimited");
```

- 其他版本，下载[无限强度权限策略文件补丁包](https://www.oracle.com/technetwork/java/javase/downloads/jce8-download-2133166.html)，并使用其中的文件覆盖$JAVA\_HOME/lib/security目录下的对应的local\_policy.jar 和US\_export\_policy.jar

- Java9及以上，均无限制。
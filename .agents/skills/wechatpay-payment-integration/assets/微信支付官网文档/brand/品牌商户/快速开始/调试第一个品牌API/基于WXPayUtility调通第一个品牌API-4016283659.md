---
url: "https://pay.weixin.qq.com/doc/brand/4016283659.md"
title: "基于WXPayUtility调通第一个品牌API"
doc_id: 4016283659
api_version: "brand"
url_display: "https://pay.weixin.qq.com/doc/brand/4016283659"
title_display: "brand/品牌商户/快速开始/调试第一个品牌API/基于WXPayUtility调通第一个品牌API"
---

>更新时间：2025.11.11

## 一、概述

本文档提供基于官方提供的工具类 [WXPayUtility](https://pay.weixin.qq.com/doc/brand/4015826861.md)，调用“[设置商品券事件通知地址](https://pay.weixin.qq.com/doc/brand/4015736293.md)”接口的示例。

## 二、准备开发参数

商户调用接口前需要需要先准备开发必要参数： `brand_id`(品牌ID)、品牌API证书以及证书序列号、微信支付公钥以及公钥ID等信息，具体可参考：[开发必要参数说明](https://pay.weixin.qq.com/doc/brand/4015415289.md)

## 三、接口调用示例

### 1、引入依赖

工具类 WXPayUtility 依赖以下第三方库：

1. Google Gson：用于 JSON 数据的序列化和反序列化。

2. OkHttp：用于 HTTP 请求处理。


你可以通过 Maven 或 Gradle 来引入这些依赖。其中依赖的版本号可自行选择版本进行填写，本文仅为示例。

如果你使用的 [Gradle](https://gradle.org/)，请在 build.gradle 中加入：

```
implementation 'com.google.code.gson:gson:2.13.2'
implementation 'com.squareup.okhttp3:okhttp:5.0.0-alpha.14'
```

如果你使用的 [Maven](https://maven.apache.org/)，请在 pom.xml 中加入：

```
<!-- Google Gson -->
<dependency>
    <groupId>com.google.code.gson</groupId>
    <artifactId>gson</artifactId>
    <version>2.13.2</version>
</dependency>
<!-- OkHttp -->
<dependency>
    <groupId>com.squareup.okhttp3</groupId>
    <artifactId>okhttp</artifactId>
    <version>5.0.0-alpha.14</version>
</dependency>
```

### 2、编写工具类代码

创建WXPayUtility类，复制以下代码内容进去并补充当前类的包路径：

```
import com.google.gson.ExclusionStrategy;
import com.google.gson.FieldAttributes;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonSyntaxException;
import com.google.gson.annotations.Expose;
import com.google.gson.annotations.SerializedName;
import okhttp3.Headers;
import okhttp3.Response;
import okio.BufferedSource;

import javax.crypto.BadPaddingException;
import javax.crypto.Cipher;
import javax.crypto.IllegalBlockSizeException;
import javax.crypto.NoSuchPaddingException;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.io.UnsupportedEncodingException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.security.InvalidAlgorithmParameterException;
import java.security.InvalidKeyException;
import java.security.KeyFactory;
import java.security.NoSuchAlgorithmException;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.SecureRandom;
import java.security.Signature;
import java.security.SignatureException;
import java.security.spec.InvalidKeySpecException;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.time.DateTimeException;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.Objects;

public class WXPayBrandUtility {
    private static final Gson gson = new GsonBuilder()
            .disableHtmlEscaping()
            .addSerializationExclusionStrategy(new ExclusionStrategy() {
                @Override
                public boolean shouldSkipField(FieldAttributes fieldAttributes) {
                    final Expose expose = fieldAttributes.getAnnotation(Expose.class);
                    return expose != null && !expose.serialize();
                }

                @Override
                public boolean shouldSkipClass(Class<?> aClass) {
                    return false;
                }
            })
            .addDeserializationExclusionStrategy(new ExclusionStrategy() {
                @Override
                public boolean shouldSkipField(FieldAttributes fieldAttributes) {
                    final Expose expose = fieldAttributes.getAnnotation(Expose.class);
                    return expose != null && !expose.deserialize();
                }

                @Override
                public boolean shouldSkipClass(Class<?> aClass) {
                    return false;
                }
            })
            .create();
    private static final char[] SYMBOLS =
            "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".toCharArray();
    private static final SecureRandom random = new SecureRandom();

    /**
     * 将 Object 转换为 JSON 字符串
     */
    public static String toJson(Object object) {
        return gson.toJson(object);
    }

    /**
     * 将 JSON 字符串解析为特定类型的实例
     */
    public static <T> T fromJson(String json, Class<T> classOfT) throws JsonSyntaxException {
        return gson.fromJson(json, classOfT);
    }

    /**
     * 从公私钥文件路径中读取文件内容
     *
     * @param keyPath 文件路径
     * @return 文件内容
     */
    private static String readKeyStringFromPath(String keyPath) {
        try {
            return new String(Files.readAllBytes(Paths.get(keyPath)), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /**
     * 读取 PKCS#8 格式的私钥字符串并加载为私钥对象
     *
     * @param keyString 私钥文件内容，以 -----BEGIN PRIVATE KEY----- 开头
     * @return PrivateKey 对象
     */
    public static PrivateKey loadPrivateKeyFromString(String keyString) {
        try {
            keyString = keyString.replace("-----BEGIN PRIVATE KEY-----", "")
                    .replace("-----END PRIVATE KEY-----", "")
                    .replaceAll("\\s+", "");
            return KeyFactory.getInstance("RSA").generatePrivate(
                    new PKCS8EncodedKeySpec(Base64.getDecoder().decode(keyString)));
        } catch (NoSuchAlgorithmException e) {
            throw new UnsupportedOperationException(e);
        } catch (InvalidKeySpecException e) {
            throw new IllegalArgumentException(e);
        }
    }

    /**
     * 从 PKCS#8 格式的私钥文件中加载私钥
     *
     * @param keyPath 私钥文件路径
     * @return PrivateKey 对象
     */
    public static PrivateKey loadPrivateKeyFromPath(String keyPath) {
        return loadPrivateKeyFromString(readKeyStringFromPath(keyPath));
    }

    /**
     * 读取 PKCS#8 格式的公钥字符串并加载为公钥对象
     *
     * @param keyString 公钥文件内容，以 -----BEGIN PUBLIC KEY----- 开头
     * @return PublicKey 对象
     */
    public static PublicKey loadPublicKeyFromString(String keyString) {
        try {
            keyString = keyString.replace("-----BEGIN PUBLIC KEY-----", "")
                    .replace("-----END PUBLIC KEY-----", "")
                    .replaceAll("\\s+", "");
            return KeyFactory.getInstance("RSA").generatePublic(
                    new X509EncodedKeySpec(Base64.getDecoder().decode(keyString)));
        } catch (NoSuchAlgorithmException e) {
            throw new UnsupportedOperationException(e);
        } catch (InvalidKeySpecException e) {
            throw new IllegalArgumentException(e);
        }
    }

    /**
     * 从 PKCS#8 格式的公钥文件中加载公钥
     *
     * @param keyPath 公钥文件路径
     * @return PublicKey 对象
     */
    public static PublicKey loadPublicKeyFromPath(String keyPath) {
        return loadPublicKeyFromString(readKeyStringFromPath(keyPath));
    }

    /**
     * 创建指定长度的随机字符串，字符集为[0-9a-zA-Z]，可用于安全相关用途
     */
    public static String createNonce(int length) {
        char[] buf = new char[length];
        for (int i = 0; i < length; ++i) {
            buf[i] = SYMBOLS[random.nextInt(SYMBOLS.length)];
        }
        return new String(buf);
    }

    /**
     * 使用公钥按照 RSA_PKCS1_OAEP_PADDING 算法进行加密
     *
     * @param publicKey 加密用公钥对象
     * @param plaintext 待加密明文
     * @return 加密后密文
     */
    public static String encrypt(PublicKey publicKey, String plaintext) {
        final String transformation = "RSA/ECB/OAEPWithSHA-1AndMGF1Padding";

        try {
            Cipher cipher = Cipher.getInstance(transformation);
            cipher.init(Cipher.ENCRYPT_MODE, publicKey);
            return Base64.getEncoder().encodeToString(cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException | NoSuchPaddingException e) {
            throw new IllegalArgumentException("The current Java environment does not support " + transformation, e);
        } catch (InvalidKeyException e) {
            throw new IllegalArgumentException("RSA encryption using an illegal publicKey", e);
        } catch (BadPaddingException | IllegalBlockSizeException e) {
            throw new IllegalArgumentException("Plaintext is too long", e);
        }
    }

    public static String aesAeadDecrypt(byte[] key, byte[] associatedData, byte[] nonce,
                                        byte[] ciphertext) {
        final String transformation = "AES/GCM/NoPadding";
        final String algorithm = "AES";
        final int tagLengthBit = 128;

        try {
            Cipher cipher = Cipher.getInstance(transformation);
            cipher.init(
                    Cipher.DECRYPT_MODE,
                    new SecretKeySpec(key, algorithm),
                    new GCMParameterSpec(tagLengthBit, nonce));
            if (associatedData != null) {
                cipher.updateAAD(associatedData);
            }
            return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
        } catch (InvalidKeyException
                 | InvalidAlgorithmParameterException
                 | BadPaddingException
                 | IllegalBlockSizeException
                 | NoSuchAlgorithmException
                 | NoSuchPaddingException e) {
            throw new IllegalArgumentException(String.format("AesAeadDecrypt with %s Failed",
                    transformation), e);
        }
    }

    /**
     * 使用私钥按照指定算法进行签名
     *
     * @param message    待签名串
     * @param algorithm  签名算法，如 SHA256withRSA
     * @param privateKey 签名用私钥对象
     * @return 签名结果
     */
    public static String sign(String message, String algorithm, PrivateKey privateKey) {
        byte[] sign;
        try {
            Signature signature = Signature.getInstance(algorithm);
            signature.initSign(privateKey);
            signature.update(message.getBytes(StandardCharsets.UTF_8));
            sign = signature.sign();
        } catch (NoSuchAlgorithmException e) {
            throw new UnsupportedOperationException("The current Java environment does not support " + algorithm, e);
        } catch (InvalidKeyException e) {
            throw new IllegalArgumentException(algorithm + " signature uses an illegal privateKey.", e);
        } catch (SignatureException e) {
            throw new RuntimeException("An error occurred during the sign process.", e);
        }
        return Base64.getEncoder().encodeToString(sign);
    }

    /**
     * 使用公钥按照特定算法验证签名
     *
     * @param message   待签名串
     * @param signature 待验证的签名内容
     * @param algorithm 签名算法，如：SHA256withRSA
     * @param publicKey 验签用公钥对象
     * @return 签名验证是否通过
     */
    public static boolean verify(String message, String signature, String algorithm,
                                 PublicKey publicKey) {
        try {
            Signature sign = Signature.getInstance(algorithm);
            sign.initVerify(publicKey);
            sign.update(message.getBytes(StandardCharsets.UTF_8));
            return sign.verify(Base64.getDecoder().decode(signature));
        } catch (SignatureException e) {
            return false;
        } catch (InvalidKeyException e) {
            throw new IllegalArgumentException("verify uses an illegal publickey.", e);
        } catch (NoSuchAlgorithmException e) {
            throw new UnsupportedOperationException("The current Java environment does not support" + algorithm, e);
        }
    }

    /**
     * 根据品牌API请求签名规则构造 Authorization 签名
     *
     * @param brand_id            品牌ID
     * @param certificateSerialNo 品牌API证书序列号
     * @param privateKey          品牌API证书私钥
     * @param method              请求接口的HTTP方法，请使用全大写表述，如 GET、POST、PUT、DELETE
     * @param uri                 请求接口的URL
     * @param body                请求接口的Body
     * @return 构造好的品牌API Authorization 头
     */
    public static String buildAuthorization(String brand_id, String certificateSerialNo,
                                            PrivateKey privateKey,
                                            String method, String uri, String body) {
        String nonce = createNonce(32);
        long timestamp = Instant.now().getEpochSecond();

        String message = String.format("%s\n%s\n%d\n%s\n%s\n", method, uri, timestamp, nonce,
                body == null ? "" : body);

        String signature = sign(message, "SHA256withRSA", privateKey);

        return String.format(
                "WECHATPAY-BRAND-SHA256-RSA2048 brand_id=\"%s\",nonce_str=\"%s\",signature=\"%s\"," +
                        "timestamp=\"%d\",serial_no=\"%s\"",
                brand_id, nonce, signature, timestamp, certificateSerialNo);
    }

    /**
     * 对参数进行 URL 编码
     *
     * @param content 参数内容
     * @return 编码后的内容
     */
    public static String urlEncode(String content) {
        try {
            return URLEncoder.encode(content, StandardCharsets.UTF_8.name());
        } catch (UnsupportedEncodingException e) {
            throw new RuntimeException(e);
        }
    }

    /**
     * 对参数Map进行 URL 编码，生成 QueryString
     *
     * @param params Query参数Map
     * @return QueryString
     */
    public static String urlEncode(Map<String, Object> params) {
        if (params == null || params.isEmpty()) {
            return "";
        }

        int index = 0;
        StringBuilder result = new StringBuilder();
        for (Map.Entry<String, Object> entry : params.entrySet()) {
            result.append(entry.getKey())
                    .append("=")
                    .append(urlEncode(entry.getValue().toString()));
            index++;
            if (index < params.size()) {
                result.append("&");
            }
        }
        return result.toString();
    }

    /**
     * 从应答中提取 Body
     *
     * @param response HTTP 请求应答对象
     * @return 应答中的Body内容，Body为空时返回空字符串
     */
    public static String extractBody(Response response) {
        if (response.body() == null) {
            return "";
        }

        try {
            BufferedSource source = response.body().source();
            return source.readUtf8();
        } catch (IOException e) {
            throw new RuntimeException(String.format("An error occurred during reading response body. " +
                    "Status: %d", response.code()), e);
        }
    }

    /**
     * 根据品牌API应答验签规则对应答签名进行验证，验证不通过时抛出异常
     *
     * @param wechatpayPublicKeyId 微信支付公钥ID
     * @param wechatpayPublicKey   微信支付公钥对象
     * @param headers              微信支付应答 Header 列表
     * @param body                 微信支付应答 Body
     */
    public static void validateResponse(String wechatpayPublicKeyId, PublicKey wechatpayPublicKey,
                                        Headers headers,
                                        String body) {
        String timestamp = headers.get("Wechatpay-Timestamp");
        String requestId = headers.get("Request-ID");
        try {
            Instant responseTime = Instant.ofEpochSecond(Long.parseLong(timestamp));
            // 拒绝过期请求
            if (Duration.between(responseTime, Instant.now()).abs().toMinutes() >= 5) {
                throw new IllegalArgumentException(
                        String.format("Validate response failed, timestamp[%s] is expired, request-id[%s]",
                                timestamp, requestId));
            }
        } catch (DateTimeException | NumberFormatException e) {
            throw new IllegalArgumentException(
                    String.format("Validate response failed, timestamp[%s] is invalid, request-id[%s]",
                            timestamp, requestId));
        }
        String serialNumber = headers.get("Wechatpay-Serial");
        if (!Objects.equals(serialNumber, wechatpayPublicKeyId)) {
            throw new IllegalArgumentException(
                    String.format("Validate response failed, Invalid Wechatpay-Serial, Local: %s, Remote: " +
                            "%s", wechatpayPublicKeyId, serialNumber));
        }

        String signature = headers.get("Wechatpay-Signature");
        String message = String.format("%s\n%s\n%s\n", timestamp, headers.get("Wechatpay-Nonce"),
                body == null ? "" : body);

        boolean success = verify(message, signature, "SHA256withRSA", wechatpayPublicKey);
        if (!success) {
            throw new IllegalArgumentException(
                    String.format("Validate response failed,the WechatPay signature is incorrect.%n"
                                    + "Request-ID[%s]\tresponseHeader[%s]\tresponseBody[%.1024s]",
                            headers.get("Request-ID"), headers, body));
        }
    }

    /**
     * 根据品牌API通知验签规则对通知签名进行验证，验证不通过时抛出异常
     * @param wechatpayPublicKeyId 微信支付公钥ID
     * @param wechatpayPublicKey 微信支付公钥对象
     * @param headers 微信支付通知 Header 列表
     * @param body 微信支付通知 Body
     */
    public static void validateNotification(String wechatpayPublicKeyId,
                                            PublicKey wechatpayPublicKey, Headers headers,
                                            String body) {
        String timestamp = headers.get("Wechatpay-Timestamp");
        try {
            Instant responseTime = Instant.ofEpochSecond(Long.parseLong(timestamp));
            // 拒绝过期请求
            if (Duration.between(responseTime, Instant.now()).abs().toMinutes() >= 5) {
                throw new IllegalArgumentException(
                        String.format("Validate notification failed, timestamp[%s] is expired", timestamp));
            }
        } catch (DateTimeException | NumberFormatException e) {
            throw new IllegalArgumentException(
                    String.format("Validate notification failed, timestamp[%s] is invalid", timestamp));
        }
        String serialNumber = headers.get("Wechatpay-Serial");
        if (!Objects.equals(serialNumber, wechatpayPublicKeyId)) {
            throw new IllegalArgumentException(
                    String.format("Validate notification failed, Invalid Wechatpay-Serial, Local: %s, " +
                                    "Remote: %s",
                            wechatpayPublicKeyId,
                            serialNumber));
        }

        String signature = headers.get("Wechatpay-Signature");
        String message = String.format("%s\n%s\n%s\n", timestamp, headers.get("Wechatpay-Nonce"),
                body == null ? "" : body);

        boolean success = verify(message, signature, "SHA256withRSA", wechatpayPublicKey);
        if (!success) {
            throw new IllegalArgumentException(
                    String.format("Validate notification failed, WechatPay signature is incorrect.\n"
                                    + "responseHeader[%s]\tresponseBody[%.1024s]",
                            headers, body));
        }
    }

    /**
     * 对微信支付通知进行签名验证、解析，同时将业务数据解密。验签名失败、解析失败、解密失败时抛出异常
     * @param apiv3Key 品牌API密钥
     * @param wechatpayPublicKeyId 微信支付公钥ID
     * @param wechatpayPublicKey   微信支付公钥对象
     * @param headers              微信支付应答 Header 列表
     * @param body                 微信支付应答 Body
     * @return 解析后的通知内容，解密后的业务数据可以使用 Notification.getPlaintext() 访问
     */
    public static Notification parseNotification(String apiv3Key, String wechatpayPublicKeyId,
                                                 PublicKey wechatpayPublicKey, Headers headers,
                                                 String body) {
        validateNotification(wechatpayPublicKeyId, wechatpayPublicKey, headers, body);
        Notification notification = gson.fromJson(body, Notification.class);
        notification.decrypt(apiv3Key);
        return notification;
    }

    /**
     * 微信支付API错误异常，发送HTTP请求成功，但返回状态码不是 2XX 时抛出本异常
     */
    public static class ApiException extends RuntimeException {
        private static final long serialVersionUID = 2261086748874802175L;

        private final int statusCode;
        private final String body;
        private final Headers headers;
        private final String errorCode;
        private final String errorMessage;

        public ApiException(int statusCode, String body, Headers headers) {
            super(String.format("微信支付API访问失败，StatusCode: [%s], Body: [%s], Headers: [%s]", statusCode,
                    body, headers));
            this.statusCode = statusCode;
            this.body = body;
            this.headers = headers;

            if (body != null && !body.isEmpty()) {
                JsonElement code;
                JsonElement message;

                try {
                    JsonObject jsonObject = gson.fromJson(body, JsonObject.class);
                    code = jsonObject.get("code");
                    message = jsonObject.get("message");
                } catch (JsonSyntaxException ignored) {
                    code = null;
                    message = null;
                }
                this.errorCode = code == null ? null : code.getAsString();
                this.errorMessage = message == null ? null : message.getAsString();
            } else {
                this.errorCode = null;
                this.errorMessage = null;
            }
        }

        /**
         * 获取 HTTP 应答状态码
         */
        public int getStatusCode() {
            return statusCode;
        }

        /**
         * 获取 HTTP 应答包体内容
         */
        public String getBody() {
            return body;
        }

        /**
         * 获取 HTTP 应答 Header
         */
        public Headers getHeaders() {
            return headers;
        }

        /**
         * 获取 错误码 （错误应答中的 code 字段）
         */
        public String getErrorCode() {
            return errorCode;
        }

        /**
         * 获取 错误消息 （错误应答中的 message 字段）
         */
        public String getErrorMessage() {
            return errorMessage;
        }
    }

    public static class Notification {
        @SerializedName("id")
        private String id;
        @SerializedName("create_time")
        private String createTime;
        @SerializedName("event_type")
        private String eventType;
        @SerializedName("resource_type")
        private String resourceType;
        @SerializedName("summary")
        private String summary;
        @SerializedName("resource")
        private Resource resource;
        private String plaintext;

        public String getId() {
            return id;
        }

        public String getCreateTime() {
            return createTime;
        }

        public String getEventType() {
            return eventType;
        }

        public String getResourceType() {
            return resourceType;
        }

        public String getSummary() {
            return summary;
        }

        public Resource getResource() {
            return resource;
        }

        /**
         * 获取解密后的业务数据（JSON字符串，需要自行解析）
         */
        public String getPlaintext() {
            return plaintext;
        }

        private void validate() {
            if (resource == null) {
                throw new IllegalArgumentException("Missing required field `resource` in notification");
            }
            resource.validate();
        }

        /**
         * 使用 APIv3Key 对通知中的业务数据解密，解密结果可以通过 getPlainText 访问。
         * 外部拿到的 Notification 一定是解密过的，因此本方法没有设置为 public
         * @param apiv3Key 品牌API密钥
         */
        private void decrypt(String apiv3Key) {
            validate();

            plaintext = aesAeadDecrypt(
                    apiv3Key.getBytes(StandardCharsets.UTF_8),
                    resource.associatedData.getBytes(StandardCharsets.UTF_8),
                    resource.nonce.getBytes(StandardCharsets.UTF_8),
                    Base64.getDecoder().decode(resource.ciphertext)
            );
        }

        public static class Resource {
            @SerializedName("algorithm")
            private String algorithm;

            @SerializedName("ciphertext")
            private String ciphertext;

            @SerializedName("associated_data")
            private String associatedData;

            @SerializedName("nonce")
            private String nonce;

            @SerializedName("original_type")
            private String originalType;

            public String getAlgorithm() {
                return algorithm;
            }

            public String getCiphertext() {
                return ciphertext;
            }

            public String getAssociatedData() {
                return associatedData;
            }

            public String getNonce() {
                return nonce;
            }

            public String getOriginalType() {
                return originalType;
            }

            private void validate() {
                if (algorithm == null || algorithm.isEmpty()) {
                    throw new IllegalArgumentException("Missing required field `algorithm` in Notification" +
                            ".Resource");
                }
                if (!Objects.equals(algorithm, "AEAD_AES_256_GCM")) {
                    throw new IllegalArgumentException(String.format("Unsupported `algorithm`[%s] in " +
                            "Notification.Resource", algorithm));
                }

                if (ciphertext == null || ciphertext.isEmpty()) {
                    throw new IllegalArgumentException("Missing required field `ciphertext` in Notification" +
                            ".Resource");
                }

                if (associatedData == null || associatedData.isEmpty()) {
                    throw new IllegalArgumentException("Missing required field `associatedData` in " +
                            "Notification.Resource");
                }

                if (nonce == null || nonce.isEmpty()) {
                    throw new IllegalArgumentException("Missing required field `nonce` in Notification" +
                            ".Resource");
                }

                if (originalType == null || originalType.isEmpty()) {
                    throw new IllegalArgumentException("Missing required field `originalType` in " +
                            "Notification.Resource");
                }
            }
        }
    }
}
```

工具类中已包含签名、验签操作，若需了解具体步骤可参考：

- [如何构造请求签名](https://pay.weixin.qq.com/doc/brand/4015407575.md#2.-%E5%A6%82%E4%BD%95%E6%9E%84%E9%80%A0%E8%AF%B7%E6%B1%82%E7%AD%BE%E5%90%8D)

- [如何使用微信支付公钥验签](https://pay.weixin.qq.com/doc/brand/4015407582.md)


### 3、调用接口示例

创建SetNotifyConfig类，复制以下代码内容进去并补充当前类的包路径，最后根据注释替换对应参数：

```
import com.google.gson.annotations.SerializedName;
import com.google.gson.annotations.Expose;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 设置商品券事件通知地址
 */
public class SetNotifyConfig {
  private static String HOST = "https://api.mch.weixin.qq.com";
  private static String METHOD = "POST";
  private static String PATH = "/brand/marketing/product-coupon/notify-configs";

  public static void main(String[] args) {
    // TODO: 请准备商户开发必要参数，参考：https://pay.weixin.qq.com/doc/brand/4015415289
    SetNotifyConfig client = new SetNotifyConfig(
      "xxxxxxxx",                    // 品牌ID，是由微信支付系统生成并分配给每个品牌方的唯一标识符，品牌ID获取方式参考 https://pay.weixin.qq.com/doc/brand/4015415289
      "1DDE55AD98Exxxxxxxxxx",         // 品牌API证书序列号，如何获取请参考 https://pay.weixin.qq.com/doc/brand/4015407570
      "/path/to/apiclient_key.pem",     // 品牌API证书私钥文件路径，本地文件路径
      "PUB_KEY_ID_xxxxxxxxxxxxx",      // 微信支付公钥ID，如何获取请参考 https://pay.weixin.qq.com/doc/brand/4015453439
      "/path/to/wxp_pub.pem"           // 微信支付公钥文件路径，本地文件路径
    );

    SetNotifyConfigRequest request = new SetNotifyConfigRequest();
    request.notifyUrl = "https://www.xxxxxxx.com/notify";	//需要设置的回调地址，回调地址设置规范请参考 https://pay.weixin.qq.com/doc/brand/4015407551
    try {
      SetNotifyConfigResponse response = client.run(request);
        // TODO: 请求成功，继续业务逻辑
        System.out.println(response);
    } catch (WXPayBrandUtility.ApiException e) {
        // TODO: 请求失败，根据状态码执行不同的逻辑
        e.printStackTrace();
    }
  }

  public SetNotifyConfigResponse run(SetNotifyConfigRequest request) {
    String uri = PATH;
    String reqBody = WXPayBrandUtility.toJson(request);

    Request.Builder reqBuilder = new Request.Builder().url(HOST + uri);
    reqBuilder.addHeader("Accept", "application/json");
    reqBuilder.addHeader("Wechatpay-Serial", wechatPayPublicKeyId);
    reqBuilder.addHeader("Authorization", WXPayBrandUtility.buildAuthorization(brand_id, certificateSerialNo,privateKey, METHOD, uri, reqBody));
    reqBuilder.addHeader("Content-Type", "application/json");
    RequestBody requestBody = RequestBody.create(MediaType.parse("application/json; charset=utf-8"), reqBody);
    reqBuilder.method(METHOD, requestBody);
    Request httpRequest = reqBuilder.build();

    // 发送HTTP请求
    OkHttpClient client = new OkHttpClient.Builder().build();
    try (Response httpResponse = client.newCall(httpRequest).execute()) {
      String respBody = WXPayBrandUtility.extractBody(httpResponse);
      if (httpResponse.code() >= 200 && httpResponse.code() < 300) {
        // 2XX 成功，验证应答签名
        WXPayBrandUtility.validateResponse(this.wechatPayPublicKeyId, this.wechatPayPublicKey,
            httpResponse.headers(), respBody);

        // 从HTTP应答报文构建返回数据
        return WXPayBrandUtility.fromJson(respBody, SetNotifyConfigResponse.class);
      } else {
        throw new WXPayBrandUtility.ApiException(httpResponse.code(), respBody, httpResponse.headers());
      }
    } catch (IOException e) {
      throw new UncheckedIOException("Sending request to " + uri + " failed.", e);
    }
  }

  private final String brand_id;
  private final String certificateSerialNo;
  private final PrivateKey privateKey;
  private final String wechatPayPublicKeyId;
  private final PublicKey wechatPayPublicKey;

  public SetNotifyConfig(String brand_id, String certificateSerialNo, String privateKeyFilePath, String wechatPayPublicKeyId, String wechatPayPublicKeyFilePath) {
    this.brand_id = brand_id;
    this.certificateSerialNo = certificateSerialNo;
    this.privateKey = WXPayBrandUtility.loadPrivateKeyFromPath(privateKeyFilePath);
    this.wechatPayPublicKeyId = wechatPayPublicKeyId;
    this.wechatPayPublicKey = WXPayBrandUtility.loadPublicKeyFromPath(wechatPayPublicKeyFilePath);
  }

  public static class SetNotifyConfigRequest {
    @SerializedName("notify_url")
    public String notifyUrl;
  }

  public static class SetNotifyConfigResponse {
    @SerializedName("notify_url")
    public String notifyUrl;

    @SerializedName("update_time")
    public String updateTime;
  }

}
```

注意事项：

1、[点击查看notify\_url填写注意事项](https://pay.weixin.qq.com/doc/brand/4015407551.md)

2、调用接口后，建议在日志中保留应答的HTTP头 `Request-ID` 值， `Request-ID` 作为[请求的唯一标识](https://pay.weixin.qq.com/doc/brand/4015407525.md#%E8%AF%B7%E6%B1%82%E7%9A%84%E5%94%AF%E4%B8%80%E6%A0%87%E8%AF%86)，在调用接口遇到问题时，可向微信侧提供该值用于快速定位到请求记录，协助排查问题原因。

若请求成功，请求主体将返回以下信息：

```
{"notify_url" : "你的回调地址","update_time" : "更新时间"}
```

若请求失败，请求主体将返回报错，将返回以下格式的信息，请根据具体的错误描述进行排查。

```
{"code":"错误码","message":"错误描述"}
```

为了信息安全，请求成功后还需使用公钥对返回信息进行验签，确认返回信息来自微信支付。

应答验签 `validateResponse()` 若无报错即为验签通过。
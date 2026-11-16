
package com.NTOUMarketplace.backend.product;

import static org.junit.jupiter.api.Assertions.*;

import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;

import org.bson.Document;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.test.context.ActiveProfiles;

import com.NTOUMarketplace.backend.MongoIntegrationTest;
import com.NTOUMarketplace.backend.auth.MemberRepository;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT
)
@ActiveProfiles("demo")
class ProductStatusHttpTests extends MongoIntegrationTest {

    @Value("${local.server.port}")
    private int port;

    @Autowired
    private MongoTemplate mongo;

    @Autowired
    private MemberRepository members;

    private final ObjectMapper json = new ObjectMapper();

    private final CookieManager cookies =
        new CookieManager(null, CookiePolicy.ACCEPT_ALL);

    private final HttpClient client = HttpClient.newBuilder()
        .cookieHandler(cookies)
        .followRedirects(HttpClient.Redirect.NEVER)
        .build();

    private HttpRequest.Builder request(String path) {
        return HttpRequest.newBuilder(
            URI.create("http://127.0.0.1:" + port + path)
        ).timeout(Duration.ofSeconds(15));
    }

    private HttpResponse<String> get(String path) throws Exception {
        return client.send(
            request(path).GET().build(),
            HttpResponse.BodyHandlers.ofString()
        );
    }

    private HttpResponse<String> patch(
            String path, JsonNode csrf) throws Exception {

        var builder = request(path);

        if (csrf != null) {
            builder.header(
                csrf.get("headerName").asText(),
                csrf.get("token").asText()
            );
        }

        return client.send(
            builder.method(
                "PATCH",
                HttpRequest.BodyPublishers.noBody()
            ).build(),
            HttpResponse.BodyHandlers.ofString()
        );
    }

    private JsonNode csrf() throws Exception {
        return json.readTree(get("/api/auth/csrf").body());
    }

    private void login() throws Exception {
        JsonNode token = csrf();

        String body = """
            {"account":"demo","password":"Campus123!"}
            """;

        var response = client.send(
            request("/api/auth/login")
                .header("Content-Type", "application/json")
                .header(
                    token.get("headerName").asText(),
                    token.get("token").asText()
                )
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build(),
            HttpResponse.BodyHandlers.ofString()
        );

        assertEquals(200, response.statusCode());
    }

    @Test
    void verifiesProductStatusHttpSecurity() throws Exception {

        // 取得 Demo 會員真正的 ID，不假設 ID 一定為 1
        long sellerId = members.find("demo")
            .orElseThrow()
            .id();

        // 建立兩筆測試商品
        mongo.getCollection("products").insertMany(
            java.util.List.of(
                new Document("_id", "http-own-product")
                    .append("sellerId", sellerId)
                    .append("name", "我的測試耳機")
                    .append("type", "direct")
                    .append("price", 500)
                    .append("status", "selling"),

                new Document("_id", "http-other-product")
                    .append("sellerId", sellerId + 1)
                    .append("name", "其他賣家的商品")
                    .append("type", "direct")
                    .append("price", 800)
                    .append("status", "selling")
            )
        );

        // 1. 未登入不能查看自己的商品
        assertEquals(
            401,
            get("/api/products/mine").statusCode()
        );

        // 未登入，即使持有合法 CSRF token，也不能下架
        JsonNode anonymousToken = csrf();

        assertEquals(
            401,
            patch(
                "/api/products/http-own-product/delist",
                anonymousToken
            ).statusCode()
        );

        // 2. 登入測試會員
        login();

        // 3. 登入後不帶 CSRF Token，PATCH 應被拒絕
        assertEquals(
            403,
            patch(
                "/api/products/http-own-product/delist",
                null
            ).statusCode()
        );

        // 登入後重新取得 CSRF Token
        JsonNode token = csrf();

        // 4. 不能下架別人的商品
        assertEquals(
            403,
            patch(
                "/api/products/http-other-product/delist",
                token
            ).statusCode()
        );

        // 5. 可以下架自己的商品
        var delistResponse = patch(
            "/api/products/http-own-product/delist",
            token
        );

        assertEquals(200, delistResponse.statusCode());

        assertEquals(
            "delisted",
            json.readTree(delistResponse.body())
                .get("status").asText()
        );

        // 6. 一般商品列表看不到已下架商品
        String publicBody = get("/api/products").body();

        assertFalse(
            publicBody.contains("http-own-product")
        );

        // 7. 自己的商品管理頁仍看得到
        var mine = get("/api/products/mine");

        assertEquals(200, mine.statusCode());

        JsonNode myProducts = json.readTree(mine.body());

        boolean foundDelisted = false;
        for (JsonNode product : myProducts) {
            if ("http-own-product".equals(
                    product.get("id").asText())) {
                foundDelisted = "delisted".equals(
                    product.get("status").asText()
                );
            }
        }

        assertTrue(foundDelisted);

        // 8. 一般查詢不能查所有下架商品
        assertEquals(
            400,
            get("/api/products?status=delisted")
                .statusCode()
        );

        // 9. 可以重新上架
        var relistResponse = patch(
            "/api/products/http-own-product/relist",
            token
        );

        assertEquals(200, relistResponse.statusCode());

        assertEquals(
            "selling",
            json.readTree(relistResponse.body())
                .get("status").asText()
        );

        // 10. 再次上架應回傳 409
        assertEquals(
            409,
            patch(
                "/api/products/http-own-product/relist",
                token
            ).statusCode()
        );

        // 11. 不存在的商品回傳 404
        assertEquals(
            404,
            patch(
                "/api/products/not-existing/delist",
                token
            ).statusCode()
        );
    }
}

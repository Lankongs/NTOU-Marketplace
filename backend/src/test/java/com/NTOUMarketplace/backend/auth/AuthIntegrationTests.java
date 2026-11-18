package com.NTOUMarketplace.backend.auth;

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
import org.springframework.data.mongodb.core.MongoTemplate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import com.NTOUMarketplace.backend.MongoIntegrationTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("demo")
class AuthIntegrationTests extends MongoIntegrationTest {
    @Value("${local.server.port}") int port;
    @Autowired MemberRepository members;
    @Autowired MongoTemplate mongo;
    @Autowired PasswordEncoder encoder;
    @Autowired LoginThrottle throttle;
    private final ObjectMapper json = new ObjectMapper();
    private final CookieManager cookies = new CookieManager(null, CookiePolicy.ACCEPT_ALL);
    private final HttpClient client = HttpClient.newBuilder().cookieHandler(cookies).followRedirects(HttpClient.Redirect.NEVER).build();
    private HttpRequest.Builder request(String path) { return HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path)).timeout(Duration.ofSeconds(15)); }
    private HttpResponse<String> get(String path) throws Exception { return client.send(request(path).GET().build(), HttpResponse.BodyHandlers.ofString()); }
    private HttpResponse<String> post(String path, String body, JsonNode csrf) throws Exception {
        var builder = request(path).header("Content-Type", "application/json");
        if (csrf != null) builder.header(csrf.get("headerName").asText(), csrf.get("token").asText());
        return client.send(builder.POST(HttpRequest.BodyPublishers.ofString(body)).build(), HttpResponse.BodyHandlers.ofString());
    }
    private JsonNode csrf() throws Exception { return json.readTree(get("/api/auth/csrf").body()); }
    private String sessionId() { return cookies.getCookieStore().getCookies().stream().filter(c -> c.getName().equals("JSESSIONID")).findFirst().orElseThrow().getValue(); }
    private static final String VALID = "{\"account\":\"demo\",\"password\":\"Campus123!\"}";

    @BeforeEach void resetLoginThrottle() {
        throttle.success("127.0.0.1");
        throttle.success("register:127.0.0.1");
    }

    @Test void visitorCanRegisterAndLogInWithTheNewAccount() throws Exception {
        String path = "/api/auth/register";
        String password = "Campus456!";
        String registration = json.writeValueAsString(Map.of(
            "account", " New.Member ", "displayName", " 海大新生 ", "password", password,
            "email", "123456789@MAIL.NTOU.EDU.TW"));

        assertTrue(get("/login.html").body().contains("/register.html"));
        assertEquals(200, get("/register.html").statusCode());
        assertEquals(200, get("/javascripts/auth/register.js").statusCode());
        assertEquals(403, post(path, registration, null).statusCode());
        JsonNode token = csrf();
        var created = post(path, registration, token);
        assertEquals(201, created.statusCode(), created.body());
        assertFalse(created.body().contains(password));
        assertEquals(401, get("/api/auth/me").statusCode());

        String duplicate = registration.replace(" New.Member ", "new.member").replace(password, "Other456!")
            .replace("123456789@", "987654321@");
        assertEquals(409, post(path, duplicate, token).statusCode());
        var member = members.find("new.member").orElseThrow();
        assertEquals("海大新生", member.displayName());
        assertEquals("123456789@mail.ntou.edu.tw", member.schoolEmail());
        String duplicateEmail = registration.replace(" New.Member ", "another.member");
        var conflict = post(path, duplicateEmail, token);
        assertEquals(409, conflict.statusCode());
        assertTrue(conflict.body().contains("此海大信箱已被使用"));
        assertTrue(members.find("another.member").isEmpty());
        assertThrows(org.springframework.dao.DuplicateKeyException.class, () ->
            members.create("another.member", "測試使用者", member.passwordHash(), "123456789@MAIL.NTOU.EDU.TW"));
        assertNotEquals(password, member.passwordHash());
        assertTrue(encoder.matches(password, member.passwordHash()));

        var login = post("/api/auth/login", registration, token);
        assertEquals(200, login.statusCode(), login.body());
        assertEquals(member.id(), json.readTree(login.body()).get("user").get("id").asLong());
    }

    @Test void registrationRejectsInvalidInputBeforeCreatingAMember() throws Exception {
        String path = "/api/auth/register";
        JsonNode token = csrf();
        String withoutEmail = "{\"account\":\"invalid-member\",\"displayName\":\"海大新生\",\"password\":\"Campus456!\"}";
        String registration = withoutEmail.replace("}", ",\"email\":\"123456789@mail.ntou.edu.tw\"}");
        assertEquals(400, post(path, "not JSON", token).statusCode());
        assertEquals(400, post(path, withoutEmail, token).statusCode());
        assertEquals(400, post(path, registration.replace("invalid-member", "bad account"), token).statusCode());
        var invalidName = post(path, registration.replace("海大新生", "  "), token);
        assertEquals(400, invalidName.statusCode());
        assertTrue(invalidName.body().contains("顯示名稱"));
        assertEquals(400, post(path, registration.replace("Campus456!", "short"), token).statusCode());
        assertEquals(400, post(path, registration.replace("Campus456!", "密".repeat(25)), token).statusCode());
        assertTrue(members.find("invalid-member").isEmpty());
    }

    @Test void registrationRejectsNonSchoolAndMalformedAddresses() throws Exception {
        JsonNode token = csrf();
        for (String email : new String[]{"member@gmail.com", "member@mail.ntou.edu.tw.example.com",
                "member@fake-mail.ntou.edu.tw", "@mail.ntou.edu.tw"}) {
            String registration = json.writeValueAsString(Map.of("account", "outside-member",
                "displayName", "測試使用者", "password", "Campus456!", "email", email));
            assertEquals(400, post("/api/auth/register", registration, token).statusCode(), email);
        }
        assertTrue(members.find("outside-member").isEmpty());
    }

    @Test void registrationRejectsEmailAlreadyUsedByAnOlderMember() throws Exception {
        mongo.getCollection("members").insertOne(new Document("_id", 987654L)
            .append("account", "legacy-email-member").append("schoolEmail", "Legacy.User@mail.ntou.edu.tw"));
        String registration = json.writeValueAsString(Map.of("account", "new-email-member",
            "displayName", "測試使用者", "password", "Campus456!", "email", "legacy.user@MAIL.NTOU.EDU.TW"));
        var conflict = post("/api/auth/register", registration, csrf());
        assertEquals(409, conflict.statusCode());
        assertTrue(conflict.body().contains("此海大信箱已被使用"));
        assertTrue(members.find("new-email-member").isEmpty());
    }

    @Test void completeBrowserSessionAndSecurityFlow() throws Exception {
        var loginPage = get("/login.html");
        assertEquals(200, loginPage.statusCode());
        assertTrue(loginPage.body().contains("<form id=\"loginForm\" method=\"post\" action=\"/api/auth/login\">"));
        var home = get("/index.html");
        assertEquals(200, home.statusCode()); // 訪客首頁仍可使用
        assertTrue(home.body().contains("javascripts/topArea/initTop.js"));
        assertTrue(home.body().contains("javascripts/auth/member.js"));
        var navigationScript = get("/javascripts/topArea/initTop.js");
        assertEquals(200, navigationScript.statusCode());
        assertTrue(navigationScript.body().contains("id=\"member-label\""));
        assertEquals(404, get("/node_modules/bootstrap/package.json").statusCode());
        assertEquals(401, get("/api/auth/me").statusCode());
        assertEquals(401, get("/api/products").statusCode());
        assertEquals(302, get("/home").statusCode());
        assertEquals(403, post("/api/auth/login", VALID, null).statusCode());
        JsonNode token = csrf();
        String oldSession = sessionId();
        assertEquals(400, post("/api/auth/login", "{\"account\":\" \",\"password\":\"x\"}", token).statusCode());
        assertEquals(400, post("/api/auth/login", "not json", token).statusCode());
        var wrong = post("/api/auth/login", "{\"account\":\"demo\",\"password\":\"wrong\"}", token);
        var absent = post("/api/auth/login", "{\"account\":\"unknown\",\"password\":\"wrong\"}", token);
        assertEquals(401, wrong.statusCode()); assertEquals(wrong.body(), absent.body());
        assertEquals(401, post("/api/auth/login", "{\"account\":\"' OR 1=1 --\",\"password\":\"wrong\"}", token).statusCode());
        var login = post("/api/auth/login", VALID, token);
        assertEquals(200, login.statusCode());
        assertFalse(login.body().contains("password"));
        assertEquals("demo", json.readTree(login.body()).get("user").get("account").asText());
        assertTrue(json.readTree(login.body()).get("user").get("id").isIntegralNumber());
        assertNotEquals(oldSession, sessionId());
        mongo.getCollection("products").insertOne(new Document("_id", "product-1")
            .append("type", "direct").append("name", "測試商品").append("price", 100).append("quantity", 2));
        var products = get("/api/products");
        assertEquals(200, products.statusCode());
        var product = json.readTree(products.body()).get(0);
        assertEquals("product-1", product.get("id").asText());
        assertEquals("測試商品", product.get("name").asText());
        assertEquals(100, product.get("price").asInt());
        assertFalse(products.body().contains("passwordHash"));
        assertTrue(login.headers().allValues("set-cookie").stream().anyMatch(v -> v.contains("HttpOnly") && v.contains("SameSite=Lax")));
        assertEquals(200, get("/api/auth/me").statusCode());
        String registration = json.writeValueAsString(Map.of("account", "second-account", "displayName", "測試使用者",
            "password", "Campus456!", "email", "second-account@mail.ntou.edu.tw"));
        var blockedRegistration = post("/api/auth/register", registration, csrf());
        assertEquals(409, blockedRegistration.statusCode());
        assertTrue(blockedRegistration.body().contains("請先登出"));
        assertTrue(members.find("second-account").isEmpty());
        assertEquals(302, get("/home").statusCode());
        assertEquals("/index.html", URI.create(get("/home").headers().firstValue("location").orElseThrow()).getPath());
        assertEquals(403, post("/api/auth/logout", "{}", token).statusCode()); // 登入前 token 已失效
        assertEquals(200, get("/api/auth/me").statusCode());
        String authenticatedSession = sessionId();
        assertEquals(200, post("/api/auth/logout", "{}", csrf()).statusCode());
        assertEquals(401, get("/api/auth/me").statusCode());
        var stale = HttpClient.newHttpClient().send(request("/api/auth/me").header("Cookie", "JSESSIONID=" + authenticatedSession).GET().build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(401, stale.statusCode());
        String hash = members.find("demo").orElseThrow().passwordHash();
        assertTrue(hash.startsWith("$2")); assertNotEquals("Campus123!", hash);
        assertEquals(200, post("/api/auth/login", VALID, csrf()).statusCode());
        assertEquals(200, post("/api/auth/logout", "{}", csrf()).statusCode());
        token = csrf();
        for (int i = 0; i < 10; i++) assertEquals(401, post("/api/auth/login", "{\"account\":\"demo\",\"password\":\"wrong\"}", token).statusCode());
        assertEquals(429, post("/api/auth/login", VALID, token).statusCode());
    }
}

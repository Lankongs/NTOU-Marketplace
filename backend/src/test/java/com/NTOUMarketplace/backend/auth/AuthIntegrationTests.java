package com.NTOUMarketplace.backend.auth;

import static org.junit.jupiter.api.Assertions.*;
import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = "spring.datasource.url=jdbc:h2:mem:auth-integration;DB_CLOSE_DELAY=-1")
@ActiveProfiles("demo")
class AuthIntegrationTests {
    @Value("${local.server.port}") int port;
    @Autowired JdbcTemplate jdbc;
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

    @Test void completeBrowserSessionAndSecurityFlow() throws Exception {
        assertEquals(200, get("/login.html").statusCode());
        assertEquals(200, get("/index.html").statusCode()); // 訪客首頁仍可使用
        assertTrue(get("/index.html").body().contains("member-label"));
        assertEquals(404, get("/node_modules/bootstrap/package.json").statusCode());
        assertEquals(401, get("/api/auth/me").statusCode());
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
        assertNotEquals(oldSession, sessionId());
        assertTrue(login.headers().allValues("set-cookie").stream().anyMatch(v -> v.contains("HttpOnly") && v.contains("SameSite=Lax")));
        assertEquals(200, get("/api/auth/me").statusCode());
        assertEquals(302, get("/home").statusCode());
        assertEquals("/index.html", URI.create(get("/home").headers().firstValue("location").orElseThrow()).getPath());
        assertEquals(403, post("/api/auth/logout", "{}", token).statusCode()); // 登入前 token 已失效
        assertEquals(200, get("/api/auth/me").statusCode());
        String authenticatedSession = sessionId();
        assertEquals(200, post("/api/auth/logout", "{}", csrf()).statusCode());
        assertEquals(401, get("/api/auth/me").statusCode());
        var stale = HttpClient.newHttpClient().send(request("/api/auth/me").header("Cookie", "JSESSIONID=" + authenticatedSession).GET().build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(401, stale.statusCode());
        String hash = jdbc.queryForObject("SELECT password_hash FROM members WHERE account = 'demo'", String.class);
        assertTrue(hash.startsWith("$2")); assertNotEquals("Campus123!", hash);
        assertEquals(200, post("/api/auth/login", VALID, csrf()).statusCode());
        assertEquals(200, post("/api/auth/logout", "{}", csrf()).statusCode());
        token = csrf();
        for (int i = 0; i < 10; i++) assertEquals(401, post("/api/auth/login", "{\"account\":\"demo\",\"password\":\"wrong\"}", token).statusCode());
        assertEquals(429, post("/api/auth/login", VALID, token).statusCode());
    }
}

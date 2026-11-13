package com.NTOUMarketplace.backend.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthenticationManager manager;
    private final SecurityContextRepository contexts;
    private final MemberRepository members;
    private final LoginThrottle throttle;
    public AuthController(AuthenticationManager manager, SecurityContextRepository contexts, MemberRepository members, LoginThrottle throttle) {
        this.manager = manager; this.contexts = contexts; this.members = members; this.throttle = throttle;
    }
    public record LoginRequest(@NotBlank @Size(max=100) String account, @NotBlank @Size(max=72) String password) {}
    public record MemberView(long id, String account, String displayName) {}

    @GetMapping("/csrf")
    public Map<String, String> csrf(CsrfToken csrf) {
        return Map.of("headerName", csrf.getHeaderName(), "token", csrf.getToken());
    }
    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest body, HttpServletRequest request, HttpServletResponse response) {
        if (body.password().getBytes(StandardCharsets.UTF_8).length > 72)
            return ResponseEntity.badRequest().body(Map.of("message", "密碼不可超過 72 個 UTF-8 位元組。"));
        if (!throttle.allow(request.getRemoteAddr()))
            return ResponseEntity.status(429).header("Retry-After", "900").body(Map.of("message", "登入嘗試過於頻繁，請於 15 分鐘後再試。"));
        try {
            var auth = manager.authenticate(UsernamePasswordAuthenticationToken.unauthenticated(body.account().trim().toLowerCase(Locale.ROOT), body.password()));
            // 換掉登入前的 Session，同時使舊 CSRF token 失效，避免沿用舊識別碼。
            var oldSession = request.getSession(false);
            if (oldSession != null) oldSession.invalidate();
            var context = SecurityContextHolder.createEmptyContext();
            context.setAuthentication(auth);
            SecurityContextHolder.setContext(context);
            contexts.saveContext(context, request, response);
            throttle.success(request.getRemoteAddr());
            return ResponseEntity.ok(Map.of("user", view(auth)));
        } catch (AuthenticationException ex) {
            return ResponseEntity.status(401).body(Map.of("message", "帳號或密碼錯誤。"));
        }
    }
    @GetMapping("/me")
    public Map<String, MemberView> me(Authentication auth) { return Map.of("user", view(auth)); }
    private MemberView view(Authentication auth) {
        var user = members.find(auth.getName()).orElseThrow();
        return new MemberView(user.id(), user.account(), user.displayName());
    }
}

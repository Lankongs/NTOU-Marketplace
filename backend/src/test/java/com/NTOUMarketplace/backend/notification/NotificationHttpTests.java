package com.NTOUMarketplace.backend.notification;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import com.NTOUMarketplace.backend.auth.MemberRepository;
import com.NTOUMarketplace.backend.auth.SecurityConfig;
import jakarta.servlet.Filter;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.mock.web.MockServletContext;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

// 使用既有安全設定與 Mock Session 測試，不連線資料庫
class NotificationHttpTests {
    private AnnotationConfigWebApplicationContext context;
    private MockMvc mvc;
    private MemberRepository members;
    private NotificationRepository repository;

    @Configuration
    @EnableWebMvc
    @EnableWebSecurity
    @Import({SecurityConfig.class, NotificationController.class, NotificationService.class, TestCsrfController.class})
    static class TestConfig {
        @Bean MemberRepository memberRepository() { return mock(MemberRepository.class); }
        @Bean NotificationRepository notifications() { return mock(NotificationRepository.class); }
    }

    // 測試用 GET，透過既有 CSRF filter 產生驗證資料
    @RestController
    static class TestCsrfController {
        @GetMapping("/api/auth/csrf")
        public void csrf(CsrfToken csrf) { csrf.getToken(); }
    }

    @BeforeEach
    void setUp() {
        context = new AnnotationConfigWebApplicationContext();
        context.setServletContext(new MockServletContext());
        context.register(TestConfig.class);
        context.refresh();
        mvc = MockMvcBuilders.webAppContextSetup(context)
            .addFilters(context.getBean("springSecurityFilterChain", Filter.class)).build();
        members = context.getBean(MemberRepository.class);
        repository = context.getBean(NotificationRepository.class);
        when(members.find("member-a")).thenReturn(Optional.of(
            new MemberRepository.Member(1L, "member-a", "會員甲", "unused", null, null)));
        when(members.find("member-b")).thenReturn(Optional.of(
            new MemberRepository.Member(2L, "member-b", "會員乙", "unused", null, null)));
    }

    @AfterEach
    void closeContext() {
        SecurityContextHolder.clearContext();
        context.close();
    }

    // 建立測試用的登入 Session
    private MockHttpSession session(String account) {
        var security = SecurityContextHolder.createEmptyContext();
        security.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(
            account, null, AuthorityUtils.createAuthorityList("ROLE_MEMBER")));
        var session = new MockHttpSession();
        session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, security);
        return session;
    }

    // 取得 CSRF 驗證資料後送出 PATCH 請求
    private MockHttpServletRequestBuilder patch(String path, MockHttpSession session) throws Exception {
        var request = mvc.perform(MockMvcRequestBuilders.get("/api/auth/csrf").session(session))
            .andReturn().getRequest();
        var csrf = (CsrfToken) request.getAttribute(CsrfToken.class.getName());
        return MockMvcRequestBuilders.patch(path).session(session)
            .header(csrf.getHeaderName(), csrf.getToken());
    }

    @Test
    void patchRequiresAuthenticationAndCsrf() throws Exception {
        for (String path : List.of("/api/notifications/own/read", "/api/notifications/read-all")) {
            assertEquals(401, mvc.perform(patch(path, new MockHttpSession())).andReturn().getResponse().getStatus());
            assertEquals(403, mvc.perform(MockMvcRequestBuilders.patch(path)
                .session(session("member-a"))).andReturn().getResponse().getStatus());
            assertEquals(403, mvc.perform(patch(path, session("member-a")).with(request -> {
                request.removeHeader("X-CSRF-TOKEN");
                request.addHeader("X-CSRF-TOKEN", "invalid");
                return request;
            })).andReturn().getResponse().getStatus());
        }
        verifyNoInteractions(repository);
    }

    @Test
    void readOneIsIdempotentAndCannotTargetOtherMembers() throws Exception {
        when(repository.markRead(eq("own"), eq(1L), any(Instant.class))).thenReturn(true);
        var a = session("member-a");
        for (int i = 0; i < 2; i++) {
            assertEquals(204, mvc.perform(patch("/api/notifications/own/read", a)
                .param("recipientId", "2")).andReturn().getResponse().getStatus());
        }
        assertEquals(404, mvc.perform(patch("/api/notifications/own/read", session("member-b")))
            .andReturn().getResponse().getStatus());
        assertEquals(404, mvc.perform(patch("/api/notifications/missing/read", a))
            .andReturn().getResponse().getStatus());
        verify(repository, times(2)).markRead(eq("own"), eq(1L), any(Instant.class));
        verify(repository).markRead(eq("own"), eq(2L), any(Instant.class));
    }

    @Test
    void readAllIsScopedToSessionAndEmptyInboxIsSuccessful() throws Exception {
        var a = session("member-a");
        for (int i = 0; i < 2; i++) {
            var response = mvc.perform(patch("/api/notifications/read-all", a)
                .param("recipientId", "2")).andReturn().getResponse();
            assertEquals(204, response.getStatus());
            assertEquals("", response.getContentAsString());
        }
        verify(repository, times(2)).markAllRead(eq(1L), any(Instant.class));
        verify(repository, never()).markAllRead(eq(2L), any(Instant.class));
    }

    @Test
    void deletedMemberCannotMarkNotificationsRead() throws Exception {
        when(members.find("removed")).thenReturn(Optional.empty());
        for (String path : List.of("/api/notifications/own/read", "/api/notifications/read-all")) {
            assertEquals(401, mvc.perform(patch(path, session("removed")))
                .andReturn().getResponse().getStatus());
        }
        verifyNoInteractions(repository);
    }

    @Test
    void anonymousRequestIsRejectedByExistingSecurity() throws Exception {
        var response = mvc.perform(MockMvcRequestBuilders.get("/api/notifications"))
            .andReturn().getResponse();
        assertEquals(401, response.getStatus());
        verifyNoInteractions(repository);
    }

    @Test
    void authenticatedMembersOnlySeeTheirOwnNotifications() throws Exception {
        when(repository.findByRecipientIdOrderByCreatedAtDescIdDesc(1L)).thenReturn(List.of(
            new Notification(1L, "ORDER", "ONLY_A", "甲的通知", Instant.now(), null, null)));
        when(repository.findByRecipientIdOrderByCreatedAtDescIdDesc(2L)).thenReturn(List.of(
            new Notification(2L, "ORDER", "ONLY_B", "乙的通知", Instant.now(), null, null)));
        // 傳入其他會員 ID 時，仍只查詢登入會員的通知
        var a = mvc.perform(MockMvcRequestBuilders.get("/api/notifications")
            .param("recipientId", "2").session(session("member-a"))).andReturn().getResponse();
        var b = mvc.perform(MockMvcRequestBuilders.get("/api/notifications")
            .session(session("member-b"))).andReturn().getResponse();
        assertEquals(200, a.getStatus());
        assertEquals(200, b.getStatus());
        assertTrue(a.getContentAsString().contains("ONLY_A"));
        assertFalse(a.getContentAsString().contains("ONLY_B"));
        assertFalse(a.getContentAsString().contains("recipientId"));
        assertTrue(b.getContentAsString().contains("ONLY_B"));
        assertFalse(b.getContentAsString().contains("ONLY_A"));
        verify(repository).findByRecipientIdOrderByCreatedAtDescIdDesc(1L);
        verify(repository).findByRecipientIdOrderByCreatedAtDescIdDesc(2L);
        verify(repository, never()).findAll();
    }

    @Test
    void emptyInboxReturnsEmptyArray() throws Exception {
        when(repository.findByRecipientIdOrderByCreatedAtDescIdDesc(1L)).thenReturn(List.of());
        var response = mvc.perform(MockMvcRequestBuilders.get("/api/notifications")
            .session(session("member-a"))).andReturn().getResponse();
        assertEquals(200, response.getStatus());
        assertEquals("[]", response.getContentAsString());
    }

    @Test
    void deletedMemberReturns401InsteadOf500() throws Exception {
        when(members.find("removed")).thenReturn(Optional.empty());
        var response = mvc.perform(MockMvcRequestBuilders.get("/api/notifications")
            .session(session("removed"))).andReturn().getResponse();
        assertEquals(401, response.getStatus());
        verifyNoInteractions(repository);
    }
}

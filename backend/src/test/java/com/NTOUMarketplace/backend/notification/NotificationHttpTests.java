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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

/** 使用真實 SecurityFilterChain 與 Mock Session，不載入 Boot 或連線資料庫。 */
class NotificationHttpTests {
    private AnnotationConfigWebApplicationContext context;
    private MockMvc mvc;
    private MemberRepository members;
    private NotificationRepository repository;

    @Configuration
    @EnableWebMvc
    @EnableWebSecurity
    @Import({SecurityConfig.class, NotificationController.class, NotificationService.class})
    static class TestConfig {
        @Bean MemberRepository memberRepository() { return mock(MemberRepository.class); }
        @Bean NotificationRepository notifications() { return mock(NotificationRepository.class); }
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
            new MemberRepository.Member(1L, "member-a", "會員甲", "unused")));
        when(members.find("member-b")).thenReturn(Optional.of(
            new MemberRepository.Member(2L, "member-b", "會員乙", "unused")));
    }

    @AfterEach
    void closeContext() {
        SecurityContextHolder.clearContext();
        context.close();
    }

    /** 建立測試 Session 身分，避免使用真實帳密或任何 Atlas 資料。 */
    private MockHttpSession session(String account) {
        var security = SecurityContextHolder.createEmptyContext();
        security.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(
            account, null, AuthorityUtils.createAuthorityList("ROLE_MEMBER")));
        var session = new MockHttpSession();
        session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, security);
        return session;
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
        // 即使傳入其他會員 ID，Controller 仍只相信 Session 身分。
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

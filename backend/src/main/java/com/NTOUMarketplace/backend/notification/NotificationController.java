package com.NTOUMarketplace.backend.notification;

import java.util.List;
import com.NTOUMarketplace.backend.auth.MemberRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** 通知中心僅提供目前登入會員的通知。 */
@RestController
@RequestMapping("/api/notifications")
public class NotificationController {
    private final NotificationService notifications;
    private final MemberRepository members;

    public NotificationController(NotificationService notifications, MemberRepository members) {
        this.notifications = notifications;
        this.members = members;
    }

    /** 不接受收件人參數，避免冒用其他會員的 ID。 */
    @GetMapping
    public List<NotificationView> getNotifications(Authentication auth) {
        if (auth == null || !auth.isAuthenticated() || auth instanceof AnonymousAuthenticationToken) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "請先登入。");
        }
        // Session 的帳號才是可信任身分；會員已移除時明確回應 401。
        var member = members.find(auth.getName()).orElseThrow(() ->
            new ResponseStatusException(HttpStatus.UNAUTHORIZED, "會員已不存在，請重新登入。"));
        return notifications.getNotifications(member.id()).stream()
            .map(NotificationView::from).toList();
    }
}

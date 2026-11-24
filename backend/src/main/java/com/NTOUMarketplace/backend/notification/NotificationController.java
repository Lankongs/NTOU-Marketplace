package com.NTOUMarketplace.backend.notification;

import java.util.List;
import com.NTOUMarketplace.backend.auth.MemberRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

// 查詢目前登入會員的通知
@RestController
@RequestMapping("/api/notifications")
public class NotificationController {
    private final NotificationService notifications;
    private final MemberRepository members;

    public NotificationController(NotificationService notifications, MemberRepository members) {
        this.notifications = notifications;
        this.members = members;
    }

    // 只使用登入會員 ID，不接受前端指定收件人
    @GetMapping
    public List<NotificationView> getNotifications(Authentication auth) {
        return notifications.getNotifications(memberId(auth)).stream()
            .map(NotificationView::from).toList();
    }

    // PATCH 請求需通過登入與 CSRF 檢查
    @PatchMapping("/{id}/read")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void markRead(@PathVariable String id, Authentication auth) {
        notifications.markRead(memberId(auth), id);
    }

    // 將自己的通知全部設為已讀，沒有通知也回傳成功
    @PatchMapping("/read-all")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void markAllRead(Authentication auth) {
        notifications.markAllRead(memberId(auth));
    }

    private long memberId(Authentication auth) {
        if (auth == null || !auth.isAuthenticated() || auth instanceof AnonymousAuthenticationToken) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "請先登入。");
        }
        // 根據登入帳號查詢會員，不存在時回傳 401
        var member = members.find(auth.getName()).orElseThrow(() ->
            new ResponseStatusException(HttpStatus.UNAUTHORIZED, "會員已不存在，請重新登入。"));
        return member.id();
    }
}

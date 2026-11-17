package com.NTOUMarketplace.backend.notification;

import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;

/** 提供通知查詢及其他後端模組使用的建立入口。 */
@Service
public class NotificationService {
    private final NotificationRepository notifications;

    public NotificationService(NotificationRepository notifications) {
        this.notifications = notifications;
    }

    /** 收件人必須由可信任的後端呼叫端決定。 */
    public List<Notification> getNotifications(Long recipientId) {
        validateRecipient(recipientId);
        return notifications.findByRecipientIdOrderByCreatedAtDescIdDesc(recipientId);
    }

    /** 業務成功後由訂單或競標模組呼叫，不提供公開建立 API。 */
    public Notification createNotification(Long recipientId, String type, String title,
            String content, String targetType, String targetId) {
        validateRecipient(recipientId);
        String validType = required(type, "type");
        String validTitle = required(title, "title");
        String validContent = required(content, "content");
        // 不依賴 Mongo Auditing，統一由伺服器產生時間；新通知尚未讀取。
        return notifications.insert(new Notification(recipientId, validType, validTitle,
            validContent, Instant.now(), optional(targetType), optional(targetId)));
    }

    private void validateRecipient(Long recipientId) {
        if (recipientId == null || recipientId <= 0) {
            throw new IllegalArgumentException("收件會員 ID 必須大於零");
        }
    }

    private String required(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " 不可為空白");
        }
        return value.strip();
    }

    private String optional(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}

package com.NTOUMarketplace.backend.notification;

import java.time.Instant;

// 通知回應資料，不包含收件會員 ID
public record NotificationView(String id, String type, String title, String content,
        Instant createdAt, Instant readAt, String targetType, String targetId) {
    public static NotificationView from(Notification notification) {
        return new NotificationView(notification.getId(), notification.getType(),
            notification.getTitle(), notification.getContent(), notification.getCreatedAt(),
            notification.getReadAt(), notification.getTargetType(), notification.getTargetId());
    }
}

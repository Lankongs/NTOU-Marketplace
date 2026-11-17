package com.NTOUMarketplace.backend.notification;

import java.time.Instant;

/** 對外通知資料，不暴露收件人與 MongoDB Document。 */
public record NotificationView(String id, String type, String title, String content,
        Instant createdAt, Instant readAt, String targetType, String targetId) {
    public static NotificationView from(Notification notification) {
        return new NotificationView(notification.getId(), notification.getType(),
            notification.getTitle(), notification.getContent(), notification.getCreatedAt(),
            notification.getReadAt(), notification.getTargetType(), notification.getTargetId());
    }
}

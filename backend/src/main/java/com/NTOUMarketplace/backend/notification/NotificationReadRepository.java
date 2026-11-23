package com.NTOUMarketplace.backend.notification;

import java.time.Instant;

// 透過條件更新自己的通知，避免覆蓋已讀時間
public interface NotificationReadRepository {
    boolean markRead(String id, Long recipientId, Instant readAt);
    void markAllRead(Long recipientId, Instant readAt);
}

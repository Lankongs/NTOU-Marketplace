package com.NTOUMarketplace.backend.notification;

import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

// 提供通知查詢與建立功能
@Service
public class NotificationService {
    private final NotificationRepository notifications;

    public NotificationService(NotificationRepository notifications) {
        this.notifications = notifications;
    }

    // 由後端決定收件會員 ID
    public List<Notification> getNotifications(Long recipientId) {
        validateRecipient(recipientId);
        return notifications.findByRecipientIdOrderByCreatedAtDescIdDesc(recipientId);
    }

    // 業務操作成功後由其他模組呼叫，不開放建立通知 API
    public Notification createNotification(Long recipientId, String type, String title,
            String content, String targetType, String targetId) {
        validateRecipient(recipientId);
        String validType = required(type, "type");
        String validTitle = required(title, "title");
        String validContent = required(content, "content");
        // 由伺服器設定建立時間，新通知預設未讀
        return notifications.insert(new Notification(recipientId, validType, validTitle,
            validContent, Instant.now(), optional(targetType), optional(targetId)));
    }

    // 下單成功後通知賣家，目前以商品 ID 作為關聯
    public Notification notifyOrderPlaced(Long sellerId, String productId, String productName) {
        return productNotification(sellerId, NotificationType.ORDER_PLACED, "收到新訂單",
            "你的商品「%s」已有人下單，請查看訂單詳情。", productId, productName);
    }

    // 出價成功後通知賣家，出價驗證由競標模組處理
    public Notification notifyBidPlaced(Long sellerId, String productId, String productName) {
        return productNotification(sellerId, NotificationType.BID_PLACED, "商品有新出價",
            "你的商品「%s」有新的出價，請查看商品詳情。", productId, productName);
    }

    // 確認得標結果後通知買家
    public Notification notifyAuctionWon(Long winnerId, String productId, String productName) {
        return productNotification(winnerId, NotificationType.AUCTION_WON, "恭喜得標",
            "你已得標商品「%s」，請查看商品詳情。", productId, productName);
    }

    // 通知賣家競標結束，不預設有人得標
    public Notification notifyAuctionEnded(Long sellerId, String productId, String productName) {
        return productNotification(sellerId, NotificationType.AUCTION_ENDED, "商品競標已結束",
            "你的商品「%s」競標已結束，請查看結果。", productId, productName);
    }

    private Notification productNotification(Long recipientId, NotificationType type, String title,
            String template, String productId, String productName) {
        return createNotification(recipientId, type.name(), title,
            template.formatted(required(productName, "productName")), "PRODUCT",
            required(productId, "productId"));
    }

    // 使用伺服器時間標記已讀，不存在或他人通知都回傳 404
    public void markRead(Long recipientId, String id) {
        validateRecipient(recipientId);
        if (id == null || id.isBlank() || !notifications.markRead(id, recipientId, Instant.now())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "找不到通知。");
        }
    }

    // 沒有未讀通知也回傳成功，不覆蓋原有已讀時間
    public void markAllRead(Long recipientId) {
        validateRecipient(recipientId);
        notifications.markAllRead(recipientId, Instant.now());
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

package com.NTOUMarketplace.backend.notification;

import java.time.Instant;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

// 通知資料，收件人使用會員 ID
@Document(collection = "notifications")
public class Notification {
    @Id
    private String id;
    private Long recipientId;
    private String type;
    private String title;
    private String content;
    private Instant createdAt;
    private Instant readAt;
    private String targetType;
    private String targetId;

    public Notification() {
    }

    // 由後端建立通知並設定建立時間
    public Notification(Long recipientId, String type, String title, String content,
            Instant createdAt, String targetType, String targetId) {
        this.recipientId = recipientId;
        this.type = type;
        this.title = title;
        this.content = content;
        this.createdAt = createdAt;
        this.targetType = targetType;
        this.targetId = targetId;
    }

    public String getId() { return id; }
    public Long getRecipientId() { return recipientId; }
    public String getType() { return type; }
    public String getTitle() { return title; }
    public String getContent() { return content; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getReadAt() { return readAt; }
    public String getTargetType() { return targetType; }
    public String getTargetId() { return targetId; }
}

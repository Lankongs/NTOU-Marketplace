package com.NTOUMarketplace.backend.notification;

import java.util.List;
import org.springframework.data.mongodb.repository.MongoRepository;

// 依收件人查詢，建立時間相同時再依 ID 排序
public interface NotificationRepository
        extends MongoRepository<Notification, String>, NotificationReadRepository {
    List<Notification> findByRecipientIdOrderByCreatedAtDescIdDesc(Long recipientId);
}

package com.NTOUMarketplace.backend.notification;

import java.util.List;
import org.springframework.data.mongodb.repository.MongoRepository;

/** 直接在資料庫限制收件會員，並以 ID 作為相同時間的排序依據。 */
public interface NotificationRepository extends MongoRepository<Notification, String> {
    List<Notification> findByRecipientIdOrderByCreatedAtDescIdDesc(Long recipientId);
}

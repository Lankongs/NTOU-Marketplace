package com.NTOUMarketplace.backend.notification;

import java.time.Instant;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

// 自訂通知更新，只處理收件人的未讀通知
public class NotificationReadRepositoryImpl implements NotificationReadRepository {
    private final MongoTemplate mongo;

    public NotificationReadRepositoryImpl(MongoTemplate mongo) {
        this.mongo = mongo;
    }

    // 只更新 readAt 為 null 或缺少此欄位的通知
    @Override
    public boolean markRead(String id, Long recipientId, Instant readAt) {
        Query unread = Query.query(Criteria.where("_id").is(id)
            .and("recipientId").is(recipientId).and("readAt").is(null));
        var result = mongo.updateFirst(unread, Update.update("readAt", readAt), Notification.class);
        if (result.getMatchedCount() > 0) {
            return true;
        }
        // 已讀通知也回傳成功，仍需確認是自己的通知
        return mongo.exists(Query.query(Criteria.where("_id").is(id)
            .and("recipientId").is(recipientId)), Notification.class);
    }

    // 只更新自己的未讀通知，保留原有已讀時間
    @Override
    public void markAllRead(Long recipientId, Instant readAt) {
        Query unread = Query.query(Criteria.where("recipientId").is(recipientId)
            .and("readAt").is(null));
        mongo.updateMulti(unread, Update.update("readAt", readAt), Notification.class);
    }
}

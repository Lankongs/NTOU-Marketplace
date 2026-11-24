package com.NTOUMarketplace.backend.notification;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.bson.Document;
import org.junit.jupiter.api.Test;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import com.mongodb.client.result.UpdateResult;

// 使用 Mock MongoTemplate 檢查查詢條件與更新範圍
class NotificationReadRepositoryTests {
    @Test
    void singleReadPreservesOriginalTimeAndRejectsForeignOrMissingIds() {
        var mongo = mock(MongoTemplate.class);
        var repository = new NotificationReadRepositoryImpl(mongo);
        var documents = new ArrayList<>(List.of(
            new Document("_id", "own").append("recipientId", 1L).append("readAt", null),
            new Document("_id", "foreign").append("recipientId", 2L).append("readAt", null)));
        when(mongo.updateFirst(any(Query.class), any(Update.class), eq(Notification.class)))
            .thenAnswer(call -> {
                Query query = call.getArgument(0);
                Update update = call.getArgument(1);
                var criteria = query.getQueryObject();
                assertEquals(3, criteria.size());
                assertTrue(criteria.containsKey("readAt"));
                assertNull(criteria.get("readAt"));
                long changed = 0;
                for (var document : documents) {
                    if (document.get("_id").equals(criteria.get("_id"))
                            && document.get("recipientId").equals(criteria.get("recipientId"))
                            && document.get("readAt") == null) {
                        document.put("readAt", update.getUpdateObject().get("$set", Document.class).get("readAt"));
                        changed++;
                    }
                }
                return UpdateResult.acknowledged(changed, changed, null);
            });
        when(mongo.exists(any(Query.class), eq(Notification.class))).thenAnswer(call -> {
            Query query = call.getArgument(0);
            var criteria = query.getQueryObject();
            assertEquals(2, criteria.size());
            return documents.stream().anyMatch(document -> document.get("_id").equals(criteria.get("_id"))
                && document.get("recipientId").equals(criteria.get("recipientId")));
        });
        Instant firstRead = Instant.parse("2026-11-23T01:00:00Z");
        assertTrue(repository.markRead("own", 1L, firstRead));
        assertTrue(repository.markRead("own", 1L, firstRead.plusSeconds(60)));
        assertEquals(firstRead, documents.get(0).get("readAt"));
        assertFalse(repository.markRead("foreign", 1L, firstRead));
        assertFalse(repository.markRead("missing", 1L, firstRead));
        assertNull(documents.get(1).get("readAt"));
    }

    @Test
    void readAllOnlyUpdatesOwnUnreadDocumentsIncludingLegacyMissingField() {
        var mongo = mock(MongoTemplate.class);
        var repository = new NotificationReadRepositoryImpl(mongo);
        Instant oldRead = Instant.parse("2026-11-22T01:00:00Z");
        var documents = List.of(
            new Document("recipientId", 1L).append("readAt", null),
            new Document("recipientId", 1L),
            new Document("recipientId", 1L).append("readAt", oldRead),
            new Document("recipientId", 2L).append("readAt", null));
        when(mongo.updateMulti(any(Query.class), any(Update.class), eq(Notification.class)))
            .thenAnswer(call -> {
                Query query = call.getArgument(0);
                Update update = call.getArgument(1);
                assertEquals(new Document("recipientId", 1L).append("readAt", null), query.getQueryObject());
                assertEquals(List.of("$set"), new ArrayList<>(update.getUpdateObject().keySet()));
                var fields = update.getUpdateObject().get("$set", Document.class);
                assertEquals(List.of("readAt"), new ArrayList<>(fields.keySet()));
                long changed = 0;
                for (var document : documents) {
                    if (document.get("recipientId").equals(1L) && document.get("readAt") == null) {
                        document.put("readAt", fields.get("readAt"));
                        changed++;
                    }
                }
                return UpdateResult.acknowledged(changed, changed, null);
            });
        Instant firstRead = Instant.parse("2026-11-23T01:00:00Z");
        repository.markAllRead(1L, firstRead);
        repository.markAllRead(1L, firstRead.plusSeconds(60));
        assertEquals(firstRead, documents.get(0).get("readAt"));
        assertEquals(firstRead, documents.get(1).get("readAt"));
        assertEquals(oldRead, documents.get(2).get("readAt"));
        assertNull(documents.get(3).get("readAt"));
    }
}

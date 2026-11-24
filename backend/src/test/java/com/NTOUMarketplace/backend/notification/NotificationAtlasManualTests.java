package com.NTOUMarketplace.backend.notification;

import static org.junit.jupiter.api.Assertions.*;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Properties;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.slf4j.LoggerFactory;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.repository.support.MongoRepositoryFactory;
import org.springframework.data.repository.core.support.RepositoryComposition.RepositoryFragments;
import com.mongodb.ConnectionString;
import com.mongodb.MongoClientSettings;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;

// 只供手動驗證 Atlas 寫入，未啟用時不載入設定或建立連線
@EnabledIfSystemProperty(named = "notification.atlas.enabled", matches = "true")
class NotificationAtlasManualTests {
    private static final String DATABASE = "ntou_marketplace_dev";
    private static final Long RECIPIENT_ID = 1L;
    private static final String MARKER = "[INTEGRATION TEST]";

    @Test
    void createsFourNotificationsAndRemovesOnlyThisRun() {
        assertEquals(DATABASE, System.getProperty("notification.atlas.confirmDatabase"),
            "必須明確確認開發資料庫，測試未執行");

        // 停用 driver 日誌，避免測試失敗時記錄連線設定
        Logger driverLog = (Logger) LoggerFactory.getLogger("org.mongodb.driver");
        Level previousLevel = driverLog.getLevel();
        driverLog.setLevel(Level.OFF);
        try {
            ConnectionString connection = connection();
            var settings = MongoClientSettings.builder().applyConnectionString(connection)
                .applyToClusterSettings(builder -> builder.serverSelectionTimeout(15, TimeUnit.SECONDS))
                .applyToSocketSettings(builder -> builder.connectTimeout(15, TimeUnit.SECONDS)
                    .readTimeout(15, TimeUnit.SECONDS))
                .build();
            try (MongoClient client = MongoClients.create(settings)) {
                verifyNotifications(new MongoTemplate(client, DATABASE));
            }
        } catch (RuntimeException exception) {
            // 不附上 driver 例外內容，避免 URI 或憑證進入測試報告
            throw new AssertionError("Atlas 測試或清理失敗；請檢查本機設定與通知測試識別碼，不要分享連線值");
        } finally {
            driverLog.setLevel(previousLevel);
        }
    }

    // 只在手動啟用後讀取設定；不使用 demo profile 或其他測試資料庫設定
    private ConnectionString connection() {
        try {
            String uri = System.getenv("MONGODB_URI");
            if (uri == null || uri.isBlank()) {
                var properties = new Properties();
                try (var reader = Files.newBufferedReader(Path.of(".env"))) {
                    properties.load(reader);
                }
                uri = properties.getProperty("MONGODB_URI");
            }
            if (uri == null || !uri.startsWith("mongodb+srv://")) {
                throw new IllegalStateException();
            }
            var connection = new ConnectionString(uri);
            if (!DATABASE.equals(connection.getDatabase())) {
                throw new IllegalStateException();
            }
            return connection;
        } catch (IOException | RuntimeException exception) {
            throw new AssertionError("連線前檢查失敗：需要 Atlas SRV 設定且資料庫必須是 ntou_marketplace_dev");
        }
    }

    // 不載入會員 Repository，避免啟動時建立索引或寫入會員資料
    private void verifyNotifications(MongoTemplate mongo) {
        assertEquals(DATABASE, mongo.getDb().getName());
        mongo.getDb().runCommand(new Document("ping", 1));
        assertNotNull(mongo.getCollection("members")
            .find(new Document("_id", RECIPIENT_ID)).projection(new Document("_id", 1)).first(),
            "測試會員 ID 1 不存在，未建立通知");

        String runId = "notification-it-" + UUID.randomUUID();
        String productName = MARKER + " 範例商品 " + runId;
        Query thisRun = Query.query(Criteria.where("recipientId").is(RECIPIENT_ID)
            .and("targetType").is("PRODUCT").and("targetId").is(runId)
            .and("content").regex(Pattern.quote(MARKER)));
        System.out.println("通知測試識別碼：" + runId);

        // 使用真正的 Spring Data Repository 與 Service，不使用 Mock
        var repository = new MongoRepositoryFactory(mongo).getRepository(NotificationRepository.class,
            RepositoryFragments.just(new NotificationReadRepositoryImpl(mongo)));
        var service = new NotificationService(repository);
        Instant before = Instant.now().truncatedTo(ChronoUnit.MILLIS);
        try {
            var created = List.of(
                service.notifyOrderPlaced(RECIPIENT_ID, runId, productName),
                service.notifyBidPlaced(RECIPIENT_ID, runId, productName),
                service.notifyAuctionWon(RECIPIENT_ID, runId, productName),
                service.notifyAuctionEnded(RECIPIENT_ID, runId, productName));
            assertEquals(4, created.stream().map(Notification::getId).distinct().count());

            var stored = mongo.find(thisRun, Notification.class);
            assertEquals(4, stored.size(), "本次測試應只新增四筆通知");
            assertEquals(4, mongo.getCollection("notifications")
                .countDocuments(thisRun.getQueryObject()));
            var types = List.of(NotificationType.ORDER_PLACED, NotificationType.BID_PLACED,
                NotificationType.AUCTION_WON, NotificationType.AUCTION_ENDED);
            var titles = List.of("收到新訂單", "商品有新出價", "恭喜得標", "商品競標已結束");
            var contents = List.of(
                "你的商品「" + productName + "」已有人下單，請查看訂單詳情。",
                "你的商品「" + productName + "」有新的出價，請查看商品詳情。",
                "你已得標商品「" + productName + "」，請查看商品詳情。",
                "你的商品「" + productName + "」競標已結束，請查看結果。");
            for (int i = 0; i < types.size(); i++) {
                String type = types.get(i).name();
                var notification = stored.stream().filter(item -> type.equals(item.getType()))
                    .findFirst().orElseThrow();
                assertNotNull(notification.getId());
                assertEquals(created.get(i).getId(), notification.getId());
                assertEquals(RECIPIENT_ID, notification.getRecipientId());
                assertEquals(titles.get(i), notification.getTitle());
                assertEquals(contents.get(i), notification.getContent());
                assertNotNull(notification.getCreatedAt());
                assertFalse(notification.getCreatedAt().isBefore(before));
                assertFalse(notification.getCreatedAt().isAfter(Instant.now()));
                assertNull(notification.getReadAt());
                assertEquals("PRODUCT", notification.getTargetType());
                assertEquals(runId, notification.getTargetId());
                var raw = mongo.getCollection("notifications")
                    .find(new Document("_id", new ObjectId(notification.getId()))).first();
                assertNotNull(raw);
                assertInstanceOf(Long.class, raw.get("recipientId"));
                assertInstanceOf(java.util.Date.class, raw.get("createdAt"));
                assertNull(raw.get("readAt"));
            }
            System.out.println("已驗證四個通知方法的 Atlas 寫入與欄位");
        } finally {
            // 只清理本次 UUID、收件人及測試標記都符合的通知，包含中途失敗的資料
            long removed = mongo.remove(thisRun, Notification.class).getDeletedCount();
            System.out.println("已清理本次測試通知筆數：" + removed);
            assertEquals(0, mongo.count(thisRun, Notification.class), "本次測試資料未完全清理");
        }
    }
}

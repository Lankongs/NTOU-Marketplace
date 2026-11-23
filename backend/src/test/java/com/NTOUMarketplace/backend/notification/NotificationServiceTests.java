package com.NTOUMarketplace.backend.notification;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.data.repository.query.parser.PartTree;
import org.springframework.web.server.ResponseStatusException;
import org.mockito.ArgumentCaptor;

// 使用 Mock Repository 檢查通知建立與查詢，不連線資料庫
class NotificationServiceTests {
    @Test
    void convenienceMethodsUseSharedTypesAndProductInformation() {
        var repository = mock(NotificationRepository.class);
        var service = new NotificationService(repository);
        when(repository.insert(any(Notification.class))).thenAnswer(call -> call.getArgument(0));
        var order = service.notifyOrderPlaced(1L, "product-1", "範例商品");
        var bid = service.notifyBidPlaced(1L, "product-1", "範例商品");
        var won = service.notifyAuctionWon(2L, "product-1", "範例商品");
        var ended = service.notifyAuctionEnded(1L, "product-1", "範例商品");
        assertEquals(List.of("ORDER_PLACED", "BID_PLACED", "AUCTION_WON", "AUCTION_ENDED"),
            List.of(order, bid, won, ended).stream().map(Notification::getType).toList());
        assertEquals(2L, won.getRecipientId());
        for (var notification : List.of(order, bid, won, ended)) {
            assertFalse(notification.getTitle().isBlank());
            assertTrue(notification.getContent().contains("範例商品"));
            assertEquals("PRODUCT", notification.getTargetType());
            assertEquals("product-1", notification.getTargetId());
            assertNull(notification.getReadAt());
        }
        assertThrows(IllegalArgumentException.class, () -> service.notifyBidPlaced(1L, " ", "商品"));
        assertThrows(IllegalArgumentException.class, () -> service.notifyAuctionEnded(1L, "p", null));
    }

    @Test
    void legacyAndSystemTypesRemainCompatible() {
        var repository = mock(NotificationRepository.class);
        var service = new NotificationService(repository);
        when(repository.insert(any(Notification.class))).thenAnswer(call -> call.getArgument(0));
        assertEquals("DEMO", service.createNotification(1L, "DEMO", "標題", "內容", null, null).getType());
        assertEquals("SYSTEM", service.createNotification(1L, NotificationType.SYSTEM.name(),
            "標題", "內容", null, null).getType());
    }

    @Test
    void readOperationsUseServerTimeAndHideMissingOrForeignNotifications() {
        var repository = mock(NotificationRepository.class);
        var service = new NotificationService(repository);
        when(repository.markRead(eq("own"), eq(1L), any(Instant.class))).thenReturn(true);
        Instant before = Instant.now();
        service.markRead(1L, "own");
        service.markAllRead(1L);
        var time = ArgumentCaptor.forClass(Instant.class);
        verify(repository).markRead(eq("own"), eq(1L), time.capture());
        assertFalse(time.getValue().isBefore(before));
        assertFalse(time.getValue().isAfter(Instant.now()));
        verify(repository).markAllRead(eq(1L), any(Instant.class));
        var missing = assertThrows(ResponseStatusException.class, () -> service.markRead(1L, "missing"));
        assertEquals(404, missing.getStatusCode().value());
        assertThrows(IllegalArgumentException.class, () -> service.markRead(0L, "own"));
        assertThrows(IllegalArgumentException.class, () -> service.markAllRead(null));
    }

    @Test
    void createsThenQueriesNotificationThroughRepository() {
        var repository = mock(NotificationRepository.class);
        var service = new NotificationService(repository);
        when(repository.insert(any(Notification.class))).thenAnswer(invocation -> {
            Notification saved = invocation.getArgument(0);
            when(repository.findByRecipientIdOrderByCreatedAtDescIdDesc(7L))
                .thenReturn(List.of(saved));
            return saved;
        });
        Instant before = Instant.now();
        var saved = service.createNotification(7L, " ORDER ", " 訂單成立 ", " 收到訂單 ", null, null);
        Instant after = Instant.now();
        assertEquals(List.of(saved), service.getNotifications(7L));
        assertEquals(7L, saved.getRecipientId());
        assertEquals("ORDER", saved.getType());
        assertEquals("訂單成立", saved.getTitle());
        assertEquals("收到訂單", saved.getContent());
        assertFalse(saved.getCreatedAt().isBefore(before));
        assertFalse(saved.getCreatedAt().isAfter(after));
        assertNull(saved.getReadAt());
        assertNull(saved.getTargetType());
        assertNull(saved.getTargetId());
    }

    @Test
    void rejectsMissingRequiredDataBeforeWriting() {
        var repository = mock(NotificationRepository.class);
        var service = new NotificationService(repository);
        assertThrows(IllegalArgumentException.class,
            () -> service.createNotification(null, "ORDER", "標題", "內容", null, null));
        assertThrows(IllegalArgumentException.class,
            () -> service.createNotification(0L, "ORDER", "標題", "內容", null, null));
        assertThrows(IllegalArgumentException.class,
            () -> service.createNotification(1L, " ", "標題", "內容", null, null));
        assertThrows(IllegalArgumentException.class,
            () -> service.createNotification(1L, "ORDER", null, "內容", null, null));
        assertThrows(IllegalArgumentException.class,
            () -> service.createNotification(1L, "ORDER", "標題", " ", null, null));
        assertThrows(IllegalArgumentException.class, () -> service.getNotifications(-1L));
        verifyNoInteractions(repository);
    }

    @Test
    void repositoryQueryRestrictsRecipientAndSortsNewestThenIdDescending() throws Exception {
        String method = NotificationRepository.class.getDeclaredMethod(
            "findByRecipientIdOrderByCreatedAtDescIdDesc", Long.class).getName();
        var query = new PartTree(method, Notification.class);
        var parts = query.getParts().toList();
        assertEquals(1, parts.size());
        assertEquals("recipientId", parts.get(0).getProperty().toDotPath());
        var orders = query.getSort().toList();
        assertEquals(List.of("createdAt", "id"), orders.stream().map(o -> o.getProperty()).toList());
        assertTrue(orders.stream().allMatch(o -> o.isDescending()));
        // 確認 Service 保留 Repository 回傳的順序
        var repository = mock(NotificationRepository.class);
        var ordered = List.of(
            new Notification(1L, "ORDER", "新", "內容", Instant.parse("2026-11-17T02:00:00Z"), null, null),
            new Notification(1L, "ORDER", "舊", "內容", Instant.parse("2026-11-17T01:00:00Z"), null, null));
        when(repository.findByRecipientIdOrderByCreatedAtDescIdDesc(1L)).thenReturn(ordered);
        assertEquals(ordered, new NotificationService(repository).getNotifications(1L));
    }
}

package com.NTOUMarketplace.backend.notification;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.data.repository.query.parser.PartTree;

/** Mock 儲存邊界與解析實際查詢名稱，不連線任何 MongoDB。 */
class NotificationServiceTests {
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
        // Service 應保留 Repository 的順序，不在記憶體另查全部資料。
        var repository = mock(NotificationRepository.class);
        var ordered = List.of(
            new Notification(1L, "ORDER", "新", "內容", Instant.parse("2026-11-17T02:00:00Z"), null, null),
            new Notification(1L, "ORDER", "舊", "內容", Instant.parse("2026-11-17T01:00:00Z"), null, null));
        when(repository.findByRecipientIdOrderByCreatedAtDescIdDesc(1L)).thenReturn(ordered);
        assertEquals(ordered, new NotificationService(repository).getNotifications(1L));
    }
}

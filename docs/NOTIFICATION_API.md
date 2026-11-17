# NTOU Marketplace — 通知中心 API 規格

> 適用於目前 `notification` 模組的後端 MVP。內容以 Java 原始碼與通知測試為準；建立通知的內部服務已完成，但尚未串接競標、訂單、聊天事件或通知前端。

## 1. API 概覽

- **方法與路徑**：`GET /api/notifications`
- **用途**：查詢目前登入會員收到的通知。
- **認證**：需要有效的登入 Session，沿用既有 Spring Security 與 HttpSession。
- **回傳格式**：JSON 通知陣列；沒有通知時回傳 HTTP 200 與 `[]`。
- **存取控制**：後端使用 `Authentication.getName()` 取得帳號，再透過 `MemberRepository.find(account)` 取得會員 ID；不接受前端自行指定查詢身分。
- **排序**：`createdAt` 降冪，再依 `id` 降冪；MongoDB 的 ID 欄位是 `_id`。
- **目前範圍**：只提供列表 GET API，不提供公開建立通知、修改已讀或未讀數量 API。

## 2. 請求方式與登入要求

目前沒有支援的 Query Parameters，也沒有分頁、通知類型或未讀篩選參數。

即使請求附加 `recipientId`，Controller 也不會用它決定收件人；查詢仍以登入會員 ID 為準。查詢條件直接送進 Repository，不會先讀取全部通知再由前端過濾。

```http
GET /api/notifications
```

前後端同源時，由瀏覽器維持登入 Session；此 GET 請求不需要 CSRF 驗證資料。不要自行把驗證憑證寫入前端或文件。

## 3. 回應格式與錯誤處理

成功：HTTP 200，回傳 `NotificationView` 陣列，不直接暴露 MongoDB Document 或 `recipientId`。

以下僅為格式示意，不表示系統已自動產生競標或訂單通知：

```json
[
  {
    "id": "EXAMPLE_NOTIFICATION_ID",
    "type": "DEMO",
    "title": "通知中心展示",
    "content": "這是一筆展示通知，不代表真實交易事件。",
    "createdAt": "2026-11-17T02:00:00Z",
    "readAt": null,
    "targetType": null,
    "targetId": null
  }
]
```

| 回應欄位 | 型別與說明 |
| --- | --- |
| `id` | 字串，通知識別值；不是 JSON 欄位 `_id`。 |
| `type` | 字串，目前沒有 enum 或固定白名單。 |
| `title`、`content` | 通知標題及內容。 |
| `createdAt` | `Instant` 序列化的時間，範例使用 UTC。 |
| `readAt` | 時間或 `null`；新通知預設為 `null`。目前沒有更新此欄位的 API。 |
| `targetType`、`targetId` | 字串或 `null`，僅儲存關聯目標；不會自動查詢目標或產生跳轉網址。 |

| HTTP 狀態碼 | 情況 |
| --- | --- |
| 200 | 查詢成功；無通知時為 `[]`。 |
| 401 | 未登入，由既有 SecurityFilterChain 拒絕，例如 `{"message":"請先登入。"}`。 |
| 401 | Session 身分仍存在，但已查不到對應會員；Controller 明確拋出 `ResponseStatusException`，避免非預期 500。此路徑的錯誤本文由框架處理，不保證與 SecurityFilterChain 的 JSON 相同。 |
| 5xx | 資料庫不可用等伺服器錯誤；通知模組尚未定義專用錯誤本文、重試或降級機制。 |

## 4. MongoDB 資料模型

`Notification.java` 使用一般 class、private 欄位、無參數建構子及 getters，並設定 `@Document(collection = "notifications")`。沒有使用 `@Field` 改名。

| Collection 欄位 | Java 型別 | BSON 型別／規則 |
| --- | --- | --- |
| `_id` | `@Id String id` | Spring Data 對可轉換的 ID 使用 ObjectId；讀回 Java 為字串。一般由新增流程產生 ID，手動建資料建議使用 BSON ObjectId。 |
| `recipientId` | `Long` | Int64；對應會員的真實數字 ID。Service 要求大於零。 |
| `type` | `String` | String；Service 要求非 null、非空白。 |
| `title` | `String` | String；Service 要求非 null、非空白。 |
| `content` | `String` | String；Service 要求非 null、非空白。 |
| `createdAt` | `Instant` | Date；由 Service 呼叫 `Instant.now()` 設定，不依賴 Mongo Auditing。 |
| `readAt` | `Instant` | Date 或 null；保留未來已讀功能。 |
| `targetType` | `String` | String 或 null。 |
| `targetId` | `String` | String 或 null；與數字會員 ID 分開處理。 |

這些是 Java 映射與 Service 驗證規則，不是已建立的 MongoDB collection validator。直接透過 Compass 插入會繞過 Service 驗證與時間產生邏輯。

Repository 繼承 `MongoRepository<Notification, String>`，使用：

```java
List<Notification> findByRecipientIdOrderByCreatedAtDescIdDesc(Long recipientId);
```

目前沒有自訂複合索引建立邏輯，也沒有分頁或筆數上限；Atlas 既有索引未確認。

## 5. 內部通知建立服務

實際方法簽章位於 `NotificationService.java`：

```java
public Notification createNotification(
    Long recipientId,
    String type,
    String title,
    String content,
    String targetType,
    String targetId
)
```

| 項目 | 規則 |
| --- | --- |
| 回傳值 | Repository 新增後的 `Notification`。 |
| `recipientId` | 非 null 且大於零；會員存在性由可信任的後端呼叫端確認。 |
| `type`、`title`、`content` | 非 null、非空白，使用 `strip()` 去除頭尾空白。 |
| `targetType`、`targetId` | 可為 null；空白轉 null，其餘去除頭尾空白，不要求成對提供。 |
| 時間 | 伺服器設定 `createdAt`，新通知 `readAt` 為 null。 |
| 驗證失敗 | 拋出 `IllegalArgumentException`，不呼叫 Repository 寫入。 |

目前未限制文字長度、通知類型或驗證目標存在性；沒有公開 POST 建立通知 API。

未來競標 Service 可使用建構子注入，於成功確認結標結果後呼叫。以下是**整合示意，尚未存在於競標模組**：

```java
private final NotificationService notificationService;

public AuctionService(NotificationService notificationService) {
    this.notificationService = notificationService;
}

// winnerId、productId 必須來自後端確認的結標結果。
// 在成功確定得標結果後執行；此處不包含競標結算實作。
public void notifyWinner(Long winnerId, String productId) {
    notificationService.createNotification(
        winnerId,
        "AUCTION_WON",
        "恭喜得標",
        "你已得標此商品。",
        "PRODUCT",
        productId
    );
}
```

呼叫端需匯入 `com.NTOUMarketplace.backend.notification.NotificationService`。`AUCTION_WON`、`PRODUCT` 是範例約定，目前沒有 enum 強制或對應的自動跳轉功能。

FR-M-07 的結標通知由競標模組負責觸發。競標模組須根據實際結標結果，分別決定賣家與得標買家的通知內容及收件人，並避免重複結標造成重複通知。通知模組負責儲存與查詢；無人出價、失敗重試與防重複仍待整合，此方法不會自動與競標結果組成交易，也不提供可靠投遞保證。

## 6. 前端串接範例

```javascript
const response = await fetch('/api/notifications', {
  credentials: 'same-origin'
});
if (response.status === 401) {
  // 引導使用者重新登入。
} else if (!response.ok) {
  throw new Error(`通知查詢失敗：HTTP ${response.status}`);
} else {
  const notifications = await response.json();
  // 由前端呈現列表；通知文字應透過 textContent 填入。
}
```

此片段僅供組員整合參考，尚未接到現有通知鈴鐺。不要傳入會員 ID 決定查詢身分，也不要把資料庫設定或驗證憑證寫入 JavaScript。

## 7. 測試結果與已知限制

### 自動化測試

從專案根目錄進入 `backend`，執行指定測試：

```powershell
Set-Location backend
.\mvnw.cmd "-Dtest=NotificationHttpTests,NotificationServiceTests" test
```

上述指定測試使用 Mock Repository、現有 SecurityFilterChain 與 Mock Session，不連線 MongoDB；其他整合測試不一定如此。

| 測試類別 | 已測試內容 |
| --- | --- |
| `NotificationHttpTests`（4 項） | 未登入與會員不存在時 401、A／B 隔離及參數不可冒用、DTO 不含收件人、空列表。 |
| `NotificationServiceTests`（3 項） | Mock 新增與查詢、時間及必要欄位驗證、收件人查詢與排序契約。 |

既有本機 Surefire 報告：**7 項 Mock 測試通過，Failures 0、Errors 0、Skipped 0**。此次文件更新未重新執行測試。

### 實際整合驗證

依開發者回報，已在 `ntou_marketplace_dev.notifications` **手動新增兩筆測試通知**，使用 Demo 帳號登入後：

- `GET /api/notifications` 成功回傳兩筆通知。
- 結果依 `createdAt` 降冪排序，回應不包含 `recipientId`。

這證明該次 **Atlas → Repository → Service → Controller → JSON 的讀取路徑正常**。本次文件更新沒有連線或寫入資料庫。

| 測試項目 | 狀態 |
| --- | --- |
| Atlas 手動新增通知 | 已驗證 |
| Spring Boot API 讀取 Atlas 通知 | 已驗證 |
| 通知依建立時間降冪排列 | 已驗證 |
| `NotificationService` 寫入 Atlas | 尚未驗證 |
| Spring Boot 重啟後再次讀取 | 尚未驗證 |
| 不同真實會員的資料隔離 | 尚未驗證 |

### 完成範圍與限制

- **已完成**：通知模型、收件人限定查詢與排序、安全 DTO、登入整合、會員不存在處理、內部建立通知服務。
- **已測試**：7 項 Mock 測試，以及上述手動資料的 Atlas 讀取驗證。
- **尚未驗證**：上表所列項目，以及相同建立時間的 ID 排序與查詢效能。Mock HTTP 測試本身不涵蓋完整帳密登入。
- **尚未實作或串接**：通知前端、結標／出價／訂單／聊天自動通知、推播或輪詢、已讀 API、未讀數量、分頁、複合索引、保存期限及可靠重試／防重複。
- 手動插入通知**不代表自動競標通知或 FR-M-07 已完成**。正常啟動不會自動建立測試通知，也沒有初始化 Java 類別或公開測試資料 API。
- `readAt` 僅為預留欄位，不代表已完成已讀功能或 FR-M-09 聊天室未讀紅點。

## 8. 相關檔案

主要程式共用目錄：`backend/src/main/java/com/NTOUMarketplace/backend/notification/`

| 檔名 | 用途 |
| --- | --- |
| `Notification.java` | MongoDB 通知資料模型。 |
| `NotificationRepository.java` | 收件人條件與排序查詢。 |
| `NotificationService.java` | 內部建立通知與查詢。 |
| `NotificationController.java` | GET API 與會員身分解析。 |
| `NotificationView.java` | 對外回應 DTO。 |

測試目錄：`backend/src/test/java/com/NTOUMarketplace/backend/notification/`

- `NotificationHttpTests.java`：HTTP 存取控制與回應測試。
- `NotificationServiceTests.java`：Service 與 Repository 查詢契約測試。

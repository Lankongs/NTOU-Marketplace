# NTOU Marketplace — 通知中心 API 規格

> 適用於目前 `notification` 模組。已提供通知查詢、已讀更新及內部建立服務；尚未串接競標、訂單、聊天事件或通知前端。

## 1. API 概覽

- **API**：`GET /api/notifications`、`PATCH /api/notifications/{id}/read`、`PATCH /api/notifications/read-all`。
- **用途**：查詢自己的通知、標記單筆或全部已讀。
- **認證**：需要有效的登入 Session，沿用既有 Spring Security 與 HttpSession。
- **回傳格式**：GET 回傳 JSON 通知陣列，沒有通知時為 HTTP 200 與 `[]`；PATCH 成功回傳 204，無本文。
- **存取控制**：後端依登入身分取得會員 ID，只能查詢及更新自己的通知。
- **排序**：`createdAt` 降冪，再依 `id` 降冪。
- **目前範圍**：不提供公開建立通知或未讀數量 API；建立通知由其他後端模組呼叫 Service。

## 2. 請求方式與登入要求

三支 API 都需要登入，不接受收件人 Query Parameter；列表尚無分頁、通知類型或未讀篩選。

即使請求附加 `recipientId`，也不會改變查詢或更新對象。

```http
GET /api/notifications
PATCH /api/notifications/EXAMPLE_NOTIFICATION_ID/read
PATCH /api/notifications/read-all
```

| API | 請求內容 | 成功回應 |
| --- | --- | --- |
| `GET /api/notifications` | 無 Body，不需 CSRF | 200，通知陣列 |
| `PATCH /api/notifications/{id}/read` | `id` 為通知 ID；無 Body，需 CSRF | 204，無本文 |
| `PATCH /api/notifications/read-all` | 無 Body，需 CSRF | 204，無本文 |

前後端同源時由瀏覽器維持登入 Session。PATCH 前先呼叫 `GET /api/auth/csrf`，將回傳的 `headerName` 與 `token` 作為標頭名稱與值；範例見第 6 節。不要在程式或文件中寫入真實驗證憑證。

## 3. 回應格式與錯誤處理

GET 成功回傳 HTTP 200 與通知陣列，不包含 `recipientId`。PATCH 成功為 HTTP 204，沒有回應本文。

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
| `type` | 字串，標準值見第 5 節；舊類型如 `DEMO` 仍可讀取。 |
| `title`、`content` | 通知標題及內容。 |
| `createdAt` | 建立時間字串，範例使用 UTC。 |
| `readAt` | `null` 代表未讀，非 null 代表已讀；PATCH 使用伺服器時間，重複操作保留原時間。 |
| `targetType`、`targetId` | 字串或 `null`，供前端決定通知點擊後的跳轉目標；目前沒有固定 URL 規格。 |

| HTTP 狀態碼 | 情況 |
| --- | --- |
| 200 | 查詢成功；無通知時為 `[]`。 |
| 204 | 單筆或全部已讀成功；重複操作、沒有未讀通知時也成功。 |
| 401 | 未登入、Session 失效或會員已不存在。未登入時例如 `{"message":"請先登入。"}`；其他路徑不保證使用相同錯誤本文。 |
| 403 | PATCH 缺少或帶入無效的 CSRF 驗證資料；即使未登入也可能先收到 403。 |
| 404 | 單筆通知不存在或不屬於登入會員；兩者統一回應，避免洩漏他人資料。 |
| 5xx | 資料庫不可用等伺服器錯誤；通知模組尚未定義專用錯誤本文、重試或降級機制。 |

重複標記已讀不會覆蓋第一次 `readAt`；全部已讀只更新自己的未讀通知，空列表也回傳 204。前端應依 HTTP 狀態碼處理錯誤。

## 4. MongoDB 資料模型

Collection 名稱為 `notifications`，主要欄位如下：

| 欄位 | 儲存型別與用途 |
| --- | --- |
| `_id` | 通知識別值，通常為 ObjectId；API 以字串 `id` 回傳。 |
| `recipientId` | Int64（Java `Long`），收件會員的真實 ID，不回傳前端。 |
| `type` | String，通知類型。 |
| `title`、`content` | String，標題及內容。 |
| `createdAt` | Date（Java `Instant`），由後端設定建立時間。 |
| `readAt` | Date 或 null；null 代表未讀，非 null 代表已讀。 |
| `targetType`、`targetId` | String 或 null，關聯目標類型及 ID。 |

直接透過 Compass 建立資料會繞過 Service 驗證；正常建立通知應呼叫下節的內部服務。

## 5. 內部通知建立服務（供直購、訂單、競標等模組使用）

### 通知類型

| `NotificationType` | 用途／收件人 | 便利方法產生的標題 |
| --- | --- | --- |
| `ORDER_PLACED` | 下單成功，通知賣家 | 收到新訂單 |
| `BID_PLACED` | 出價成功，通知賣家 | 商品有新出價 |
| `AUCTION_WON` | 確認得標，通知買家 | 恭喜得標 |
| `AUCTION_ENDED` | 競標結束，通知賣家，不預設有人得標 | 商品競標已結束 |
| `SYSTEM` | 一般系統通知，由呼叫端指定收件人與文字 | 使用共用建立方法自訂 |

新程式使用 `NotificationType`；共用方法與資料欄位仍保留 String，舊類型如 `DEMO` 仍可讀取。

### 共用建立方法

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

其他後端 Service 可透過建構子注入 `NotificationService`。呼叫時機與收件人由業務模組決定，目前尚未自動串接業務事件。

| 項目 | 規則 |
| --- | --- |
| 回傳值 | Repository 新增後的 `Notification`。 |
| `recipientId` | 非 null 且大於零；會員存在性由可信任的後端呼叫端確認。 |
| `type`、`title`、`content` | 非 null、非空白，使用 `strip()` 去除頭尾空白。 |
| `targetType`、`targetId` | 可為 null；空白轉 null，其餘去除頭尾空白，不要求成對提供。 |
| 時間 | 伺服器設定 `createdAt`，新通知 `readAt` 為 null。 |
| 驗證失敗 | 拋出 `IllegalArgumentException`，不呼叫 Repository 寫入。 |

目前未限制文字長度或強制 enum 白名單，也不驗證關聯目標是否存在；沒有公開 POST 建立通知 API。一般系統通知可呼叫：

```java
notificationService.createNotification(
    recipientId, NotificationType.SYSTEM.name(), "系統公告", "公告內容", null, null
);
```

### 四種便利方法

```java
public Notification notifyOrderPlaced(Long sellerId, String productId, String productName)
public Notification notifyBidPlaced(Long sellerId, String productId, String productName)
public Notification notifyAuctionWon(Long winnerId, String productId, String productName)
public Notification notifyAuctionEnded(Long sellerId, String productId, String productName)
```

| 參數 | 意義 |
| --- | --- |
| `sellerId`／`winnerId` | 後端確認的賣家／得標會員 ID，必須大於零。 |
| `productId` | 實際商品 ID，非 null、非空白。 |
| `productName` | 商品名稱，非 null、非空白；由方法填入通知內容。 |

四個方法都回傳新增的 `Notification`，自動產生標題及含商品名稱的內容，設定 `targetType="PRODUCT"`、`targetId=productId`。目前不接受訂單 ID 或出價金額；下單通知也以商品為目標。前端須另與組員約定跳轉方式，後端不產生固定 URL。

| 業務事件 | 呼叫方法 | 收件人 |
| --- | --- | --- |
| 直購訂單成功建立 | `notifyOrderPlaced(...)` | 賣家 |
| 出價成功 | `notifyBidPlaced(...)` | 賣家 |
| 結標並確認得標者 | `notifyAuctionWon(...)` | 得標買家 |
| 競標結束（不預設有人得標） | `notifyAuctionEnded(...)` | 賣家 |

上表是整合約定，**不代表這些事件已接上通知服務**；訂單與競標模組必須先確認業務結果，再決定是否呼叫。

其他 Service 可透過建構子注入 `NotificationService`，於業務成功後呼叫。以下是**不同事件的獨立使用範例，不應一次全部呼叫**：

```java
// 直購下單成功，通知賣家
notificationService.notifyOrderPlaced(sellerId, productId, productName);
// 出價成功，通知賣家
notificationService.notifyBidPlaced(sellerId, productId, productName);
// 確認得標結果，通知買家
notificationService.notifyAuctionWon(winnerId, productId, productName);
// 結標完成，通知賣家
notificationService.notifyAuctionEnded(sellerId, productId, productName);
```

**通知建立與業務交易尚無原子性保證，重試、補發與防重複機制也尚未實作。** 業務成功後若通知寫入失敗，目前不保證自動補發；再次呼叫可能新增重複通知，需由組員協調處理。

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

單筆／全部已讀範例（使用者點選時擇一呼叫）：

```javascript
async function markRead(path) {
  const csrfResponse = await fetch('/api/auth/csrf', { credentials: 'same-origin' });
  if (!csrfResponse.ok) throw new Error(`CSRF 取得失敗：HTTP ${csrfResponse.status}`);
  const csrf = await csrfResponse.json();
  const response = await fetch(path, {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: { [csrf.headerName]: csrf.token }
  });
  if (!response.ok) throw new Error(`已讀更新失敗：HTTP ${response.status}`);
  // 204 沒有本文，重新查詢列表即可取得 readAt。
}

// 單筆已讀，id 來自 GET 回應
await markRead(`/api/notifications/${encodeURIComponent(id)}/read`);
// 全部已讀
await markRead('/api/notifications/read-all');
```

PATCH 遇到 401 應引導使用者重新登入；403 可重新取得 CSRF Token 後最多重試一次，若仍失敗則顯示錯誤訊息；單筆遇到 404 可重新整理列表。不要使用只支援 POST 的共用 `post()` 送 PATCH。

此片段僅供組員整合參考，尚未接到現有通知鈴鐺。不要傳入會員 ID 決定查詢身分，也不要把資料庫設定或驗證憑證寫入 JavaScript。

## 7. 測試結果與已知限制

### 自動化測試

從專案根目錄進入 `backend`，執行指定測試：

```powershell
Set-Location backend
.\mvnw.cmd "-Dtest=NotificationHttpTests,NotificationServiceTests,NotificationReadRepositoryTests" test
```

上述指定測試使用 Mock Repository、現有 SecurityFilterChain 與 Mock Session，不連線 MongoDB；其他整合測試不一定如此。

| 測試類別 | 已測試內容 |
| --- | --- |
| `NotificationHttpTests`（8 項） | GET、單筆與全部已讀的登入、CSRF、跨會員限制、404、空列表及重複操作。 |
| `NotificationServiceTests`（6 項） | 四種便利方法、舊類型相容、欄位與時間驗證、查詢與已讀呼叫。 |
| `NotificationReadRepositoryTests`（2 項） | 收件人限定更新、保留第一次已讀時間、全部已讀及舊資料缺少 readAt。 |

**16 項自動化測試通過，Failures 0、Errors 0、Skipped 0**。

### 實際整合驗證

- GET、單筆已讀、全部已讀及 Atlas 持久化已實測成功；列表依建立時間降冪，回應不含 `recipientId`。
- **2026-11-24 已手動執行 `NotificationAtlasManualTests`**：`Tests run: 1, Failures: 0, Errors: 0, Skipped: 0`，`BUILD SUCCESS`。涵蓋四種便利方法、Atlas 寫入、重新讀取、欄位驗證及本次測試資料清理。
- 手動 Atlas 測試預設停用，需明確啟用及確認資料庫才會執行；不屬於上述 16 項 Mock 測試。

以上整合結果依開發者回報及既有測試報告記錄；本次文件更新沒有重跑測試或連線資料庫。

### 完成範圍與限制

- **已完成的後端**：三支 HTTP API、安全回應 DTO、五種標準類型、共用建立方法與四種便利方法。
- **尚待驗證**：Spring Boot 重啟後再次讀取、不同真實會員隔離、相同建立時間的 ID 實際排序及查詢效能。
- **尚未實作或串接**：通知前端、結標／出價／訂單／聊天事件觸發、推播或輪詢、未讀數量、分頁、複合索引、保存期限及可靠重試／防重複。
- 手動整合測試通過**不代表自動競標通知或 FR-M-07 已完成**；正常啟動不會建立測試通知，也沒有公開建立通知 API。
- 通知已讀 API 不代表已完成 FR-M-09 的聊天室未讀紅點。

## 8. 相關檔案

主要程式共用目錄：`backend/src/main/java/com/NTOUMarketplace/backend/notification/`

| 檔名 | 用途 |
| --- | --- |
| `Notification.java` | MongoDB 通知資料模型。 |
| `NotificationRepository.java` | 收件人條件與排序查詢。 |
| `NotificationReadRepository.java`、`NotificationReadRepositoryImpl.java` | 本人通知的條件已讀更新。 |
| `NotificationType.java` | 五種標準通知類型。 |
| `NotificationService.java` | 內部建立通知與查詢。 |
| `NotificationController.java` | GET 與兩支 PATCH API、登入會員身分解析。 |
| `NotificationView.java` | 對外回應 DTO。 |

測試目錄：`backend/src/test/java/com/NTOUMarketplace/backend/notification/`

- `NotificationHttpTests.java`：HTTP 存取控制與回應測試。
- `NotificationServiceTests.java`：Service 與 Repository 查詢契約測試。
- `NotificationReadRepositoryTests.java`：已讀更新條件與冪等測試。
- `NotificationAtlasManualTests.java`：預設停用的 Atlas 手動整合測試。

# NTOU Marketplace — 商品查詢 API 規格

> 適用於 `feature/product-search` 的目前實作。此分支以 `codex/mongodb-migration` 為基礎；正式整合前請確認 PR 與分支狀態。

## 1. API 概覽

- **方法與路徑**：`GET /api/products`
- **用途**：讀取、搜尋、篩選、排序商品
- **認證**：需要有效的登入 Session（`JSESSIONID`）；未登入返回 HTTP 401，例如 `{"message":"請先登入。"}`
- **回傳格式**：JSON 商品陣列；若查無符合結果，回傳 `[]`
- **相容性**：不帶任何參數時仍回傳全部商品

## 2. Query Parameters

| 參數 | 必填 | 可用值或規則 | 說明 |
| --- | --- | --- | --- |
| `keyword` | 否 | 任意文字 | 搜尋 `name` 包含的文字；英文字母不區分大小寫，前後空白會移除。不是全文搜尋，不會搜尋 `desc`。 |
| `type` | 否 | `direct`、`auction` | 商品類型；其他非空值回傳 HTTP 400。 |
| `tag` | 否 | 標籤文字 | 比對商品 `tags` 陣列中的完整標籤值，例如 `電子`；不是標籤內的部分字串搜尋。 |
| `sort` | 否 | `price_asc`、`price_desc` | 按有效排序價格升冪或降冪；其他非空值回傳 HTTP 400。 |
| `status` | 否 | `selling`、`sold` | 商品販售狀態：販售中或已售出；其他非空值回傳 HTTP 400。 |

參數可任意組合，條件之間使用 **AND**（全部符合）。空值與全空白參數視為未指定。未實作分頁或其他排序方式。

## 3. 排序價格計算

- `direct`：使用 `price`
- `auction`：若有 `currentPrice`，使用該值；否則使用 `startPrice`
- `currentPrice` 為供查詢使用的目前最高出價資料欄位；目前尚未實作真正的競標出價／最高出價更新 API，也沒有即時推播。前端需要重新請求列表才能取得更新後的順序。
- 若商品缺少相應價格欄位，現有查詢沒有另外設計缺值商品的排列規則，資料建置時應確保必要欄位存在。

## 4. 商品販售狀態與預設行為

| MongoDB 中的 `status` | `status=selling` | `status=sold` | 意義 |
| --- | --- | --- | --- |
| `"selling"` | 符合 | 不符合 | 販售中 |
| `"sold"` | 不符合 | 符合 | 已售出 |
| `null` 或欄位不存在 | **符合** | 不符合 | 舊資料相容：暫時視為販售中 |

- `Product.java` 設有 `private String status = "selling";`，表示**透過 Java 建立的新 `Product` 物件**，未指定狀態時預設為 `selling`。這不是 MongoDB Schema 的自動預設值，直接由 Compass 或其他程式新增文件時仍須明確寫入狀態。
- 未設定 `status` 的既有文件在查詢 `status=selling` 時仍會被納入，以相容早期資料。若舊商品實際已售出，必須先核實並改成 `sold`；不應一律視為可購買。
- 回應 JSON 的 `status` 是物件序列化後的值；對舊資料的查詢相容處理**不會把 MongoDB 文件自動更新**。Java 物件欄位初始化也不能保證每一種資料讀取或新增路徑都會把值寫回資料庫。
- 未帶 `status` 參數時，不依販售狀態排除商品，會同時回傳販售中、已售出和舊商品（若符合其他查詢條件）。
- `status` 是**資料欄位及查詢條件**，目前並未實作將商品標記為售出的交易 API。未來應由商品／交易後端在交易完成時更新為 `sold`，而不是由前端任意改動。

## 5. 請求範例

```http
GET /api/products
GET /api/products?keyword=耳機
GET /api/products?type=direct
GET /api/products?type=auction
GET /api/products?tag=電子
GET /api/products?sort=price_asc
GET /api/products?sort=price_desc
GET /api/products?status=selling
GET /api/products?status=sold
GET /api/products?type=direct&tag=電子&status=selling&sort=price_asc
GET /api/products?keyword=耳機&type=direct&tag=電子&sort=price_asc&status=selling
```

請由前端使用 `URLSearchParams` 產生查詢字串，不要自行拼接中文或特殊字元。

## 6. 回應範例

HTTP 200（範例；僅展示部分欄位）：

```json
[
  {
    "id": "EXAMPLE_PRODUCT_ID",
    "type": "direct",
    "name": "二手藍牙耳機",
    "status": "selling",
    "desc": "功能正常",
    "shipping": "面交",
    "image": "/images/earphone.jpg",
    "tags": ["電子", "二手"],
    "price": 500,
    "quantity": 1,
    "startPrice": null,
    "currentPrice": null,
    "bidIncrement": null,
    "endTime": null,
    "restrictedMinutes": null
  }
]
```

上述為示意，實際 `_id`／`id`、欄位有無以及資料內容依 MongoDB 與序列化結果為準。

- HTTP 200：查詢成功，可能回傳空陣列 `[]`
- HTTP 400：例如 `type=wrong`、`sort=wrong` 或 `status=wrong`
- HTTP 401：尚未登入

## 7. 前端串接範例

```javascript
const params = new URLSearchParams({
  keyword: '耳機',
  type: 'direct',
  tag: '電子',
  status: 'selling',
  sort: 'price_asc'
});

const response = await fetch(`/api/products?${params}`, {
  credentials: 'same-origin'
});
if (response.status === 401) {
  // 引導使用者登入
} else if (!response.ok) {
  throw new Error(`商品查詢失敗：HTTP ${response.status}`);
} else {
  const products = await response.json();
  console.log(products);
}
```

若前後端同源，由瀏覽器依 Session Cookie 自動處理登入狀態；此 GET 請求不需要 CSRF token。不要把資料庫 URI 或帳密寫在 JavaScript 裡。

## 8. 已知範圍與後續工作

- 已完成：`keyword` 名稱搜尋、`type`／`tag`／`status` 篩選、價格升／降序、組合查詢、MongoDB 查詢測試。
- 尚未完成：新增／修改／刪除商品持久化 API、交易完成後自動更新 `status`、出價 API、分頁、全文檢索、前端即時刷新。
- 前端現有商品新增／編輯／刪除功能仍可能僅使用 `sessionStorage`，不代表已寫入 MongoDB。
- 商品查詢目前受到登入保護；如需開放訪客瀏覽，應與登入負責人協調 SecurityConfig 的權限設計。


## 商品下架與重新上架

商品有三種狀態：

| status | 說明 |
|---|---|
| `selling` | 販售中 |
| `sold` | 已售出 |
| `delisted` | 已下架 |

### 一般商品查詢

`GET /api/products`

- 預設不顯示 `delisted` 商品。
- 關鍵字搜尋、類型篩選、標籤篩選、價格排序也會排除已下架商品。
- `status=selling`：查詢販售中商品。
- `status=sold`：查詢已售出商品。
- `status=delisted`：回傳 HTTP 400，避免查到其他賣家的已下架商品。

### 查詢自己的商品

`GET /api/products/mine`

需要登入。

回傳目前登入會員擁有的所有商品，包含：

- `selling`
- `sold`
- `delisted`

後端會根據登入身分取得會員 ID，不接受前端自行指定 `sellerId`。

成功：HTTP 200，回傳商品陣列。

未登入：HTTP 401。

### 下架自己的商品

`PATCH /api/products/{id}/delist`

需要登入及有效的 CSRF Token。

只有商品擁有者能將商品狀態從 `selling` 改為 `delisted`。

成功：HTTP 200，回傳更新後的商品。

### 重新上架自己的商品

`PATCH /api/products/{id}/relist`

需要登入及有效的 CSRF Token。

只有商品擁有者能將商品狀態從 `delisted` 改為 `selling`。

成功：HTTP 200，回傳更新後的商品。

### 上下架錯誤狀態

| HTTP 狀態碼 | 原因 |
|---|---|
| 401 | 尚未登入 |
| 403 | 不是商品擁有者，或 CSRF 驗證失敗 |
| 404 | 商品不存在 |
| 409 | 商品目前狀態不允許此操作 |

### CSRF Token

執行 PATCH 請求前，先透過：

`GET /api/auth/csrf`

取得 CSRF Token，並將回傳的 `headerName` 和 `token` 放入 PATCH 請求的 Header。

請求必須保留登入 Session Cookie。

### 商品擁有者資料

商品使用 `sellerId` 記錄擁有者的會員 ID。

- `sellerId` 必須由後端根據登入會員身分設定。
- 不可直接信任前端提供的 `sellerId`。
- 沒有 `sellerId` 的舊商品不能透過上下架 API 修改狀態。
- 目前商品建立 API 尚未整合，後續新增商品時必須由後端自動填入 `sellerId`。

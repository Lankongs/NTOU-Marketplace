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

參數可任意組合，條件之間使用 **AND**（全部符合）。空值與全空白參數視為未指定。未實作分頁或其他排序方式。

## 3. 排序價格計算

- `direct`：使用 `price`
- `auction`：若有 `currentPrice`，使用該值；否則使用 `startPrice`
- `currentPrice` 為供查詢使用的目前最高出價資料欄位；目前尚未實作真正的競標出價／最高出價更新 API，也沒有即時推播。前端需要重新請求列表才能取得更新後的順序。
- 若商品缺少相應價格欄位，現有查詢沒有另外設計缺值商品的排列規則，資料建置時應確保必要欄位存在。

## 4. 請求範例

```http
GET /api/products
GET /api/products?keyword=耳機
GET /api/products?type=direct
GET /api/products?type=auction
GET /api/products?tag=電子
GET /api/products?sort=price_asc
GET /api/products?sort=price_desc
GET /api/products?keyword=耳機&type=direct&tag=電子&sort=price_asc
```

請由前端使用 `URLSearchParams` 產生查詢字串，不要自行拼接中文或特殊字元。

## 5. 回應範例

HTTP 200（範例；僅展示部分欄位）：

```json
[
  {
    "id": "EXAMPLE_PRODUCT_ID",
    "type": "direct",
    "name": "二手藍牙耳機",
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
- HTTP 400：例如 `type=wrong` 或 `sort=wrong`
- HTTP 401：尚未登入

## 6. 前端串接範例

```javascript
const params = new URLSearchParams({
  keyword: '耳機',
  type: 'direct',
  tag: '電子',
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

## 7. 已知範圍與後續工作

- 已完成：`keyword` 名稱搜尋、`type`／`tag` 篩選、價格升／降序、組合查詢、MongoDB 查詢測試。
- 尚未完成：新增／修改／刪除商品持久化 API、出價 API、分頁、全文檢索、前端即時刷新。
- 前端現有商品新增／編輯／刪除功能仍可能僅使用 `sessionStorage`，不代表已寫入 MongoDB。
- 商品查詢目前受到登入保護；如需開放訪客瀏覽，應與登入負責人協調 SecurityConfig 的權限設計。

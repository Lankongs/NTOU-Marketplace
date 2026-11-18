# MongoDB 統一資料庫與 H2 遷移

## 檢查與整合基底

- 基底：`develop` b9d4449；`main` fcf5fa1 與兩個會員功能分支的後端相同，均使用 H2/JDBC。
- `feature/product-backend` 0fe7a4c 的四個 product 類別已納入：`products` collection、String 商品 ID、`GET /api/products` 回傳格式不變。未帶入該分支較舊的前端，也不需要另外啟用 product-local profile。
- 會員改為 `members` collection，`_id` 為 BSON Int64，API 仍回傳數字 id。欄位為 account、displayName、passwordHash；保留既有 BCrypt 雜湊。
- `counters` collection 的 `{_id: "members", value: NumberLong(...)}` 以原子增量分配 ID。建立失敗可能留下跳號，與 SQL identity 相同。
- 帳號有唯一索引 `members_account_unique`；啟動時建立索引，既有重複帳號會導致啟動失敗，不會靜默接受衝突。
- 保留所有會員 API、登入限流、Session 更換、CSRF、Cookie 與 `/api/**` 需登入的政策；商品讀取也需登入。
- 前端商品建立／編輯／刪除仍使用 sessionStorage，尚未存在持久化寫入 API。此遷移未擴增交易功能。
- 目前分支沒有 FR-M-03 通知後端。後續通知應使用同一 MongoDB 與數字 memberId，依已登入身分過濾；本次不虛構通知 API。

## 本機啟動與環境變數

需要 JDK 17+、MongoDB 8.0，Maven Wrapper 已附。可用根目錄 `docker compose up -d` 啟動 MongoDB；volume 保留資料，`docker compose down` 不刪 volume。Compose 為本機開發設定，只綁定 loopback。

| 變數 | 用途 | 預設 |
| --- | --- | --- |
| `MONGODB_URI` | 一般執行，URI 須包含資料庫名稱 | `mongodb://127.0.0.1:27017/ntou_marketplace_dev` |
| `MONGODB_DEMO_URI` | demo profile 專用，刻意不沿用一般 URI | `mongodb://127.0.0.1:27017/ntou_marketplace_demo` |
| `TEST_MONGODB_URI` | 整合測試伺服器，資料庫強制改為隨機 `ntou_test_*` | `mongodb://127.0.0.1:27017` |

PowerShell（一般執行，不建立公開 demo 帳號）：

```powershell
$env:MONGODB_URI='mongodb://127.0.0.1:27017/ntou_marketplace_dev'
cd backend
.\mvnw.cmd spring-boot:run
```

展示用根目錄 `start-login.cmd` 或 `bash start-login.sh`。僅 demo profile 建立公開帳號；存在時不改密碼。不要在正式環境啟用 demo，也不要讓兩個 URI 指向相同正式資料庫。

部署時由秘密管理服務注入 URI（例如 Atlas 提供的 `mongodb+srv://.../ntou_marketplace`），帳密特殊字元須 URL encode；啟用驗證、TLS、限制網路來源與最小資料庫權限。移除舊 `MARKET_DB_*` 設定。Spring Boot 4 使用 `spring.mongodb.uri`，不是 `spring.data.mongodb.uri`。正式網站另設定 HTTPS、Secure Cookie 與必要的監聽位址。Session 仍在應用程式記憶體，重啟需重新登入，多副本 Session 策略屬另項部署工作。

## 既有資料

本專案已確認沒有需要保留的 H2 會員資料，因此直接使用 MongoDB，不需匯出或搬移。demo profile 會在獨立展示資料庫建立公開測試會員；正式環境不可啟用 demo。

若其他環境另有實際會員資料，請先備份並另行規劃遷移，不要刪除原資料庫或直接覆蓋既有 MongoDB 資料。

## 驗證

MongoDB 執行中，在 backend 執行 `./mvnw clean verify`（Windows：`.\mvnw.cmd clean verify`）。測試必須可建立／刪除隨機測試資料庫，請只指向專用測試伺服器。測試包含真實 HTTP 安全流程、商品讀取、資料庫唯一帳號、並行數字 ID、匯入後 counter 延續與 BCrypt 保留。CI 使用 MongoDB service 跑相同命令，缺資料庫時測試會失敗而不跳過。

官方參考：[Spring Boot MongoDB](https://docs.spring.io/spring-boot/reference/data/nosql.html)、[MongoDB Windows 安裝](https://www.mongodb.com/docs/v8.0/tutorial/install-mongodb-on-windows-zip/)。

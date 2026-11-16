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

## H2 資料搬移（停機作業，必須先在備份演練）

程式變更不會自動搬資料。舊版一般 H2 為 `backend/data/marketplace.mv.db`；demo 為 `marketplace-demo.mv.db`，也可能由 `MARKET_DB_URL` 指向其他路徑。以下僅搬移現有 schema 的 members；商品分支本來已在 MongoDB，保留 products collection。

1. 停止所有舊／新應用程式寫入。備份 H2 `.mv.db`、現有 MongoDB（若有）與部署設定。記錄 H2 `SELECT COUNT(*), MAX(id) FROM members`。保留原 H2 檔案不動，從副本匯出。
2. 使用與舊部署相同版本的 H2 Console 或 `org.h2.tools.Shell` 開啟副本；以實際帳密連線，執行：

   ```sql
   CALL CSVWRITE('members.csv', 'SELECT id, account, display_name, password_hash FROM members ORDER BY id', 'charset=UTF-8');
   ```

3. 用本 repo 的 `python tools/h2_members_to_json.py members.csv members.jsonl` 轉成 MongoDB Extended JSON。此工具先檢查全部列、欄位、ID／帳號重複與 BCrypt 格式，再建立新檔；不接觸任何資料庫、不覆寫既有輸出。保留 id 與雜湊原值，不重新雜湊、不修改帳號大小寫。匯出檔含密碼雜湊，勿提交或分享。
4. 選定目標 MongoDB 資料庫，在 mongosh 中確認名稱及 `db.members.countDocuments({})` 為 0，且沒有既有 members counter。若有會員資料，停止：須另行比對 ID／帳號衝突，不可直接覆蓋或 drop。只有 products 的資料庫可以保留 products 並匯入 members。先執行：

   ```javascript
   db.members.createIndex({account: 1}, {unique: true, name: "members_account_unique"})
   ```

5. 使用 MongoDB Database Tools 匯入（URI 必須明確包含正確的目標資料庫；秘密不要寫進版本控制）：

   ```powershell
   mongoimport --uri $env:MONGODB_URI --collection members --file members.jsonl --mode insert --stopOnError
   ```

   匯入不是整批 transaction；任何失敗都保持應用程式停止，檢查錯誤與部分匯入內容，從已確認的備份／乾淨 staging 重新演練。不要直接重跑插入、使用 upsert 或略過錯誤。

6. 在同一資料庫 mongosh 驗證筆數、抽查 ID／帳號／雜湊與 H2 相同，確認 ID 均為 BSON long。然後初始化 counter（只適用此處的空會員目標遷移）：

   ```javascript
   const maxMember = db.members.find().sort({_id: -1}).limit(1).toArray()[0];
   db.counters.updateOne({_id: "members"},
     {$max: {value: maxMember ? maxMember._id : NumberLong("0")}}, {upsert: true});
   ```

7. 全部確認後，使用一般 profile 啟動新後端，測試原帳密登入、me 的 ID 不變、登出與商品讀取。新建會員必須取得高於舊最大 ID 的值。保留備份至驗收完成；妥善清除工作用匯出檔。

### 回復

未開放寫入前可停止新版、恢復舊版程式／H2 設定與備份；不要刪除原 H2。切換之後若已有 MongoDB 新資料，先停止寫入並備份，對帳與反向轉換後才可回復 H2，直接切回會遺失新增資料。本次未對任何使用者實際資料庫進行搬移。

## 驗證

MongoDB 執行中，在 backend 執行 `./mvnw clean verify`（Windows：`.\mvnw.cmd clean verify`）。測試必須可建立／刪除隨機測試資料庫，請只指向專用測試伺服器。測試包含真實 HTTP 安全流程、商品讀取、資料庫唯一帳號、並行數字 ID、匯入後 counter 延續與 BCrypt 保留。CI 使用 MongoDB service 跑相同命令，缺資料庫時測試會失敗而不跳過。

CSV 工具測試：`python -m unittest discover -s tools -p 'test_*.py'`。

官方參考：[Spring Boot MongoDB](https://docs.spring.io/spring-boot/reference/data/nosql.html)、[MongoDB Windows 安裝](https://www.mongodb.com/docs/v8.0/tutorial/install-mongodb-on-windows-zip/)。

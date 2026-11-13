# 會員登入：啟動、展示與前端串接

本功能整合至現有 Spring Boot 4.1.1 / Java 17 專案，使用 Spring Security、JDBC 與 H2。沿用團隊的 `frontend/index.html`，登入成功後回到同一個首頁，顯示會員名稱與登出按鈕。訪客仍可瀏覽首頁。

## 本機啟動

需要 JDK 17 以上與網路（首次 Maven 下載套件需要）。專案已附 Maven Wrapper，不必自行安裝 Maven 或資料庫。

在專案根目錄雙擊 `start-login.cmd`，或開啟 PowerShell：

```powershell
cd backend
.\mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=demo"
```

開啟 http://localhost:8080/login.html 。測試帳號為 `demo`，密碼為 `Campus123!`。按「填入測試帳密」後按登入，即可進入既有首頁。按登出回到登入頁。

保持命令列執行中；Ctrl+C 停止。若出現埠號被使用，可指定其他埠：

```powershell
.\mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=demo" "-Dspring-boot.run.arguments=--server.port=8081"
```

改開 http://localhost:8081/login.html 。這個版本使用 8080，不需啟動之前獨立 Node.js 展示的 3000。

只有 `demo` profile 會建立測試會員，資料存於 `backend/data/marketplace-demo.mv.db`。一般啟動不建立測試會員，資料庫是 `backend/data/marketplace.mv.db`。帳號已存在時不覆蓋密碼。請勿將 demo profile 用在正式網站。

## 展示順序

1. 未登入開啟 `/home`，會被導向登入頁；`/index.html` 仍是公開訪客首頁。
2. 用錯誤密碼登入，顯示「帳號或密碼錯誤」。
3. 用測試帳密登入，回到既有首頁，使用者按鈕顯示「海大同學（demo）」。
4. 重新整理仍保持登入。
5. 按登出後回到登入頁；舊 Session 無法再查會員資料。

## 檔案位置

| 位置 | 功能 |
| --- | --- |
| `backend/.../auth/SecurityConfig.java` | Security 設定、Session、CSRF、登出、存取限制 |
| `backend/.../auth/AuthController.java` | JSON 登入、目前會員、CSRF token API |
| `backend/.../auth/MemberRepository.java` | 參數化 SQL 讀寫會員 |
| `backend/.../auth/DemoMemberInitializer.java` | demo profile 建立測試會員 |
| `backend/.../auth/LoginThrottle.java` | 來源 IP 登入速率限制 |
| `backend/src/main/resources/schema.sql` | 會員資料表 |
| `frontend/login.html`、`frontend/auth.css` | 獨立登入畫面樣式，不改首頁 CSS |
| `frontend/javascripts/auth/api.js` | 共用 API 與 CSRF 請求處理 |
| `frontend/javascripts/auth/login.js` | 登入畫面事件 |
| `frontend/javascripts/auth/member.js` | 既有首頁會員名稱、登入入口、登出 |

`backend/.../auth` 的完整路徑是 `backend/src/main/java/com/NTOUMarketplace/backend/auth`。

## API 契約

前後端同來源，由 Spring Boot 一起提供。Maven 會將 `frontend/` 的網頁、樣式、圖片與 JavaScript 打包到靜態資源，不包含 node_modules。修改前端後重新啟動 Maven 即更新。

### 1. 取得 CSRF token

`GET /api/auth/csrf`，回傳：

```json
{"headerName":"X-CSRF-TOKEN","token":"實際隨機token"}
```

必須保留此請求的 Cookie。所有 POST（含登入、登出）都需使用回傳的 `headerName` 作為請求標頭名稱，值填 `token`。

### 2. 登入

`POST /api/auth/login`，`Content-Type: application/json`：

```json
{"account":"demo","password":"Campus123!"}
```

成功為 200，設定 HttpOnly 的 `JSESSIONID` Cookie，回傳：

```json
{"user":{"id":1,"account":"demo","displayName":"海大同學"}}
```

帳號忽略頭尾空白與大小寫。密碼不去空白；BCrypt 限制最多 72 個 UTF-8 位元組，因此中文等字元會佔多個位元組。登入時更換 Session，登入前的 CSRF token 同時失效。

### 3. 目前會員

`GET /api/auth/me`，成功回傳與登入相同的 user；未登入或 Session 失效回傳 401。

### 4. 登出

先重新取得 CSRF token，再呼叫 `POST /api/auth/logout`。成功為 200，清除 Session 與 Cookie，回傳 `{"message":"已登出。"}`。

共用的 `post()` 函式已負責每次 POST 前取得 token。前端不需使用 localStorage 儲存密碼或登入憑證。

### 錯誤格式

```json
{"message":"帳號或密碼錯誤。"}
```

- 400：空白、過長欄位或無效 JSON。
- 401：帳密錯誤／未登入。
- 403：CSRF token 缺少或失效；重新取得 token 後再操作。
- 429：同一來源 IP 在 15 分鐘內已嘗試 10 次；成功登入會清除計數。

Postman 也需要先呼叫 csrf API，保留 Cookie，再使用 token 標頭送登入／登出。

## 資料與安全行為

- 密碼以 BCrypt（cost 12）儲存，不存明文；會員查詢使用參數化 SQL。
- 登入狀態保存在伺服器 HttpSession，閒置 60 分鐘到期；重啟後失效。
- 身分取自 Spring Security，不相信前端提供的會員 ID。
- `/api/**` 預設要求登入，只有 `/api/auth/csrf`、`/api/auth/login` 公開；未來新增公開 API 要明確加入白名單。
- Cookie 設定 HttpOnly、SameSite=Lax；保留 Spring Security 預設 CSRF 保護。
- 本機僅監聽 127.0.0.1；正式部署須配置 HTTPS、Secure Cookie、正式資料庫與 Session 儲存策略。
- 這次未實作註冊、重設密碼、海大身分驗證、商品後端或交易權限。
- 既有商品表單仍是前端展示；未來交易 API 需檢查登入會員與商品擁有者。

## 測試與打包

在 `backend/`：

```powershell
.\mvnw.cmd test
.\mvnw.cmd package
```

測試使用記憶體 H2，不動本機展示資料庫。包含真實 HTTP 的登入成功／失敗、輸入檢查、SQL 注入字串、CSRF、Session 更換、登出後拒絕舊 Cookie、會員資料與密碼雜湊、登入限流與時間到期解除等案例。

打包後可以執行：

```powershell
java -jar target/backend-0.0.1-SNAPSHOT.jar --spring.profiles.active=demo
```

前端已包含在 jar，無需再開 Live Server。若改成獨立前端主機或連接埠，需另設代理／CORS 與 Cookie 策略。

## Git 提交

本次在 `feature/member-login` 開發，依團隊規範提交 PR 至 `develop`。提交前使用 `git status` 檢查；本機 `data/`、`target/` 與 log 不提交。此次變更尚未自動 Commit、Push 或開 PR。

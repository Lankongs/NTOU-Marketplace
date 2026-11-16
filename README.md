# NTOU-Marketplace
A campus marketplace for NTOU students, supporting direct purchases, auctions, and second-hand trading.

## 會員登入展示

先啟動 MongoDB（根目錄執行 `docker compose up -d`，或使用自行管理的 MongoDB），再雙擊 `start-login.cmd`，然後開啟 http://localhost:8080/login.html 。

測試帳號：`demo`，密碼：`Campus123!`（僅 demo profile）。

啟動、測試與 API 串接方式請參閱 [會員登入說明](docs/MEMBER_LOGIN.md)。

MongoDB 連線環境變數、既有 H2 資料匯入及回復步驟請參閱 [MongoDB 遷移說明](docs/MONGODB_MIGRATION.md)。

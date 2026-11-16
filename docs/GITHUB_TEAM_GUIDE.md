# NTOU Marketplace — GitHub 團隊協作使用說明書

> 適用對象：第一次使用 Git / GitHub 的「海大拍賣系統」專題組員。  
> 專案 Repository：`Lankongs/NTOU-Marketplace`  
> 專案管理看板：`NTOU Marketplace Development`

## 1. 先了解我們怎麼合作

我們用 **GitHub Issues** 記錄工作、**GitHub Projects** 追蹤進度、**Branch** 隔離各自的修改、**Pull Request（PR）** 審查並合併程式。

```text
main                  正式／穩定版本，請勿直接修改
  ↑ PR（審查後合併）
develop               團隊整合與測試用分支
  ↑ PR（審查後合併）
feature/功能名稱        各自開發功能的分支
```

**基本原則：不要直接 Push 到 `main`；一般功能也不要直接 Push 到 `develop`。每個工作從自己的分支開始，完成後開 PR。**

## 2. 第一次使用前的準備

1. 註冊／登入 [GitHub](https://github.com/)。
2. 接受 Repository 的 Collaborator 邀請（通常會寄到 GitHub 帳號的電子郵件）。
3. 確認能開啟 [NTOU-Marketplace](https://github.com/Lankongs/NTOU-Marketplace)。此專案是 Private，沒接受邀請可能看不到。
4. 安裝 [Git](https://git-scm.com/downloads)。建議搭配 VS Code 的 Source Control 功能；也可以使用 [GitHub Desktop](https://desktop.github.com/)。
5. **第一次用命令列提交程式**，設定自己的署名：

```bash
git config --global user.name "你的 GitHub 名稱"
git config --global user.email "你的 GitHub Email"
```

> `user.name` 和 `user.email` 是 Commit 署名設定，不是登入密碼；認證請使用 GitHub 支援的登入機制。**不要把密碼、Token 或 API Key 寫進程式碼或提交到 GitHub。**

## 3. 找到自己要做的任務（Issue）

1. 進入 Repository → **Issues**。
2. 找到分配給你的 Issue，閱讀「功能說明」「需求」「完成條件」。
3. 在右側 **Assignees** 確認負責人；若尚未分配，先與組員協調，不要自行搶同一個任務。
4. 視任務內容加上 **Labels**（標籤）：

| Label | 代表工作類型 |
| --- | --- |
| `frontend` | 前端畫面、使用者介面 |
| `backend` | 後端邏輯、API |
| `database` | 資料庫、資料模型 |
| `bug` | 修正錯誤 |
| `documentation` | 文件更新 |
| `enhancement` | 新功能或改進 |

5. 進入右側 **Projects** 或專案看板，把 Status 從 `Todo` 改成 `In Progress`。

### 看板狀態怎麼用？

| Status | 什麼時候使用 |
| --- | --- |
| `Todo` | 尚未開始 |
| `In Progress` | 正在實作、修正或測試 |
| `In Review` | 已提交 PR，等待其他組員審查 |
| `Done` | PR 已整合、完成條件達成，且 Issue 已關閉 |

> 新開的 Issue 可能自動加入看板；已存在但未出現的 Issue，可以從看板 **Add item** 手動加入。不要只移動卡片就當作完成，還要確認程式及 Issue 狀態。

## 4. 第一次下載專案（Clone）

在 Repository 的 **Code → Local → HTTPS** 複製網址；在你想存放專案的資料夾開終端機：

```bash
git clone https://github.com/Lankongs/NTOU-Marketplace.git
cd NTOU-Marketplace
```

確認目前有哪些分支：

```bash
git branch -a
```

> 如果出現權限錯誤，先確認有接受邀請，且使用的是有權限的 GitHub 帳號。

## 5. 開始做功能：先建立自己的分支

以下以 Issue `#1`「使用者註冊」為例。**每次做新任務前都先同步 `develop`，再從它建立新的 feature branch。**

```bash
git switch develop
git pull origin develop
git switch -c feature/1-user-register
```

分支名稱建議：

- `feature/1-user-register`：Issue #1 註冊功能
- `feature/8-product-upload`：Issue #8 商品上架
- `fix/12-login-error`：Issue #12 登入錯誤
- `docs/github-guide`：文件調整

**不要**使用 `test`、`final`、`final2` 等無法辨識用途的名稱。

## 6. 寫好程式後：Commit 與 Push

先看有哪些檔案被修改：

```bash
git status
```

將需要的檔案加入這次 Commit（以下只是範例，請替換成你的實際檔案路徑）：

```bash
git add path/to/changed-file
```

或者確定沒有敏感資料、不必要的檔案後，才使用 `git add .`。

提交修改：

```bash
git commit -m "feat: add user registration"
```

第一次將這個分支推到 GitHub：

```bash
git push -u origin feature/1-user-register
```

以後同一分支有新 Commit，通常只需要：

```bash
git push
```

### Commit 訊息格式

| 前綴 | 用途 | 範例 |
| --- | --- | --- |
| `feat:` | 新增功能 | `feat: add product search` |
| `fix:` | 修正 Bug | `fix: prevent duplicate users` |
| `docs:` | 文件修改 | `docs: update setup guide` |
| `refactor:` | 重構 | `refactor: simplify auth service` |
| `test:` | 測試 | `test: add registration tests` |
| `chore:` | 其他維護 | `chore: update gitignore` |

## 7. 功能完成後：開 Pull Request（PR）

1. 回到 Repository → **Pull requests → New pull request**。
2. 確認方向：**base = `develop`**，**compare = 你的 `feature/...` 分支**。
3. 標題簡要描述修改，例如：`feat: 完成使用者註冊功能`。
4. 按 PR 範本填寫：修改內容、對應 Issue、測試方式與影響範圍。
5. 請至少一位**不是本次修改作者**的組員審查。
6. 到 **Files changed** 檢查實際修改；若 Reviewer 提出建議，回到同一分支修正、Commit、Push，PR 會自動更新。
7. 審查通過、必要測試完成後，再合併到 `develop`。若 GitHub 顯示 `Merging is blocked`，先看尚未滿足哪一項規則。
8. 合併完成、功能確認達到 Issue 完成條件後，關閉 Issue，讓看板更新成 `Done`。

### PR 要怎麼連結 Issue？

- 如果 PR 合併後會**完整完成**該 Issue：在 PR 內寫 `Closes #1`，或使用 GitHub 的關聯功能。注意關閉關鍵字是否會自動生效，取決於 PR 目標分支與 GitHub 規則；合併到 `develop` 後仍應確認 Issue 是否正確關閉。
- 如果只完成一部分：寫 `Refs #1`，不應提早關閉 Issue。

> **不要把 base 設成 `main`**，除非是整合完成、經團隊確認要發布穩定版本的 PR：`develop → main`。

## 8. 每天開始工作前，怎麼同步其他人的程式？

如果要開**新的任務**：

```bash
git switch develop
git pull origin develop
git switch -c feature/新任務名稱
```

如果正在既有 `feature/...` 分支開發，想把最新 `develop` 的內容整合進來：

```bash
git switch feature/1-user-register
git fetch origin
git merge origin/develop
```

若遇到衝突，Git 會標示衝突檔案。請和修改同一區塊的組員討論後解決；**不要盲目選「全部接受我的修改」或「全部接受對方修改」**。修好後執行測試，再依 Git 顯示的指示完成 Merge Commit。

## 9. 如果你負責審查別人的 PR

1. 進入 **Pull requests** → 找到別人開的 PR。
2. 先讀說明，確認是否有對應 Issue。
3. 到 **Files changed** 檢查程式邏輯、是否改到不相關檔案、有無憑證或個資外洩。
4. 看測試結果或依 PR 的「測試方式」實際操作。
5. 點 **Review changes**：
   - `Comment`：留意見，不代表核准。
   - `Approve`：確認可以合併。
   - `Request changes`：需要修改後再審。
6. 不確定的修改先詢問作者，不要只為了趕進度就 Approve。

## 10. 常見問題

**Q：我 Push 時顯示沒有權限？**  
A：檢查是否接受 Collaborator 邀請、帳號是否正確；也檢查自己是不是嘗試直接 Push 到受保護的 `main`。

**Q：為什麼 PR 的 Merge 按鈕是灰色的？**  
A：可能需要一位有權限的 Reviewer Approve，也可能有衝突或其他檢查未通過。請看 PR 頁面上的具體訊息。

**Q：我的 Issue 沒出現在 Projects 看板？**  
A：到 Issue 右側 `Projects` 選 `NTOU Marketplace Development`；或到 Board 的 `Todo → Add item` 搜尋該 Issue。

**Q：我忘記切分支，修改直接做在 `develop` 怎麼辦？**  
A：如果**還沒 Commit**，先不要 Push；可先 `git switch -c feature/任務名稱` 將目前修改帶到新分支。若已 Commit 或已 Push，請先聯絡負責管理 GitHub 的組員，避免直接改寫共享歷史。

**Q：要不要把 `.env`、密碼或資料庫連線資訊 Push 上去？**  
A：不要。請用 `.gitignore` 排除本機機密檔，提供不含真實憑證的 `.env.example` 作為範例。若不小心上傳，立即通知組員並撤銷／更換洩漏的憑證；光刪除最新檔案不代表歷史紀錄裡的秘密已消失。

**Q：GitHub Tag 跟 Issue Label 一樣嗎？**  
A：不一樣。Issue 上用的是 **Label**（分類標籤）；Git **Tag** 通常用於標記版本，例如 `v1.0.0`。

## 11. 每個任務的最簡流程

```text
領取 Issue、設定 Assignee
    ↓
Project：Todo → In Progress
    ↓
從 develop 建 feature 分支
    ↓
寫程式、測試、Commit、Push
    ↓
開 PR：feature → develop
    ↓
Project：In Review
    ↓
請其他組員 Review / Approve
    ↓
Merge 到 develop，確認功能正確
    ↓
關閉 Issue → Done
```

## 12. 給大家的協作約定

1. **一個 Issue 對應一個明確工作**；太大的功能可以拆 Sub-issues。
2. **一個功能一個分支**；不要多人共用同一個 feature branch，除非事先講好。
3. **不要直接改 `main`**；平常也不要直接改 `develop`。
4. 送 PR 前，先確認自己修改了哪些檔案、能不能執行。
5. 有衝突、卡住、需要修改別人負責的部分，先在 Issue / PR 留言討論。
6. **每個 PR 至少由另一位組員審查**。若 GitHub 的保護規則因帳號方案沒有生效，仍要遵守這項約定。
7. `main` 的更新由團隊確認時機；不要把還沒測試的功能直接發佈。

---

有問題請在對應的 GitHub Issue 或 PR 留言，讓討論紀錄留在專案裡。

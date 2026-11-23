import { api, post } from '../auth/api.js';
import { initNotificationMenu } from '../notification/notificationMenu.js';

const CURRENT_CATEGORY = "last_page";
const NAV_HTML = `
  <nav
    class="navbar navbar-expand-lg py-2"
    style="background-color: #d5eeff"
  >
    <div class="container-fluid">
      <div class="d-flex align-items-center gap-2">
        <!-- 主頁按鈕 -->
        <button type="button" id="to-home" class="btn" title="回首頁">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" class="bi bi-house-door" viewBox="0 0 16 16">
            <path d="M8.354 1.146a.5.5 0 0 0-.708 0l-6 6A.5.5 0 0 0 1.5 7.5v7a.5.5 0 0 0 .5.5h4.5a.5.5 0 0 0 .5-.5v-4h2v4a.5.5 0 0 0 .5.5H14a.5.5 0 0 0 .5-.5v-7a.5.5 0 0 0-.146-.354L13 5.793V2.5a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v1.293zM2.5 14V7.707l5.5-5.5 5.5 5.5V14H10v-4a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5v4z"/>
          </svg>
        </button>
        <!-- 搜尋表單：包含 id 以相容購物車頁搜尋行為 -->
        <div class="input-group py-2">
          <input id="cart-search" type="text" class="form-control" placeholder="關鍵字" aria-label="商品搜尋" />
          <button id="cart-search-button" class="btn btn-secondary" type="submit">送出</button>
        </div>

        <!-- 篩選按鈕（可搭配下拉選單或彈窗） -->
        <div class="dropdown">
          <button
            class="btn btn-outline-dark dropdown-toggle"
            type="button"
            id="filterDropdown"
            data-bs-toggle="dropdown"
            aria-expanded="false"
          >
            篩選
          </button>
          <ul class="dropdown-menu" aria-labelledby="filterDropdown">
            <li><a class="dropdown-item" href="#">依日期排序</a></li>
            <li><a class="dropdown-item" href="#">依熱門度</a></li>
            <li><hr class="dropdown-divider" /></li>
            <li><a class="dropdown-item" href="#">進階篩選...</a></li>
          </ul>
        </div>
      </div>
      <button
        class="navbar-toggler"
        type="button"
        data-bs-toggle="collapse"
        data-bs-target="#navbarContent"
        aria-controls="navbarContent"
        aria-expanded="false"
        aria-label="Toggle navigation"
      >
        <span class="navbar-toggler-icon"></span>
      </button>
      <div class="collapse navbar-collapse" id="navbarContent">
        <ul class="navbar-nav ms-auto mb-2 mb-lg-0 align-items-lg-center">
          <li>
            <button type="button" id="chat-button" class="btn">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-chat-dots" viewBox="0 0 16 16">
                <path d="M5 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0m4 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0m3 1a1 1 0 1 0 0-2 1 1 0 0 0 0 2"/>
                <path d="m2.165 15.803.02-.004c1.83-.363 2.948-.842 3.468-1.105A9 9 0 0 0 8 15c4.418 0 8-3.134 8-7s-3.582-7-8-7-8 3.134-8 7c0 1.76.743 3.37 1.97 4.6a10.4 10.4 0 0 1-.524 2.318l-.003.011a11 11 0 0 1-.244.637c-.079.186.074.394.273.362a22 22 0 0 0 .693-.125m.8-3.108a1 1 0 0 0-.287-.801C1.618 10.83 1 9.468 1 8c0-3.192 3.004-6 7-6s7 2.808 7 6-3.004 6-7 6a8 8 0 0 1-2.088-.272 1 1 0 0 0-.711.074c-.387.196-1.24.57-2.634.893a11 11 0 0 0 .398-2"/>
              </svg>
            </button>
          </li>
          <li class="nav-item">
            <button type="button" id="setting-button" class="btn">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-gear" viewBox="0 0 16 16">
                <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492M5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0"/>
                <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115z"/>
              </svg>
            </button>
          </li>
          <li class="nav-item">
            <button type="button" id="notify-button" class="btn">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-bell" viewBox="0 0 16 16">
                <path d="M8 16a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2M8 1.918l-.797.161A4 4 0 0 0 4 6c0 .628-.134 2.197-.459 3.742-.16.767-.376 1.566-.663 2.258h10.244c-.287-.692-.502-1.49-.663-2.258C12.134 8.197 12 6.628 12 6a4 4 0 0 0-3.203-3.92zM14.22 12c.223.447.481.801.78 1H1c.299-.199.557-.553.78-1C2.68 10.2 3 6.88 3 6c0-2.42 1.72-4.44 4.005-4.901a1 1 0 1 1 1.99 0A5 5 0 0 1 13 6c0 .88.32 4.2 1.22 6"/>
              </svg>
            </button>
          </li>
          <li class="nav-item">
            <button type="button" id="shopping-cart-button" class="btn">
              <img
                src="image/shopping-cart.png"
                alt="購物車"
                width="20"
                height="20"
              />
              購物車
            </button>
          </li>
          <li class="nav-item">
            <button type="button" id="list-products-button" class="btn">
              <img
                src="image/edit.png"
                alt="刊登商品"
                width="20"
                height="20"
              />
              刊登商品
            </button>
          </li>
          <li>
            <button
              type="button"
              id="user-button"
              class="btn"
              aria-label="會員登入"
            >
              <img
                src="image/account.png"
                alt="使用者"
                width="20"
                height="20"
              />
              <span id="member-label">登入</span>
            </button>
          </li>
          <li>
            <button type="button" id="logout-button" class="btn" hidden>
              登出
            </button>
          </li>
        </ul>
      </div>
    </div>
  </nav>
  <p id="auth-message" role="alert" hidden></p>
`;

function renderTopNav() {
  const container = document.getElementById("top-navbar");
  if (container) {
    container.innerHTML = NAV_HTML;
  }
}

function bindNavEvents() {
  const logoutButton = document.getElementById("logout-button");

  // 頂層「主頁按鈕」：點擊回到 index.html（公開）
  const homeButton = document.getElementById("to-home");
  if (homeButton) {
    homeButton.addEventListener("click", () => {
      sessionStorage.setItem(CURRENT_CATEGORY, "推薦");
      window.location.assign("./index.html");
    });
  }

  // 搜尋表單：包含送出按鈕與 Enter 事件（公開）
  const searchButton = document.getElementById("cart-search-button");
  if (searchButton) {
    searchButton.addEventListener("click", () => {
      window.location.assign("./index.html");
    });
  }

  const searchPlacehold = document.getElementById("cart-search");
  if (searchPlacehold) {
    searchPlacehold.addEventListener("keydown", (event) => {
      if (event.key === 'Enter') {
        window.location.assign("./index.html");
      }
    });
  }

  // 頂層「會員按鈕」：若已登入跳轉至 selfPage.html，非登入跳轉至 login.html
  const userButton = document.getElementById("user-button");
  if (userButton) {
    userButton.addEventListener("click", () => {
      window.location.assign("./selfPage.html");
    });
  }

  // 頂層「登出按鈕」
  if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
      try {
        await post('/api/auth/logout');
        window.location.assign("./login.html");
      } catch {
        alert("登出失敗，請確認伺服器連線");
      }
    });
  }

  // 頂層「刊登商品按鈕」：若已登入跳轉至 addProducts.html，非登入跳轉至 login.html
  const addButton = document.getElementById("list-products-button");
  if (addButton) {
    addButton.addEventListener("click", () => {
      window.location.assign("./addProducts.html");
    });
  }

  // 頂層「購物車按鈕」：若已登入跳轉至 cart.html，非登入跳轉至 login.html
  const cartButton = document.getElementById("shopping-cart-button");
  if (cartButton) {
    cartButton.addEventListener("click", () => {
      window.location.assign("./cart.html");
    });
  }

  // 頂層「聊天」、「設定」、「通知」按鈕：非登入時跳轉至 login.html
  const chatButton = document.getElementById("chat-button");
  if (chatButton) {
    chatButton.addEventListener("click", () => {
    });
  }

  const settingButton = document.getElementById("setting-button");
  if (settingButton) {
    settingButton.addEventListener("click", () => {
    });
  }

  const notifyButton = document.getElementById("notify-button");
  if (notifyButton) {
    notifyButton.addEventListener("click", () => {
    });
  }
}

async function checkAuth() {
  const path = window.location.pathname;
  // 通知頁自行顯示未登入與連線失敗提示
  if (path.endsWith("/notifications.html")) return;
  // 檢查是否為公開頁面（index、cardInfo 或網站首頁根目錄）
  const isPublicPage =
    path.endsWith("/index.html") ||
    path.endsWith("/cardInfo.html") ||
    path === "/" ||
    path.endsWith("/frontend/");

  if (isPublicPage) return;

  // 支援示範模式（若帶有 ?demo=1 或 ?demo=multi 則放行）
  const demoParam = new URLSearchParams(window.location.search).get("demo");
  if (demoParam === "1" || demoParam === "multi") return;

  try {
    await api("/api/auth/me");
  } catch {
    window.location.assign("./login.html");
  }
}

function init() {
  renderTopNav();
  bindNavEvents();
  initNotificationMenu();
  checkAuth();
}

// 模組載入時立即執行渲染與綁定（由於 module script 具備 defer 特性，此時 DOM 已可存取）
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

export { init, renderTopNav, bindNavEvents };

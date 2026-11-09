const STORAGE_KEY = "ntou_marketplace_cards";
let currentCategory = "推薦";

function normalizeCardTags(card) {
  if (Array.isArray(card.tags) && card.tags.length > 0) {
    return card.tags;
  }
  // 相容舊資料：若無 tags 則預設包含「推薦」與「我的商品」
  return ["推薦", "我的商品"];
}

function loadStoredCards() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map((card, idx) => ({
          ...card,
          id: card.id || `prod_${idx}_${Date.now()}`,
          tags: normalizeCardTags(card),
        }))
      : [];
  } catch (e) {
    return [];
  }
}

function saveStoredCards(cards) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
  } catch (e) {
    console.warn("無法將商品暫存至 sessionStorage：", e);
  }
}

let cards = loadStoredCards();

function renderCardToDOM(productData) {
  const cardsArea = document.getElementById("cards-lists-area");
  if (!cardsArea) return;

  const tags = normalizeCardTags(productData);

  // 判斷要顯示直購價格還是競標資訊
  const priceInfo =
    productData.type === "direct"
      ? `價格：NT$ ${productData.price} | 庫存：${productData.quantity}`
      : `起標價：NT$ ${productData.startPrice} | 結標時間：${formatDateTime(productData.endTime)}`;

  const typeBadge =
    productData.type === "direct"
      ? `<span class="badge bg-success">直購</span>`
      : `<span class="badge bg-danger">競標</span>`;

  // 產生分類標籤 Badges（顯示除了「推薦」以外的標籤，讓畫面更清晰）
  const displayTags = tags.filter((tag) => tag !== "推薦");
  const tagsBadgesHTML = displayTags
    .map(
      (tag) =>
        `<span class="badge bg-secondary-subtle text-secondary-emphasis me-1">${tag}</span>`,
    )
    .join("");

  // 動態在畫面上產生一張 Bootstrap 卡片按鈕（保留原 Tag 結構並附帶標籤屬性）
  const cardElement = document.createElement("button");
  cardElement.type = "button";
  cardElement.className = "card m-2 shadow-sm col text-start p-0 border bg-white";
  cardElement.style.width = "18rem";
  cardElement.style.cursor = "pointer";
  cardElement.dataset.tags = tags.join(",");
  cardElement.innerHTML = `
        ${
          productData.image
            ? `<img src="${productData.image}" class="card-img-top" style="height: 180px; object-fit: cover;" alt="商品照片">`
            : `<div class="card-img-top bg-light d-flex align-items-center justify-content-center text-muted" style="height: 180px;">無商品照片</div>`
        }
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <h5 class="card-title mb-0 text-dark">${productData.name}</h5>
            ${typeBadge}
          </div>
          <div class="mb-2">${tagsBadgesHTML}</div>
          <p class="card-text text-muted small">${productData.desc || "無詳細介紹"}</p>
          <p class="card-text fw-bold mb-1 text-dark">${priceInfo}</p>
          <small class="text-secondary">運送方式：${productData.shipping}</small>
        </div>
      `;

  // 點擊卡片跳轉至商品詳細頁 cardInfo.html
  cardElement.addEventListener("click", () => {
    sessionStorage.setItem("ntou_selected_product", JSON.stringify(productData));
    const query = productData.id ? `?id=${encodeURIComponent(productData.id)}` : "";
    window.location.assign(`./cardInfo.html${query}`);
  });

  // 加入到主畫面的商品卡容器內
  cardsArea.appendChild(cardElement);
}

function renderCardsByCategory(categoryName) {
  currentCategory = categoryName;

  // 1. 更新右側上方的大標題
  const titleEl = document.getElementById("category-title");
  if (titleEl) {
    titleEl.textContent = categoryName;
  }

  // 2. 取得並清空商品卡區域
  const cardsArea = document.getElementById("cards-lists-area");
  if (!cardsArea) return;
  cardsArea.innerHTML = "";

  // 3. 讀取最新商品列表並依所選分類標籤篩選
  cards = loadStoredCards();
  const filteredCards = cards.filter((card) => {
    const tags = normalizeCardTags(card);
    return tags.includes(categoryName);
  });

  if (filteredCards.length === 0) {
    const emptyMsg = document.createElement("p");
    emptyMsg.className = "text-muted mt-3";
    emptyMsg.textContent = `目前「${categoryName}」尚無商品。`;
    cardsArea.appendChild(emptyMsg);
    return;
  }

  filteredCards.forEach((productData) => renderCardToDOM(productData));
}

function bindSidebarLinks() {
  const sidebarLinks = document.querySelectorAll(".sidebar .nav-link");
  sidebarLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const selectedCategory = link.textContent.trim();
      if (!selectedCategory) return;

      // 更新左側導覽列選中狀態樣式
      sidebarLinks.forEach((l) => l.classList.remove("fw-bold", "text-primary"));
      link.classList.add("fw-bold", "text-primary");

      // 根據所選欄位切換大標題與商品卡片
      renderCardsByCategory(selectedCategory);
    });
  });
}

function addCards(productData) {
  // 確保每個新增的商品都有唯一 id 與至少一個標籤
  const tags = normalizeCardTags(productData);
  const id = productData.id || `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const normalizedProduct = { ...productData, id, tags };

  // 1. 將表單送來的物件推入陣列並同步至 sessionStorage，連後端後會改
  cards = loadStoredCards();
  cards.push(normalizedProduct);
  saveStoredCards(cards);

  // 2. 若當前頁面有 #cards-lists-area 且符合目前分類則立即渲染
  if (tags.includes(currentCategory)) {
    renderCardToDOM(normalizedProduct);
  }
}

function initCardsList() {
  bindSidebarLinks();
  renderCardsByCategory(currentCategory);
}

function formatDateTime(rawTime) {
  if (!rawTime) return "";
  return rawTime.replace(/-/g, "/").replace("T", "-");
}

window.addEventListener("DOMContentLoaded", initCardsList);

export { addCards };

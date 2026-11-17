const STORAGE_KEY = "ntou_marketplace_cards";
let currentFilter = "全部商品";
let currentEditingId = null;

// 將圖片檔案讀取為 Data URL（讓跨頁面跳轉回 index.html 後仍可預覽圖片）
function readFileAsDataURL(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result || "");
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

// 讀取商品
function loadStoredCards() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((card, idx) => ({
      ...card,
      id: card.id || `prod_${idx}_${Date.now()}`,
      status: card.status === "delisted" ? "delisted" : (card.status === "sold" ? "sold" : "selling"), // selling: 販售中, delisted: 已下架, sold: 已售出
      tags: Array.isArray(card.tags) && card.tags.length > 0 ? card.tags : ["推薦", "我的商品"],
    }));
  } catch (e) {
    console.warn("解析商品資料失敗：", e);
    return [];
  }
}

// 更新商品
function saveStoredCards(cards) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
  } catch (e) {
    console.warn("無法將商品暫存至 sessionStorage：", e);
  }
}

// 使時間易閱讀
function formatDateTime(rawTime) {
  if (!rawTime) return "未指定";
  return rawTime.replace(/-/g, "/").replace("T", " ");
}

// 目前是從商品陣列中篩出自己的商品，但之後應該會接api
// 裡面應該會有一個 GET 請求取得商品陣列，篩選or直接get問題見cardList.js的loadStoredCards註解
function getMyProducts(cards) {
  // 篩選屬於我的商品（tags 含「我的商品」或是使用者發布的商品，若無標籤預設全部為可管理商品）
  const myCards = cards.filter((card) => {
    if (!card.tags) return true;
    return card.tags.includes("我的商品");
  });
  return myCards.length > 0 ? myCards : cards;
}

// 畫面處理
function renderSelfCards() {
  const cardsArea = document.getElementById("self-cards-area");
  const emptyState = document.getElementById("self-empty-state");
  const titleEl = document.getElementById("filter-title");
  const countBadge = document.getElementById("product-count-badge");

  if (!cardsArea) return;
  cardsArea.innerHTML = "";

  const allCards = loadStoredCards();
  const myProducts = getMyProducts(allCards);

  // 依照側邊欄分類篩選
  const filtered = myProducts.filter((product) => {
    if (currentFilter === "全部商品") return true;
    if (currentFilter === "販售中") return product.status === "selling" || product.status === "active";
    if (currentFilter === "已下架") return product.status === "delisted";
    if (currentFilter === "已售出") return product.status === "sold";
    if (currentFilter === "直購商品") return product.type === "direct";
    if (currentFilter === "競標商品") return product.type === "auction";
    return true;
  });

  if (titleEl) titleEl.textContent = currentFilter;
  if (countBadge) countBadge.textContent = `${filtered.length} 件`;

  if (filtered.length === 0) {
    if (emptyState) emptyState.hidden = false;
    return;
  }
  if (emptyState) emptyState.hidden = true;

  filtered.forEach((product) => {
    const isDelisted = product.status === "delisted";
    const isSold = product.status === "sold";

    const col = document.createElement("div");
    col.className = "col";

    const typeBadge =
      product.type === "direct"
        ? `<span class="badge bg-success">直購</span>`
        : `<span class="badge bg-danger">競標</span>`;

    let statusBadge = `<span class="badge bg-primary">販售中</span>`;
    if (isDelisted) {
      statusBadge = `<span class="badge bg-secondary">已下架</span>`;
    } else if (isSold) {
      statusBadge = `<span class="badge bg-dark">已售出</span>`;
    }

    const priceText =
      product.type === "direct"
        ? `價格：NT$ ${product.price ?? 0} ｜ 庫存：${product.quantity ?? 1}`
        : `起標/目前出價：NT$ ${product.currentPrice ?? product.startPrice ?? 0} ｜ 結標時間：${formatDateTime(product.endTime)}`;

    col.innerHTML = `
      <div class="card h-100 shadow-sm border ${isDelisted || isSold ? "opacity-75 bg-light" : "bg-white"}">
        <div class="position-relative">
          ${
            product.image
              ? `<img src="${product.image}" class="card-img-top" style="height: 180px; object-fit: cover;" alt="商品照片">`
              : `<div class="card-img-top bg-light d-flex align-items-center justify-content-center text-muted" style="height: 180px;">無商品照片</div>`
          }
          <div class="position-absolute top-0 start-0 m-2 d-flex gap-1">
            ${typeBadge}
            ${statusBadge}
          </div>
        </div>
        <div class="card-body d-flex flex-column">
          <h5 class="card-title text-truncate mb-2 text-dark" title="${product.name}">${product.name}</h5>
          <p class="card-text text-muted small text-truncate mb-2">${product.desc || "無描述"}</p>
          <p class="card-text fw-bold text-dark mb-1 small">${priceText}</p>
          <p class="card-text text-secondary small mb-3">運送方式：${product.shipping || "校內面交"}</p>

          <div class="mt-auto pt-2 border-top d-flex gap-2 justify-content-between">
            <button type="button" class="btn btn-outline-primary btn-sm flex-fill btn-edit" data-id="${product.id}" ${isSold ? 'disabled title="已售出商品無法編輯"' : ""}>
              <i class="bi bi-pencil-square me-1"></i>編輯
            </button>
            <button type="button" class="btn ${isDelisted ? "btn-outline-success" : isSold ? "btn-outline-secondary" : "btn-outline-warning"} btn-sm flex-fill btn-toggle-status" data-id="${product.id}" data-delisted="${isDelisted}" ${isSold ? 'disabled title="已售出商品無法切換上下架"' : ""}>
              <i class="bi ${isDelisted ? "bi-arrow-up-circle" : isSold ? "bi-check-circle" : "bi-arrow-down-circle"} me-1"></i>${isDelisted ? "重新上架" : isSold ? "已售出" : "下架"}
            </button>
            <button type="button" class="btn btn-outline-danger btn-sm btn-delete" data-id="${product.id}" title="刪除商品">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
      </div>
    `;

    // 綁定編輯事件
    const editBtn = col.querySelector(".btn-edit");
    editBtn.addEventListener("click", () => openEditModal(product.id));

    // 綁定上下架事件
    const toggleBtn = col.querySelector(".btn-toggle-status");
    toggleBtn.addEventListener("click", () => toggleProductStatus(product.id));

    // 綁定刪除事件
    const deleteBtn = col.querySelector(".btn-delete");
    deleteBtn.addEventListener("click", () => deleteProduct(product.id));

    cardsArea.appendChild(col);
  });
}

// 調整上下架，裡面應該會有一個 PUT / POST / PATCH 請求
function toggleProductStatus(productId) {
  const cards = loadStoredCards();
  const target = cards.find((c) => String(c.id) === String(productId));
  if (!target) return;

  if (target.status === "sold") {
    alert("此商品已售出，無法切換上下架狀態！");
    return;
  }

  const willDelist = target.status !== "delisted";
  const actionText = willDelist ? "下架" : "重新上架";

  if (!confirm(`確定要將「${target.name}」${actionText}嗎？`)) return;

  target.status = willDelist ? "delisted" : "selling";
  saveStoredCards(cards);
  renderSelfCards();
}

// 刪除畫面，裡面應該會有一個 DELETE 請求
function deleteProduct(productId) {
  const cards = loadStoredCards();
  const target = cards.find((c) => String(c.id) === String(productId));
  if (!target) return;

  if (!confirm(`確定要永久刪除「${target.name}」嗎？此操作無法復原！`)) return;

  const updatedCards = cards.filter((c) => String(c.id) !== String(productId));
  saveStoredCards(updatedCards);
  renderSelfCards();
}

// 編輯畫面
function openEditModal(productId) {
  const cards = loadStoredCards();
  const product = cards.find((c) => String(c.id) === String(productId));
  if (!product) return;

  if (product.status === "sold") {
    alert("已售出商品無法編輯！");
    return;
  }

  currentEditingId = product.id;

  const idInput = document.getElementById("edit-prod-id");
  const nameInput = document.getElementById("edit-prod-name");
  const priceInput = document.getElementById("edit-prod-price");
  const priceLabel = document.getElementById("edit-prod-price-label");
  const qtyInput = document.getElementById("edit-prod-quantity");
  const qtyContainer = document.getElementById("edit-prod-quantity-container");
  const shippingSelect = document.getElementById("edit-prod-shipping");
  const descInput = document.getElementById("edit-prod-desc");

  if (idInput) idInput.value = product.id;
  if (nameInput) nameInput.value = product.name || "";
  if (descInput) descInput.value = product.desc || "";
  if (shippingSelect) shippingSelect.value = product.shipping || "校內面交";

  if (product.type === "direct") {
    if (priceLabel) priceLabel.textContent = "直購價格 (NT$)";
    if (priceInput) priceInput.value = product.price ?? 0;
    if (qtyContainer) qtyContainer.hidden = false;
    if (qtyInput) qtyInput.value = product.quantity ?? 1;
  } else {
    if (priceLabel) priceLabel.textContent = "起標/目前價格 (NT$)";
    if (priceInput) priceInput.value = product.currentPrice ?? product.startPrice ?? 0;
    if (qtyContainer) qtyContainer.hidden = true;
  }

  const modalEl = document.getElementById("editProductModal");
  if (modalEl && window.bootstrap) {
    const modal = window.bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  }
}

// 點擊編輯更新商品卡，裡面應該會有一個 PUT / POST 請求
function bindEditForm() {
  const form = document.getElementById("edit-product-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentEditingId) return;

    const cards = loadStoredCards();
    const product = cards.find((c) => String(c.id) === String(currentEditingId));
    if (!product) return;

    const nameInput = document.getElementById("edit-prod-name");
    let imageInput = document.getElementById("edit-prod-image");
    const priceInput = document.getElementById("edit-prod-price");
    const qtyInput = document.getElementById("edit-prod-quantity");
    const shippingSelect = document.getElementById("edit-prod-shipping");
    const descInput = document.getElementById("edit-prod-desc");

    product.name = nameInput.value.trim();
    let imageUrl = "";
    if (imageInput && imageInput.files && imageInput.files[0]) {
      imageUrl = await readFileAsDataURL(imageInput.files[0]);
      if(imageUrl !== "") product.image = imageUrl;
    }
    product.shipping = shippingSelect.value;
    product.desc = descInput.value.trim();

    if (product.type === "direct") {
      product.price = Number(priceInput.value) || 0;
      product.quantity = Math.max(1, Number(qtyInput.value) || 1);
    } else {
      const updatedPrice = Number(priceInput.value) || 0;
      product.currentPrice = updatedPrice;
      product.startPrice = updatedPrice;
    }

    saveStoredCards(cards);

    const modalEl = document.getElementById("editProductModal");
    if (modalEl && window.bootstrap) {
      const modal = window.bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
    }

    currentEditingId = null;
    renderSelfCards();
  });
}

// 點擊sidebar更新右半邊
function bindSidebar() {
  const links = document.querySelectorAll(".self-sidebar .nav-link");
  links.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const filter = link.getAttribute("data-filter") || link.textContent.trim();
      currentFilter = filter;

      links.forEach((l) => l.classList.remove("active", "fw-bold", "bg-primary", "text-white"));
      link.classList.add("active", "fw-bold", "bg-primary", "text-white");

      renderSelfCards();
    });
  });
}

// 初始化
function initSelfPage() {
  bindSidebar();
  bindEditForm();
  renderSelfCards();
}

window.addEventListener("DOMContentLoaded", initSelfPage);
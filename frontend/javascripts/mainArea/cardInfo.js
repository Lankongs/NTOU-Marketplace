const STORAGE_KEY = "ntou_marketplace_cards";

function loadProduct() {
  const params = new URLSearchParams(window.location.search);
  const productId = params.get("id");

  // 1. 若有傳入 id，優先從 sessionStorage 的商品列表中比對查找
  if (productId) {
    try {
      const rawCards = sessionStorage.getItem(STORAGE_KEY);
      if (rawCards) {
        const cards = JSON.parse(rawCards);
        const found = cards.find((c) => String(c.id) === String(productId));
        if (found) return found;
      }
    } catch (e) {
      console.warn("解析商品列表失敗：", e);
    }
  }

  // 2. 備案：從暫存的單一選取商品取得
  try {
    const rawSelected = sessionStorage.getItem("ntou_selected_product");
    if (rawSelected) {
      return JSON.parse(rawSelected);
    }
  } catch (e) {
    console.warn("解析選取商品失敗：", e);
  }

  return null;
}

function formatDateTime(rawTime) {
  if (!rawTime) return "未指定";
  return rawTime.replace(/-/g, "/").replace("T", " ");
}

function setupQuantityController(maxQuantity) {
  const minusBtn = document.getElementById("btn-qty-minus");
  const plusBtn = document.getElementById("btn-qty-plus");
  const qtyInput = document.getElementById("input-qty");
  if (!minusBtn || !plusBtn || !qtyInput) return;

  const max = Math.max(1, Number(maxQuantity) || 1);
  let current = 1;
  qtyInput.value = current;

  // 根據當前購買數量動態更新按鈕 disabled 狀態
  const updateButtonStates = () => {
    minusBtn.disabled = current <= 1;
    plusBtn.disabled = current >= max;
  };

  // 初始執行一次判斷（若剩餘數量為 1，加號也會預設 disabled）
  updateButtonStates();

  minusBtn.onclick = () => {
    if (current > 1) {
      current -= 1;
      qtyInput.value = current;
      updateButtonStates();
    }
  };

  plusBtn.onclick = () => {
    if (current < max) {
      current += 1;
      qtyInput.value = current;
      updateButtonStates();
    }
  };
}

function setupTrackButtons() {
  const trackButtons = document.querySelectorAll(".btn-track");
  trackButtons.forEach((btn) => {
    btn.onclick = () => {
      const icon = btn.querySelector("i");
      const text = btn.querySelector(".track-text");
      const isTracked = icon.classList.contains("bi-heart-fill");

      if (isTracked) {
        icon.className = "bi bi-heart me-1";
        text.textContent = "追蹤商品";
        btn.classList.remove("border-danger", "text-danger");
      } else {
        icon.className = "bi bi-heart-fill text-danger me-1";
        text.textContent = "已追蹤商品";
        btn.classList.add("border-danger", "text-danger");
      }
    };
  });
}

function renderProductDetails(product) {
  const notFoundEl = document.getElementById("product-not-found");
  const detailEl = document.getElementById("product-detail-area");

  if (!product) {
    if (notFoundEl) notFoundEl.hidden = false;
    if (detailEl) detailEl.hidden = true;
    return;
  }

  if (notFoundEl) notFoundEl.hidden = true;
  if (detailEl) detailEl.hidden = false;

  // 1. 更新頁面標題與右側商品名稱
  document.title = `${product.name} - 商品詳細資訊`;
  const nameEl = document.getElementById("detail-name");
  if (nameEl) nameEl.textContent = product.name;

  // 2. 處理商品照片（無圖片時維持現況）
  const imgEl = document.getElementById("detail-image");
  const noImgEl = document.getElementById("detail-no-image");
  if (product.image) {
    if (imgEl) {
      imgEl.src = product.image;
      imgEl.hidden = false;
    }
    if (noImgEl) noImgEl.hidden = true;
  } else {
    if (imgEl) imgEl.hidden = true;
    if (noImgEl) noImgEl.hidden = false;
  }

  // 3. 處理左上角模式標籤（維持原本設計Badge樣式，僅移動位置至左上角）
  const typeBadgeEl = document.getElementById("detail-type-badge");
  const directSection = document.getElementById("direct-trade-section");
  const auctionSection = document.getElementById("auction-trade-section");

  if (product.type === "direct") {
    if (typeBadgeEl) {
      typeBadgeEl.className = "position-absolute top-0 start-0 m-3 badge bg-success fs-6 z-1";
      typeBadgeEl.textContent = "直購";
    }
    if (directSection) directSection.hidden = false;
    if (auctionSection) auctionSection.hidden = true;

    // 填入直購價格與剩餘數量
    const priceValEl = document.getElementById("direct-price-val");
    const qtyValEl = document.getElementById("direct-quantity-val");
    if (priceValEl) priceValEl.textContent = product.price ?? 0;
    if (qtyValEl) qtyValEl.textContent = product.quantity ?? 1;

    // 購買數量加減控制器
    setupQuantityController(product.quantity ?? 1);

    // 加入購物車按鈕反饋
    const addCartBtn = document.getElementById("btn-add-cart");
    if (addCartBtn) {
      addCartBtn.onclick = () => {
        const qty = document.getElementById("input-qty")?.value || 1;
        alert(`已成功將 ${qty} 件「${product.name}」加入購物車！`);
      };
    }
  } else if (product.type === "auction") {
    if (typeBadgeEl) {
      typeBadgeEl.className = "position-absolute top-0 start-0 m-3 badge bg-danger fs-6 z-1";
      typeBadgeEl.textContent = "競標";
    }
    if (directSection) directSection.hidden = true;
    if (auctionSection) auctionSection.hidden = false;

    // 填入目前最高出價與結標時間
    const auctionPriceEl = document.getElementById("auction-price-val");
    const auctionTimeEl = document.getElementById("auction-time-val");
    if (auctionPriceEl) auctionPriceEl.textContent = product.startPrice ?? 0;
    if (auctionTimeEl) auctionTimeEl.textContent = formatDateTime(product.endTime);

    // 出價按鈕事件反饋
    const submitBidBtn = document.getElementById("btn-submit-bid");
    const bidInput = document.getElementById("input-bid-amount");
    if (submitBidBtn && bidInput) {
      submitBidBtn.onclick = () => {
        const amount = Number(bidInput.value);
        if (!amount || amount <= (product.startPrice ?? 0)) {
          alert(`出價金額需大於目前出價 $${product.startPrice ?? 0}！`);
          return;
        }
        alert(`成功出價 $${amount}！`);
        if (auctionPriceEl) auctionPriceEl.textContent = amount;
        bidInput.value = "";
      };
    }
  }

  // 4. 處理右側分類標籤 Badges
  const tagsContainer = document.getElementById("detail-tags");
  if (tagsContainer) {
    tagsContainer.innerHTML = "";
    const tags = Array.isArray(product.tags) ? product.tags : ["推薦"];
    tags.forEach((tag) => {
      const span = document.createElement("span");
      span.className = "badge bg-secondary-subtle text-secondary-emphasis me-1 fs-6";
      span.textContent = tag;
      tagsContainer.appendChild(span);
    });
  }

  // 5. 處理左側運送方式與右側商品描述
  const shippingEl = document.getElementById("detail-shipping");
  if (shippingEl) {
    shippingEl.textContent = product.shipping || "校內面交";
  }

  const descEl = document.getElementById("detail-desc");
  if (descEl) {
    descEl.textContent = product.desc ? product.desc.trim() : "無描述。";
  }

  // 6. 設定追蹤商品按鈕切換
  setupTrackButtons();
}

function init() {
  // 返回主頁按鈕事件
  const backButtons = document.querySelectorAll("#back-button, #to-home");
  backButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      window.location.assign("./index.html");
    });
  });

  const product = loadProduct();
  renderProductDetails(product);
}

window.addEventListener("DOMContentLoaded", init);

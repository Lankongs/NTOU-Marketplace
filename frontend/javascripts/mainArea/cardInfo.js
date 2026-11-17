const STORAGE_KEY = "ntou_marketplace_cards";
import { addToCart } from "./cartStore.js";

// !!!要想辦法解決動態更新的問題!!!

// 最初讀取products；裡面應該會有一個 GET 請求取得商品陣列
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

// 更新products；裡面應該要有一個 PUT / POST 請求以更新競標商品
function saveProduct(product) {
  if (!product) return;
  try {
    sessionStorage.setItem("ntou_selected_product", JSON.stringify(product));
  } catch (e) {
    console.warn("更新選取商品暫存失敗：", e);
  }

  if (product.id) {
    try {
      const rawCards = sessionStorage.getItem(STORAGE_KEY);
      if (rawCards) {
        const cards = JSON.parse(rawCards);
        if (Array.isArray(cards)) {
          const index = cards.findIndex((c) => String(c.id) === String(product.id));
          if (index !== -1) {
            cards[index] = { ...cards[index], ...product };
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
          }
        }
      }
    } catch (e) {
      console.warn("同步更新商品列表暫存失敗：", e);
    }
  }
}

// 使時間易閱讀
function formatDateTime(rawTime) {
  if (!rawTime) return "未指定";
  return rawTime.replace(/-/g, "/").replace("T", " ");
}

// 設計購買數量加減按鈕及其數量區塊
function setupQuantityController(maxQuantity) {
  const minusBtn = document.getElementById("btn-qty-minus");
  const plusBtn = document.getElementById("btn-qty-plus");
  const qtyInput = document.getElementById("input-qty");
  if (!minusBtn || !plusBtn || !qtyInput) return;

  const rawMax = Number(maxQuantity);
  const max = Math.max(0, Number.isFinite(rawMax) ? rawMax : 1);

  // 若庫存歸零，將數量設為 0 並全部禁用
  if (max === 0) {
    qtyInput.value = 0;
    qtyInput.disabled = true;
    minusBtn.disabled = true;
    plusBtn.disabled = true;
    return;
  }

  qtyInput.disabled = false;
  qtyInput.readOnly = false;
  qtyInput.min = 1;
  qtyInput.max = max;

  let current = Math.min(max, Math.max(1, Number(qtyInput.value) || 1));
  qtyInput.value = current;

  // 根據當前購買數量動態更新按鈕 disabled 狀態
  const updateButtonStates = () => {
    minusBtn.disabled = current <= 1;
    plusBtn.disabled = current >= max;
  };

  // 初始執行一次判斷（若剩餘數量為 1，加號也會預設 disabled）
  updateButtonStates();

  // 鍵盤即時輸入監聽
  qtyInput.oninput = () => {
    const val = qtyInput.value.trim();
    if (val === "") {
      minusBtn.disabled = true;
      plusBtn.disabled = false;
      return;
    }
    let num = Math.floor(Number(val));
    if (isNaN(num)) num = 1;

    if (num > max) {
      num = max;
      qtyInput.value = max;
    }
    current = num;
    updateButtonStates();
  };

  // 失焦或變更防呆校正
  const finalizeValue = () => {
    let num = Math.floor(Number(qtyInput.value));
    if (isNaN(num) || num < 1) {
      num = 1;
    } else if (num > max) {
      num = max;
    }
    current = num;
    qtyInput.value = current;
    updateButtonStates();
  };

  qtyInput.onblur = finalizeValue;
  qtyInput.onchange = finalizeValue;

  minusBtn.onclick = () => {
    let num = Math.floor(Number(qtyInput.value)) || current;
    if (num > 1) {
      current = num - 1;
      qtyInput.value = current;
      updateButtonStates();
    }
  };

  plusBtn.onclick = () => {
    let num = Math.floor(Number(qtyInput.value)) || current;
    if (num < max) {
      current = num + 1;
      qtyInput.value = current;
      updateButtonStates();
    }
  };
}

// ===== 直購商品：加入購物車 =====
// 購物車資料存放在 cartStore.js；正式接上後端時改用購物車 API。
// 裡面應該要有一個 PUT / POST & DELETE 請求以更新使用者購物車
async function handleAddToCart(product, button) {
  if (button.dataset.cartBusy === "true") return;
  button.dataset.cartBusy = "true";
  button.disabled = true;

  try {
    // 已有登入後端，因此仍使用 /api/auth/me 確認登入狀態。
    /*
    try {
      await api("/api/auth/me");
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        window.location.assign("./login.html");
        return;
      }
      throw new Error("伺服器錯誤，暫時無法確認登入狀態");
    }*/

    const input = document.getElementById("input-qty");
    const quantity = Number(input?.value ?? 1);
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new Error("請輸入有效的購買數量");
    }

    // 「商品 + 預設規格」相同時，cartStore.js 會合併數量。
    const result = addToCart(product, quantity);
    alert(
      result.clamped
        ? `庫存僅剩 ${result.qty} 件，購物車數量已調整`
        : `已將 ${quantity} 件「${product.name}」加入購物車！`
    );
  } catch (error) {
    alert("錯誤："+error.message || "加入購物車失敗");
  } finally {
    button.dataset.cartBusy = "false";
    // 已售完或已下架的商品不可重新啟用加入按鈕。
    button.disabled =
      product.type !== "direct" ||
      product.status === "delisted" ||
      product.status === "sold" ||
      Number(product.quantity) <= 0;
  }
}

// 暫無功能：增加追蹤商品
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

// 吸收選取product物件並顯示於html
// 競標時，會隨時發出 PUT / POST 請求來出價
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
    const isSold = product.status === "sold" || Number(product.quantity) <= 0;
    const isDelisted = product.status === "delisted";
    const available = !isSold && !isDelisted && (product.status === "selling" || product.status === "active");

    if (typeBadgeEl) {
      const badgeColor = isSold ? "bg-dark" : isDelisted ? "bg-secondary" : "bg-success";
      const statusText = isSold ? "直購 (已售完)" : isDelisted ? "直購 (已下架)" : "直購";
      typeBadgeEl.className = `position-absolute top-0 start-0 m-3 badge ${badgeColor} fs-6 z-1`;
      typeBadgeEl.textContent = statusText;
    }
    if (directSection) directSection.hidden = false;
    if (auctionSection) auctionSection.hidden = true;

    // 填入直購價格與剩餘數量
    const priceValEl = document.getElementById("direct-price-val");
    const qtyValEl = document.getElementById("direct-quantity-val");
    if (priceValEl) priceValEl.textContent = product.price ?? 0;
    if (qtyValEl) qtyValEl.textContent = product.quantity ?? 0;

    // 購買數量加減控制器
    setupQuantityController(product.quantity ?? 1);

    // 加入購物車按鈕反饋
    const addCartBtn = document.getElementById("btn-add-cart");
    if (addCartBtn) {
      addCartBtn.disabled = !available;
      if (isSold) {
        addCartBtn.textContent = "已售完";
      } else if (isDelisted) {
        addCartBtn.textContent = "商品已下架";
      } else {
        addCartBtn.textContent = "加入購物車";
      }
      addCartBtn.onclick = () => handleAddToCart(product, addCartBtn);
    }
  } else if (product.type === "auction") {
    // 檢查結標時間，自動判定結標售出（有出價者）或流標（無人出價）
    if (product.endTime) {
      const endTimeMs = new Date(product.endTime).getTime();
      if (!isNaN(endTimeMs) && Date.now() >= endTimeMs) {
        const hasBids = Array.isArray(product.bids) && product.bids.length > 0;
        if (product.status !== "delisted" && product.status !== "sold") {
          product.status = hasBids ? "sold" : "delisted";
          saveProduct(product);
        }
      }
    }

    const isSold = product.status === "sold";
    const isDelisted = product.status === "delisted";
    const isAuctionEnded =
      isSold ||
      isDelisted ||
      (product.endTime && new Date(product.endTime).getTime() <= Date.now());

    if (typeBadgeEl) {
      const badgeColor = isSold ? "bg-dark" : isDelisted ? "bg-secondary" : "bg-danger";
      const statusText = isSold ? "競標 (已售出)" : isDelisted ? "競標 (已結標)" : "競標";
      typeBadgeEl.className = `position-absolute top-0 start-0 m-3 badge ${badgeColor} fs-6 z-1`;
      typeBadgeEl.textContent = statusText;
    }
    if (directSection) directSection.hidden = true;
    if (auctionSection) auctionSection.hidden = false;

    // 填入目前最高出價與結標時間
    const auctionPriceEl = document.getElementById("auction-price-val");
    const auctionTimeEl = document.getElementById("auction-time-val");
    const currentPrice = Number(product.currentPrice ?? product.startPrice ?? 0);
    const bidIncrement = Math.max(1, Number(product.bidIncrement || 1));

    if (auctionPriceEl) auctionPriceEl.textContent = currentPrice;
    if (auctionTimeEl) auctionTimeEl.textContent = formatDateTime(product.endTime);

    // 出價按鈕事件反饋與輸入框屬性初始化
    const submitBidBtn = document.getElementById("btn-submit-bid");
    const bidInput = document.getElementById("input-bid-amount");

    const updateBidInputPlaceholder = () => {
      const activePrice = Number(product.currentPrice ?? product.startPrice ?? 0);
      const minValid = activePrice + bidIncrement;
      if (bidInput) {
        bidInput.min = minValid;
        bidInput.step = bidIncrement;
        bidInput.placeholder = isAuctionEnded
          ? "競標已結束"
          : `最低出價 NT$ ${minValid}`;
      }
    };

    updateBidInputPlaceholder();

    if (isAuctionEnded) {
      if (submitBidBtn) {
        submitBidBtn.disabled = true;
        submitBidBtn.textContent = isSold ? "已結標售出" : "競標已結束";
      }
      if (bidInput) {
        bidInput.disabled = true;
      }
    }

    if (submitBidBtn && bidInput) {
      submitBidBtn.onclick = () => {
        // 0. 檢查商品狀態
        if (product.status === "sold" || product.status === "delisted") {
          alert("此商品已結標或已下架，無法繼續出價！");
          return;
        }

        // 1. 檢查結標時間（根據 product 物件本身資訊）
        if (product.endTime) {
          const endTimeMs = new Date(product.endTime).getTime();
          if (!isNaN(endTimeMs) && Date.now() >= endTimeMs) {
            alert("此商品競標已截止，無法繼續出價！");
            return;
          }
        }

        // 2. 檢查壓哨出價限制
        const restrictedMinutes = Number(product.restrictedMinutes || 0);
        if (restrictedMinutes > 0 && product.endTime) {
          const endTimeMs = new Date(product.endTime).getTime();
          const remainingMs = endTimeMs - Date.now();
          const restrictedMs = restrictedMinutes * 60 * 1000;
          if (remainingMs > 0 && remainingMs <= restrictedMs) {
            const bids = Array.isArray(product.bids) ? product.bids : [];
            if (bids.length === 0) {
              alert(
                `已進入結標前 ${restrictedMinutes} 分鐘壓哨階段，僅限先前有出價紀錄者可繼續出價！`
              );
              return;
            }
          }
        }

        // 3. 檢查輸入值有效性
        const amount = Number(bidInput.value);
        if (!Number.isFinite(amount) || amount <= 0) {
          alert("請輸入有效的出價金額！");
          return;
        }

        // 4. 檢查不可小於或等於目前價格
        const activePrice = Number(product.currentPrice ?? product.startPrice ?? 0);
        if (amount <= activePrice) {
          alert(`出價金額不可小於或等於目前價格 NT$ ${activePrice}！`);
          return;
        }

        // 5. 檢查每標最低增額
        if (amount < activePrice + bidIncrement) {
          alert(
            `出價增額不足！每標最低增額為 NT$ ${bidIncrement}，最低出價需達 NT$ ${activePrice + bidIncrement}！`
          );
          return;
        }

        // 6. 成功出價：更新 product 物件屬性與出價紀錄
        product.currentPrice = amount;
        if (!Array.isArray(product.bids)) {
          product.bids = [];
        }
        product.bids.push({
          amount: amount,
          time: new Date().toISOString(),
        });

        // 7. 持久化寫回 sessionStorage（同步更新選中商品與主商品列表）
        saveProduct(product);

        // 8. 即時更新畫面與輸入框
        if (auctionPriceEl) auctionPriceEl.textContent = amount;
        bidInput.value = "";
        updateBidInputPlaceholder();

        alert(`成功出價 NT$ ${amount}！`);
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
    shippingEl.innerHTML = "";
    const shippingList = Array.isArray(product.shipping)
      ? product.shipping
      : [product.shipping];
    shippingList.forEach((ship) => {
      const badge = document.createElement("span");
      badge.className = "badge bg-white text-dark border px-2 py-1 fs-6";
      badge.textContent = ship;
      shippingEl.appendChild(badge);
    });
  }

  const descEl = document.getElementById("detail-desc");
  if (descEl) {
    descEl.textContent = product.desc ? product.desc.trim() : "無描述。";
  }

  // 6. 設定追蹤商品按鈕切換
  setupTrackButtons();
}

// 初始化準備
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

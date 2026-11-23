import { addCards } from "../mainArea/cardsList.js";

// 初始化
function init() {
  // 若當前頁面存在 #product-form-area（即位於 addProducts.html），初始化表單邏輯
  const formArea = document.getElementById("product-form-area");
  if (formArea) {
    initProductForm(formArea);
  }
}

// 將圖片檔案讀取為 Data URL（讓跨頁面跳轉回 index.html 後仍可預覽圖片）
// 可能要考慮一下儲存圖片的方式需獨立解決，裡面應該會有一個 PUT / POST 請求
function readFileAsDataURL(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result || "");
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

// 取得本地當前時間字串（格式為 YYYY-MM-DDTHH:mm），用於設定 datetime-local 的 min 屬性
function getCurrentLocalDateTimeString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:${min}`;
}

// 初始化 addProducts.html 上的表單互動與送出事件
// addCards會使用 PUT / POST 請求
function initProductForm(formArea) {
  // 預設渲染「直購模式」的欄位（此時競標欄位完全不在 DOM 中）
  renderDynamicFields("direct");

  // 綁定「返回主頁」事件
  const cancelButton = formArea.querySelector("#cancel-button");
  if (cancelButton) {
    cancelButton.addEventListener("click", () => {
      window.location.assign("./index.html");
    });
  }

  // 綁定「直購 / 競標」切換事件
  const typeRadios = formArea.querySelectorAll('input[name="listingType"]');
  typeRadios.forEach((radio) => {
    radio.addEventListener("change", (e) =>
      renderDynamicFields(e.target.value),
    );
  });

  // 當勾選任一標籤時，隱藏未選標籤的錯誤提示
  const tagCheckboxes = formArea.querySelectorAll('input[name="prodTags"]');
  const tagsError = formArea.querySelector("#tags-error");
  tagCheckboxes.forEach((cb) => {
    cb.addEventListener("change", () => {
      if (tagsError) tagsError.hidden = true;
    });
  });

  // 暫時將商品內容存入前端並導回 index.html，後端完成會改
  const form = formArea.querySelector("#product-listing-form");
  if (!form) return;

  form.addEventListener("submit", async function (event) {
    event.preventDefault(); // 阻止頁面預設跳轉

    // 0. 檢查並收集商品標籤（確保每張商品卡皆有一個以上的標籤）
    const checkedTags = Array.from(
      formArea.querySelectorAll('input[name="prodTags"]:checked'),
    ).map((cb) => cb.value);

    if (checkedTags.length === 0) {
      if (tagsError) tagsError.hidden = false;
      return;
    }

    // 自動附上「推薦」與「我的商品」標籤，合併使用者勾選的分類標籤（去重）
    const allTags = Array.from(new Set(["推薦", "我的商品", ...checkedTags]));

    // 1. 判斷當前模式（直購 / 競標）
    const selectedType = formArea.querySelector(
      'input[name="listingType"]:checked',
    ).value;

    // 2. 處理圖片（若有上傳圖片，轉為 Data URL 以支援跨頁面顯示）
    const imageInput = document.getElementById("prod-image");
    let imageUrl = "";
    if (imageInput && imageInput.files && imageInput.files[0]) {
      imageUrl = await readFileAsDataURL(imageInput.files[0]);
    }

    // 3. 收集共用欄位（包含多標籤陣列 tags 與多選運送方式 shipping）
    const selectedShippings = Array.from(
      document.querySelectorAll(".prod-shipping-cb:checked")
    ).map((cb) => cb.value);

    if (selectedShippings.length === 0) {
      alert("請至少選擇一種運送方式！");
      return;
    }

    let productData = {
      type: selectedType, // "direct" 或 "auction"
      name: document.getElementById("prod-name").value,
      desc: document.getElementById("prod-desc").value,
      shipping: selectedShippings,
      image: imageUrl,
      tags: allTags,
      status: "selling", // selling: 販售中, delisted: 已下架, sold: 已售出
    };

    // 4. 根據模式收集專屬欄位
    if (selectedType === "direct") {
      // 【直購模式】
      productData.price = Number(document.getElementById("direct-price").value);
      productData.quantity = Number(
        document.getElementById("direct-quantity").value,
      );
    } else if (selectedType === "auction") {
      // 【競標模式】起標價統一設置為 currentPrice，並保留 startPrice 供向下相容
      // 1. 檢查結標時間不可定在當前時間之前
      const endTimeInput = document.getElementById("auction-end-time");
      const endTimeValue = endTimeInput ? endTimeInput.value : "";
      const endTimeMs = new Date(endTimeValue).getTime();

      if (!endTimeValue || isNaN(endTimeMs) || endTimeMs <= Date.now()) {
        alert("結標時間不可定在當前時間之前！請重新設定結標時間。");
        if (endTimeInput) endTimeInput.focus();
        return;
      }

      // 2. 檢查壓哨出價限制時間不可大於或等於總競標時間（避免一上架即進入限制出價階段而無人可出價）
      const restrictedMinutes = Number(
        document.getElementById("auction-restricted-minutes").value || 0,
      );
      const totalDurationMinutes = (endTimeMs - Date.now()) / (1000 * 60);

      if (restrictedMinutes > 0 && totalDurationMinutes <= restrictedMinutes) {
        const roundedDuration = Math.max(1, Math.floor(totalDurationMinutes));
        alert(
          `設定不可行！壓哨出價限制時間（${restrictedMinutes} 分鐘）不可大於或等於總競標時長（約 ${roundedDuration} 分鐘）。\n此設定將導致商品一上架即因無人有出價紀錄而完全無法出價！請縮短壓哨限制時間或延長結標時間。`,
        );
        document.getElementById("auction-restricted-minutes").focus();
        return;
      }

      const startPrice = Number(
        document.getElementById("auction-start-price").value,
      );
      productData.currentPrice = startPrice;
      productData.startPrice = startPrice;
      productData.bidIncrement = Number(
        document.getElementById("auction-bid-increment").value,
      );
      productData.endTime = endTimeValue;
      productData.restrictedMinutes = restrictedMinutes;
      productData.bids = [];
    }

    // 5. 將物件傳給 cardsList.js 的 addCards 函數儲存
    addCards(productData);

    // 6. 成功新增商品後，跳轉回 index.html 主畫面
    window.location.assign("./index.html");
  });
}

// 根據選擇動態替換欄位（保留原有 Tag 結構不變）
function renderDynamicFields(type) {
  const container = document.getElementById("dynamic-fields");
  if (!container) return;

  if (type === "direct") {
    // 【直購模式欄位】：價格、數量
    container.innerHTML = `
          <div class="row">
            <div class="col-md-6 mb-3">
              <label for="h-price" class="form-label">價格 <span class="text-danger">*</span></label>
              <input type="number" class="form-control" id="direct-price" placeholder="NT$" min="0" required>
            </div>
            <div class="col-md-6 mb-3">
              <label for="direct-quantity" class="form-label">數量 <span class="text-danger">*</span></label>
              <input type="number" class="form-control" id="direct-quantity" placeholder="件數" min="1" value="1"
  required>
            </div>
          </div>
        `;
  } else if (type === "auction") {
    // 【競標模式欄位】：起標價、每標最低增額、結標時間
    container.innerHTML = `
          <div class="row">
            <div class="col-md-6 mb-3">
              <label for="auction-start-price" class="form-label">起標價 <span class="text-danger">*</span></label>
              <input type="number" class="form-control" id="auction-start-price" placeholder="NT$" min="0" required>
            </div>
            <div class="col-md-6 mb-3">
              <label for="auction-bid-increment" class="form-label">每標最低增額 <span class="text-danger">*</span></label>
              <input type="number" class="form-control" id="auction-bid-increment" placeholder="如：50" min="1"
  required>
            </div>
          </div>
          <div class="mb-3">
            <label for="auction-end-time" class="form-label">結標時間 <span class="text-danger">*</span></label>
            <input type="datetime-local" class="form-control" id="auction-end-time" min="${getCurrentLocalDateTimeString()}" required>
          </div>
          <div class="mb-3">
                <label for="auction-restricted-minutes" class="form-label">
                  壓哨出價限制 (分鐘)
                </label>
                <input type="number" class="form-control" id="auction-restricted-minutes" placeholder="如：5" min="0"
  value="0">
                <div class="form-text text-muted">
                  結標前最後幾分鐘僅限「已有出價紀錄者」可繼續出價（輸入 0 表示不限制，且不可大於或等於總競標時間）。
                </div>
          </div>
        `;
  }
}

window.addEventListener("load", init);

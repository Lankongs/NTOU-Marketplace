import { addCards } from "../mainArea/cardsList.js";
let mainArea;
let formArea = null; // 動態建立，未開啟時不佔用 DOM

function init() {
  mainArea = document.getElementById("main-area");
  let addButton = document.getElementById("list-products-button");
  addButton.addEventListener("click", showProductForm);
}

// 點擊「刊登商品」：動態生成並掛載表單到 DOM
function showProductForm() {
  mainArea.style.display = "none";

  // 動態建立表單容器
  formArea = document.createElement("div");
  formArea.id = "product-form-area";
  formArea.innerHTML = getFormBaseHTML();
  // 插入到 DOM 樹中
  mainArea.parentNode.insertBefore(formArea, mainArea.nextSibling);
  // 預設渲染「直購模式」的欄位（此時競標欄位完全不在 DOM 中）
  renderDynamicFields("direct");
  // 綁定「返回主頁」事件
  formArea
    .querySelector("#cancel-button")
    .addEventListener("click", hideProductForm);

  // 綁定「直購 / 競標」切換事件
  const typeRadios = formArea.querySelectorAll('input[name="listingType"]');
  typeRadios.forEach((radio) => {
    radio.addEventListener("change", (e) =>
      renderDynamicFields(e.target.value),
    );
  });

  //////////////// 暫時將商品內容傳回前端，後端完成會改
  const form = formArea.querySelector("#product-listing-form");
  form.addEventListener("submit", function (event) {
    event.preventDefault(); // 阻止頁面跳轉

    // 1. 判斷當前模式（直購 / 競標）
    const selectedType = formArea.querySelector(
      'input[name="listingType"]:checked',
    ).value;

    // 2. 處理圖片（若有上傳圖片，產生前端可直接預覽的 Blob URL）
    const imageInput = document.getElementById("prod-image");
    let imageUrl = "";
    if (imageInput.files && imageInput.files[0]) {
      imageUrl = URL.createObjectURL(imageInput.files[0]);
    }

    // 3. 收集共用欄位
    let productData = {
      type: selectedType, // "direct" 或 "auction"
      name: document.getElementById("prod-name").value,
      desc: document.getElementById("prod-desc").value,
      shipping: document.getElementById("prod-shipping").value,
      image: imageUrl,
    };

    // 4. 根據模式收集專屬欄位
    if (selectedType === "direct") {
      // 【直購模式】
      productData.price = Number(document.getElementById("direct-price").value);
      productData.quantity = Number(
        document.getElementById("direct-quantity").value,
      );
    } else if (selectedType === "auction") {
      // 【競標模式】
      productData.startPrice = Number(
        document.getElementById("auction-start-price").value,
      );
      productData.bidIncrement = Number(
        document.getElementById("auction-bid-increment").value,
      );
      productData.endTime = document.getElementById("auction-end-time").value;
      productData.restrictedMinutes = Number(
        document.getElementById("auction-restricted-minutes").value || 0,
      );
    }

    // 5. 將物件傳給 cardsList.js 的 addCards 函數，後端完成會改成從後端重拉
    addCards(productData);

    // 6. 返回主畫面
    hideProductForm();
  });
}

// 點擊「返回主頁」：從 DOM 樹徹底移除表單
function hideProductForm() {
  if (formArea) {
    formArea.remove(); // 徹底從 DOM 銷毀
    formArea = null;
  }
  mainArea.style.display = "flex";
}

// 根據選擇動態替換欄位
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
            <input type="datetime-local" class="form-control" id="auction-end-time" required>
          </div>
          <div class="mb-3">
                <label for="auction-restricted-minutes" class="form-label">
                  壓哨出價限制 (分鐘)
                </label>
                <input type="number" class="form-control" id="auction-restricted-minutes" placeholder="如：5" min="0"
  value="0">
                <div class="form-text text-muted">
                  結標前最後幾分鐘僅限「已有出價紀錄者」可繼續出價（輸入 0 表示不限制）。
                </div>
        `;
  }
}

// 表單基礎骨架（共用欄位）
function getFormBaseHTML() {
  return `
        <div class="container mt-4 mb-5" style="max-width: 650px;">
          <div class="card shadow-sm">
            <div class="card-body p-4">
              <div class="d-flex justify-content-between align-items-center mb-4">
                <h3 class="card-title mb-0">刊登商品</h3>
                <button type="button" class="btn btn-outline-secondary btn-sm" id="cancel-button">
                  ← 返回主頁
                </button>
              </div>

              <!-- 模式切換按鈕（預設直購） -->
              <div class="mb-4 text-center">
                <div class="btn-group w-100" role="group">
                  <input type="radio" class="btn-check" name="listingType" id="type-direct" value="direct" checked>
                  <label class="btn btn-outline-primary" for="type-direct">直購模式</label>

                  <input type="radio" class="btn-check" name="listingType" id="type-auction" value="auction">
                  <label class="btn btn-outline-primary" for="type-auction">競標模式</label>
                </div>
              </div>

              <form id="product-listing-form">
                <!-- 【共用欄位】名稱、照片、介紹 -->
                <div class="mb-3">
                  <label for="prod-name" class="form-label">商品名稱 <span class="text-danger">*</span></label>
                  <input type="text" class="form-control" id="prod-name" placeholder="請輸入商品名稱" required>
                </div>

                <div class="mb-3">
                  <label for="prod-image" class="form-label">商品照片</label>
                  <input type="file" class="form-control" id="prod-image" accept="image/*">
                </div>

                <div class="mb-3">
                  <label for="prod-desc" class="form-label">商品介紹</label>
                  <textarea class="form-control" id="prod-desc" rows="3" placeholder="請填寫詳細介紹"></textarea>
                </div>

                <!-- 【動態插槽】：只有被選中的模式欄位才會渲染進來 -->
                <div id="dynamic-fields"></div>

                <!-- 【共用欄位】運送方式 -->
                <div class="mb-4">
                  <label for="prod-shipping" class="form-label">運送方式 <span class="text-danger">*</span></label>
    		  <select class="form-select" id="prod-shipping" required>
                    <option value="" disabled selected>請選擇運送方式</option>
                    <option value="校內面交">校內面交</option>
                    <option value="超商取貨 (7-11 / 全家)">超商取貨 (7-11 / 全家)</option>
                    <option value="郵寄包裹">郵寄包裹</option>
    		  </select>
                </div>

                <div class="d-flex justify-content-end gap-2">
                  <button type="submit" class="btn btn-primary px-4">確認刊登</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      `;
}

window.addEventListener("load", init);

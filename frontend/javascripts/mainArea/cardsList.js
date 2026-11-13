let cards = [];

function addCards(productData) {
  // 1. 將表單送來的物件推入陣列中儲存，連後端後會改
  cards.push(productData);

  // 2. 取得首頁放商品卡的區域
  const cardsArea = document.getElementById("cards-lists-area");
  if (!cardsArea) return;

  // 3. 判斷要顯示直購價格還是競標資訊
  const priceInfo =
    productData.type === "direct"
      ? `價格：NT$ ${productData.price} | 庫存：${productData.quantity}`
      : `起標價：NT$ ${productData.startPrice} | 結標時間：${formatDateTime(productData.endTime)}`;

  const typeBadge =
    productData.type === "direct"
      ? `<span class="badge bg-success">直購</span>`
      : `<span class="badge bg-danger">競標</span>`;

  // 4. 動態在畫面上產生一張 Bootstrap 卡片
  const cardElement = document.createElement("div");
  cardElement.className = "card m-2 shadow-sm col";
  cardElement.style.width = "18rem";
  cardElement.innerHTML = `
        ${
          productData.image
            ? `<img src="${productData.image}" class="card-img-top" style="height: 180px; object-fit:
  cover;" alt="商品照片">`
            : ""
        }
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <h5 class="card-title mb-0">${productData.name}</h5>
            ${typeBadge}
          </div>
          <p class="card-text text-muted small">${productData.desc || "無詳細介紹"}</p>
          <p class="card-text fw-bold mb-1">${priceInfo}</p>
          <small class="text-secondary">運送方式：${productData.shipping}</small>
        </div>
      `;

  // 5. 加入到主畫面的商品卡容器內
  cardsArea.appendChild(cardElement);
}

function formatDateTime(rawTime) {
  if (!rawTime) return "";
  return rawTime.replace(/-/g, "/").replace("T", "-");
}

export { addCards };

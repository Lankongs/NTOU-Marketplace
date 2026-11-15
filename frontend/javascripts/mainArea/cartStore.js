/**
 * 購物車暫存資料管理
 * TEMP-PRODUCT-API：將來商品和購物車資料改由正式後端 API 提供。
 */

// ===== 1. 儲存位置 =====
const CART_KEY = 'ntou_marketplace_cart_v1';
const PRODUCT_KEY = 'ntou_marketplace_cards';
const DEFAULT_VARIANT = 'default';

function readArray(key) {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeCart(items) {
  sessionStorage.setItem(CART_KEY, JSON.stringify(items));
}

// ===== 2. 取得商品和購物車資料 =====
// TEMP-PRODUCT-API：正式版要替換成後端 GET 購物車／商品資料 API。
export function getCart() {
  return readArray(CART_KEY);
}

export function getProducts() {
  return readArray(PRODUCT_KEY);
}

// 相同「商品 + 規格」必須使用相同的購物車項目識別值。
export function itemKey(id, variant = DEFAULT_VARIANT) {
  return JSON.stringify([String(id), String(variant || DEFAULT_VARIANT)]);
}

// ===== 3. 加入購物車 =====
// TEMP-PRODUCT-API：正式版要替換成後端加入購物車 API。
export function addToCart(product, qty = 1, variant = DEFAULT_VARIANT) {
  if (!product || product.id === undefined || product.id === null) {
    throw new Error('商品資料不完整');
  }
  if (product.type !== 'direct') throw new Error('只有直購商品可以加入購物車');
  if (product.status === 'delisted') throw new Error('已下架商品不可加入購物車');
  //if (product.isOwnProduct === true) throw new Error('不能購買自己刊登的商品');

  const stock = Math.max(0, Math.floor(Number(product.quantity) || 0));
  if (stock === 0) throw new Error('商品已售完');

  const amount = Math.floor(Number(qty));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('請輸入有效數量');
  }

  const items = getCart();
  const key = itemKey(product.id, variant);
  const existing = items.find((item) => itemKey(item.productId, item.variant) === key);
  const originalQty = existing ? existing.qty : 0;
  const newQty = Math.min(stock, originalQty + amount);

  if (existing) {
    existing.qty = newQty;
  } else {
    items.push({
      productId: String(product.id),
      variant: String(variant || DEFAULT_VARIANT),
      qty: newQty,
      // 商品資料快照：只用來顯示已移除或已失效商品，正常商品價格取自最新商品資料。
      snapshot: {
        name: product.name || '未命名商品',
        image: product.image || '',
        price: Number(product.price) || 0,
        sellerId: String(product.sellerId || product.seller?.id || 'unknown'),
        sellerName: product.sellerName || product.seller?.name || '賣家資訊待補',
      },
    });
  }

  writeCart(items);
  return { qty: newQty, clamped: originalQty + amount > stock };
}

// ===== 4. 調整數量與刪除購物車商品 =====
// TEMP-PRODUCT-API：正式版改成後端 PUT / DELETE API。
export function updateCartQuantity(productId, variant, qty) {
  const items = getCart();
  const index = items.findIndex((item) =>
    itemKey(item.productId, item.variant) === itemKey(productId, variant)
  );
  if (index < 0) return;

  const amount = Number(qty);
  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error('數量必須是非負整數');
  }

  if (amount === 0) items.splice(index, 1);
  else items[index].qty = amount;
  writeCart(items);
}

export function removeCartItem(productId, variant) {
  updateCartQuantity(productId, variant, 0);
}

// ===== 5. 同步庫存 =====
// TEMP-PRODUCT-API：正式版改成向後端取得最新庫存與商品狀態。
export function syncCartWithCatalog(products = getProducts()) {
  const byId = new Map(products.map((product) => [String(product.id), product]));
  const items = getCart();
  const warnings = [];
  let changed = false;

  for (const item of items) {
    const product = byId.get(String(item.productId));
    if (!product) continue;

    const stock = Math.max(0, Math.floor(Number(product.quantity) || 0));
    if (stock > 0 && item.qty > stock) {
      item.qty = stock;
      changed = true;
      warnings.push(`「${product.name || '商品'}」庫存變動，數量已調整為 ${stock} 件`);
    }
  }

  if (changed) writeCart(items);
  return { items, products: byId, warnings };
}

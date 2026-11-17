/**
 * 購物車頁面互動
 * TEMP-PRODUCT-API：目前使用瀏覽器暫存資料，未來改接後端 API。
 */
import {
  updateCartQuantity,
  removeCartItem,
  syncCartWithCatalog,
  itemKey,
} from './cartStore.js';
import { api, post } from '../auth/api.js';

// ===== 1. 頁面設定與示範商品 =====
const DEMO = new URLSearchParams(location.search).get('demo') === '1';
const $ = (id) => document.getElementById(id);
const money = (value) => 'NT$ ' + Math.max(0, Number(value) || 0).toLocaleString('zh-TW');

// 示範商品資料：只有網址包含 ?demo=1 時才使用
// TEMP-PRODUCT-API：將來的商品名稱、價格、庫存、賣家等資訊來自後端
const demoProducts = [
  {
    id: 'demo1', type: 'direct', name: '計算機 Casio fx-991EX',
    price: 450, quantity: 5, image: '', sellerId: 'a',
    sellerName: '海大二手小舖', status: 'selling', shipping: '校內面交',
  },
  {
    id: 'demo2', type: 'direct', name: '資料結構與演算法原文書',
    price: 280, quantity: 3, image: '', sellerId: 'a',
    sellerName: '海大二手小舖', status: 'selling', shipping: '校內面交',
  },
  {
    id: 'demo3', type: 'direct', name: '無線藍牙滑鼠',
    price: 320, quantity: 8, image: '', sellerId: 'b',
    sellerName: '基隆生活選物', status: 'selling', shipping: '超商取貨',
  },
  {
    id: 'demo4', type: 'direct', name: '校園紀念帆布袋',
    price: 180, quantity: 0, image: '', sellerId: 'b',
    sellerName: '基隆生活選物', status: 'sold', shipping: '校內面交',
  },
];

function defaultDemoItems() {
  return [
    { productId: 'demo1', variant: 'default', qty: 1 },
    { productId: 'demo2', variant: 'default', qty: 2 },
    { productId: 'demo3', variant: 'default', qty: 1 },
    { productId: 'demo4', variant: 'default', qty: 1 },
  ];
}

let demoItems = defaultDemoItems();
let selected = new Set();
let currentItems = [];
let currentProducts = new Map();

// ===== 2. 畫面提示與商品資料 =====
function notice(message, warning = false) {
  const node = $('cart-notice');
  node.textContent = message;
  node.classList.toggle('warning', warning);
  node.hidden = !message;
}

function currentView() {
  if (DEMO) {
    currentItems = demoItems;
    currentProducts = new Map(demoProducts.map((product) => [product.id, product]));
    return;
  }

  // 購物車商品資料來源：目前從 sessionStorage 取得。
  // TEMP-PRODUCT-API：將來改為後端購物車與商品 API。
  const synced = syncCartWithCatalog();
  currentItems = synced.items;
  currentProducts = synced.products;

  if (synced.warnings.length > 0) {
    notice(synced.warnings.join('；'), true);
  }
}

function details(item) {
  const product = currentProducts.get(String(item.productId));
  const snapshot = item.snapshot || {};
  const sellerName = product?.sellerName || product?.seller?.name || snapshot.sellerName || '賣家資訊待補';
  const sellerId = String(product?.sellerId || product?.seller?.id || snapshot.sellerId || 'unknown');
  const stock = product ? Math.max(0, Math.floor(Number(product.quantity) || 0)) : 0;
  const active = Boolean(
    product &&
    product.type === 'direct' &&
    product.status !== 'delisted' &&
    product.status !== 'sold' &&
    product.sellerStatus !== 'suspended' &&
    stock > 0
  );

  let reason = '';
  if (!product) reason = '商品資訊已失效';
  else if (product.type !== 'direct') reason = '非直購商品';
  else if (product.sellerStatus === 'suspended') reason = '賣家已停權';
  else if (product.status === 'delisted') reason = '商品已下架';
  else if (product.status === 'sold' || stock <= 0) reason = '商品已售完';

  return {
    item,
    name: product?.name || snapshot.name || '未知商品',
    image: product?.image || snapshot.image || '',
    price: Number(product?.price ?? snapshot.price ?? 0),
    sellerName,
    sellerId,
    stock,
    active,
    reason,
    key: itemKey(item.productId, item.variant),
  };
}

// ===== 3. 建立重複使用的 HTML 元素 =====
function el(tag, className = '', content = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content) node.textContent = content;
  return node;
}

function labelCheckbox(checked, disabled = false, ariaLabel = '') {
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = checked;
  checkbox.disabled = disabled;
  checkbox.setAttribute('aria-label', ariaLabel);
  return checkbox;
}

// ===== 4. 購物車單筆商品顯示 =====
// 購物車商品：每件商品的圖片、名稱、價格、數量與刪除按鈕都在這裡建立。
function itemNode(data) {
  const row = el('article', 'cart-item' + (data.active ? '' : ' invalid'));

  // 商品勾選框
  const checkbox = labelCheckbox(selected.has(data.key), !data.active, '選取' + data.name);
  checkbox.addEventListener('change', () => {
    if (checkbox.checked) selected.add(data.key);
    else selected.delete(data.key);
    render();
  });
  row.append(checkbox);

  // 商品圖片
  const photo = el('div', 'cart-item-image');
  if (data.image && /^(data:image\/|https?:\/|\/|\.\/)/i.test(data.image)) {
    const image = document.createElement('img');
    image.src = data.image;
    image.alt = data.name;
    image.onerror = () => { photo.textContent = '📦'; };
    photo.append(image);
  } else {
    photo.textContent = '📦';
  }
  row.append(photo);

  // 商品名稱、規格、價格與失效原因
  const main = el('div', 'cart-item-main');
  main.append(el('h3', 'cart-item-name', data.name));
  main.append(el('div', 'cart-item-meta', data.item.variant !== 'default'
    ? '規格：' + data.item.variant
    : '預設規格'));
  main.append(el('div', 'cart-item-price', money(data.price)));
  if (!data.active) main.append(el('div', 'cart-item-status', data.reason));
  row.append(main);

  // 商品數量加減與輸入
  const actions = el('div', 'cart-item-actions');
  const quantity = el('div', 'cart-qty');

  const minus = el('button', '', '−');
  minus.type = 'button';
  minus.disabled = !data.active;
  minus.setAttribute('aria-label', '減少 ' + data.name);
  minus.addEventListener('click', () => editQty(data, data.item.qty - 1));

  const input = document.createElement('input');
  input.type = 'number';
  input.min = '0';
  input.max = String(data.stock);
  input.step = '1';
  input.value = data.item.qty;
  input.disabled = !data.active;
  input.setAttribute('aria-label', data.name + ' 數量');
  input.addEventListener('change', () => editQty(data, input.value));

  const plus = el('button', '', '+');
  plus.type = 'button';
  plus.disabled = !data.active || data.item.qty >= data.stock;
  plus.setAttribute('aria-label', '增加 ' + data.name);
  plus.addEventListener('click', () => editQty(data, data.item.qty + 1));

  quantity.append(minus, input, plus);

  // 刪除購物車商品
  const deleteButton = el('button', 'cart-delete', '⌫ 刪除');
  deleteButton.type = 'button';
  deleteButton.addEventListener('click', () => {
    remove(data);
    selected.delete(data.key);
    render();
    notice('已將商品從購物車移除');
  });

  actions.append(quantity, deleteButton);
  row.append(actions);
  return row;
}

// ===== 5. 購物車商品數量與刪除操作 =====
function remove(data) {
  if (DEMO) {
    demoItems = demoItems.filter((item) => itemKey(item.productId, item.variant) !== data.key);
  } else {
    // TEMP-PRODUCT-API：未來改成呼叫後端刪除購物車 API
    removeCartItem(data.item.productId, data.item.variant);
  }
}

function editQty(data, rawValue) {
  const value = Number(rawValue);

  if (rawValue === '' || !Number.isInteger(value) || value < 0) {
    notice('數量必須是 0 到庫存上限的整數', true);
    render();
    return;
  }

  if (value === 0) {
    remove(data);
    selected.delete(data.key);
    render();
    notice('已將商品從購物車移除');
    return;
  }

  const quantity = Math.min(value, data.stock);
  if (value > data.stock) notice('僅剩 ' + data.stock + ' 件，已調整數量', true);

  if (DEMO) {
    data.item.qty = quantity;
  } else {
    // TEMP-PRODUCT-API：未來改成呼叫後端修改購物車數量 API
    updateCartQuantity(data.item.productId, data.item.variant, quantity);
  }
  render();
}

// ===== 6. 畫面渲染：賣家分組、全選與總金額 =====
function render() {
  currentView();
  const all = currentItems.map(details);
  const validKeys = new Set(all.filter((data) => data.active).map((data) => data.key));
  selected = new Set([...selected].filter((key) => validKeys.has(key)));

  $('cart-item-count').textContent = all.length + ' 件商品';
  $('cart-empty').hidden = all.length > 0;
  $('cart-list-toolbar').hidden = all.length === 0;

  // 將購物車商品依賣家分組
  const grouped = new Map();
  for (const data of all) {
    const groupKey = data.sellerId + '|' + data.sellerName;
    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, { name: data.sellerName, items: [] });
    }
    grouped.get(groupKey).items.push(data);
  }
  const groups = [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));

  // 購物車商品位置：把每位賣家與所屬商品放入 cart.html 的 #cart-seller-groups
  const container = $('cart-seller-groups');
  container.replaceChildren();
  $('cart-seller-summary').textContent = groups.length + ' 個賣家';

  for (const group of groups) {
    const wrapper = el('section', 'cart-seller-group');
    const header = el('div', 'cart-seller-head');
    const headerLeft = el('div', 'cart-seller-head-left');
    const available = group.items.filter((data) => data.active);
    const checked = available.length > 0 && available.every((data) => selected.has(data.key));

    // 該賣家商品的全選框
    const checkbox = labelCheckbox(checked, available.length === 0, '全選 ' + group.name + ' 商品');
    checkbox.indeterminate = available.some((data) => selected.has(data.key)) && !checked;
    checkbox.addEventListener('change', () => {
      available.forEach((data) => {
        if (checkbox.checked) selected.add(data.key);
        else selected.delete(data.key);
      });
      render();
    });

    headerLeft.append(
      checkbox,
      el('span', 'cart-store-mark', '⌂'),
      el('span', 'cart-seller-name', group.name)
    );
    header.append(headerLeft, el('span', 'cart-seller-count', group.items.length + ' 件商品'));
    wrapper.append(header);
    group.items.forEach((data) => wrapper.append(itemNode(data)));
    container.append(wrapper);
  }

  // 整個購物車全選狀態
  const available = all.filter((data) => data.active);
  const checked = available.length > 0 && available.every((data) => selected.has(data.key));
  const selectAll = $('cart-select-all-top');
  selectAll.checked = checked;
  selectAll.indeterminate = available.some((data) => selected.has(data.key)) && !checked;
  selectAll.disabled = available.length === 0;

  // 訂單摘要：已選件數、商品小計與總金額
  const selectedItems = available.filter((data) => selected.has(data.key));
  const count = selectedItems.reduce((sum, data) => sum + data.item.qty, 0);
  const subtotal = selectedItems.reduce((sum, data) => sum + data.price * data.item.qty, 0);

  $('cart-selected-count').textContent = count + ' 件';
  $('cart-subtotal').textContent = money(subtotal);
  $('cart-total').textContent = money(subtotal);
  $('cart-checkout').disabled = count === 0;
}

// ===== 7. 上方導覽列事件 =====
function bindNav() {
  // 主頁按鈕：與新版 index.html 使用相同 ID。
  $('to-home').addEventListener('click', () => {
    location.href = './index.html';
  });
  $('list-products-button').addEventListener('click', () => {
    location.href = './addProducts.html';
  });
  $('shopping-cart-button').addEventListener('click', () => {
    // 已在購物車頁面，不需要再次跳轉。
  });
  $('user-button').addEventListener('click', () => {
    location.href = DEMO ? './selfPage.html' : './selfPage.html';
  });
  $('cart-search-button').addEventListener('click', () => {
    location.href = './index.html';
  });
  $('cart-search').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') location.href = './index.html';
  });
  $('logout-button').addEventListener('click', async () => {
    try {
      await post('/api/auth/logout');
      location.href = './login.html';
    } catch {
      notice('伺服器錯誤', true);
    }
  });
}

// ===== 8. 登入檢查 =====
async function checkAuth() {
  if (DEMO) {
    $('member-label').textContent = '示範會員';
    return true;
  }

  try {
    const user = await api('/api/auth/me');
    $('member-label').textContent = user.displayName || user.name || user.account || '會員';
    $('logout-button').hidden = false;
    return true;
  } catch {
    location.href = './login.html';
    return false;
  }
}

// ===== 9. 頁面初始化 =====
async function init() {
  bindNav();
  if (!(await checkAuth())) return;

  $('cart-select-all-top').addEventListener('change', (event) => {
    currentView();
    for (const data of currentItems.map(details).filter((item) => item.active)) {
      if (event.target.checked) selected.add(data.key);
      else selected.delete(data.key);
    }
    render();
  });

  // 下單按鈕：正式訂單建立、拆單與庫存扣減尚未實作。
  $('cart-checkout').addEventListener('click', () => {
    notice('訂單功能將於後端整合階段開放，目前不會建立真實訂單。');
  });

  if (DEMO) {
    $('cart-preview-hint').hidden = false;
    $('cart-reset-demo').addEventListener('click', () => {
      demoItems = defaultDemoItems();
      selected.clear();
      notice('');
      render();
    });
  }
  render();
}

init();

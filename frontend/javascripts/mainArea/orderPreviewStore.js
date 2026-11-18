/**
 * 第六階段：前端測試訂單共用資料。
 * TODO-ORDER-API：後端完成後改為 API；sessionStorage 並非跨會員共享資料庫。
 * 請勿用它作為會員身分、付款、庫存或實際交易的權威來源。
 */
const ORDER_KEY = 'ntou_marketplace_order_preview_v1';
const CART_KEY = 'ntou_marketplace_cart_v1';
const PRODUCT_KEY = 'ntou_marketplace_cards';
export const PREVIEW_EVENT = 'ntou-preview-orders-updated';

/** 讀取目前分頁中的前端測試訂單，不代表正式會員訂單。 */
/** 讀取目前分頁暫存的訂單列表。 */
export function getPreviewOrders() {
  try {
    const value = JSON.parse(sessionStorage.getItem(ORDER_KEY) || '[]');
    return Array.isArray(value) ? value.filter(o => o && typeof o.id === 'string' && Array.isArray(o.items)) : [];
  } catch {
    return [];
  }
}
/** 儲存測試訂單並通知買家／賣家卡片重新讀取。 */
/** 儲存整份測試訂單並通知畫面更新。 */
function writeOrders(orders) {
  sessionStorage.setItem(ORDER_KEY, JSON.stringify(orders));
  window.dispatchEvent(new Event(PREVIEW_EVENT));
}
/** 產生不易重複的前端測試訂單編號。 */
/** 建立不易重複的測試訂單編號。 */
function uniqueOrderId() {
  const random = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8).toUpperCase()
    : Math.random().toString(36).slice(2, 10).toUpperCase();
  return `PREVIEW-${Date.now()}-${random}`;
}
/** 解析瀏覽器暫存陣列；格式不正確時直接中止，不覆蓋既有資料。 */
/** 安全讀取暫存陣列，內容有誤時阻止修改。 */
function readRequiredArray(key) {
  const raw = sessionStorage.getItem(key);
  if (raw === null) throw new Error(`找不到暫存資料：${key}`);
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error(`暫存格式錯誤：${key}`);
  return parsed;
}

/** 同時更新訂單、購物車與商品庫存；任一步驟儲存失敗則恢復原內容。 */
/** 盡量同步儲存訂單、購物車與庫存，失敗則回復。 */
function saveTogether(orders, cart, products) {
  const before = [[ORDER_KEY,sessionStorage.getItem(ORDER_KEY)],
                  [CART_KEY,sessionStorage.getItem(CART_KEY)],
                  [PRODUCT_KEY,sessionStorage.getItem(PRODUCT_KEY)]];
  try {
    // 將三份內容一次計算完成，避免修改到一半才發現資料不完整。
    const contents = [JSON.stringify(orders), JSON.stringify(cart), JSON.stringify(products)];
    sessionStorage.setItem(ORDER_KEY, contents[0]);
    sessionStorage.setItem(CART_KEY, contents[1]);
    sessionStorage.setItem(PRODUCT_KEY, contents[2]);
  } catch (error) {
    for (const [key, old] of before) {
      try { if (old === null) sessionStorage.removeItem(key); else sessionStorage.setItem(key,old); }
      catch (rollbackError) { console.error('前端測試資料回復失敗',key,rollbackError); }
    }
    throw new Error(`暫存交易更新失敗：${error.message}`);
  }
  window.dispatchEvent(new Event(PREVIEW_EVENT));
}

/** 正式下單前端預覽：建立訂單；一般模式同步移除已購買商品及扣除測試庫存。 */
/** 結帳時建立共用測試訂單，必要時同步扣庫存與移除購物車商品。 */
export function createPreviewOrders(drafts, {updateCart=false}={}) {
  if (!Array.isArray(drafts) || !drafts.length) throw new Error('沒有可建立的訂單');
  const now = new Date();
  const createdAt = now.toLocaleString('zh-TW', {hour12:false});
  const newOrders = drafts.map(draft => {
    if (!Array.isArray(draft.items) || !draft.items.length || !Number.isFinite(draft.shippingFee)) throw new Error('訂單資料不完整');
    return {
      id:uniqueOrderId(), source:'checkout-preview', status:'processing', createdAt,
      buyerName:'測試買家（此瀏覽器）', sellerId:String(draft.sellerId), sellerName:String(draft.sellerName || '賣家資訊待補'),
      items:draft.items.map(it=>({productId:String(it.productId), variant:String(it.variant||'default'), name:String(it.name), image:String(it.image||''), unitPrice:Number(it.price), quantity:Number(it.quantity)})),
      shippingMethod:String(draft.shippingMethod), shippingCode:String(draft.shippingCode),
      destination:String(draft.destination), recipient:String(draft.recipient||''), phone:String(draft.phone||''),
      shippingInfo:{...draft.shippingInfo}, shippingFee:Number(draft.shippingFee),
      paymentMethod:draft.shippingCode==='meet'?'cash':'transfer', paymentStatus:'unpaid', shipmentStatus:'pending',
      trackingNumber:'', cancelStatus:'none', requestedBy:'', cancelReason:'', cancelHistory:[],
      paymentConfirmedAt:null, shippedAt:null, completedAt:null, cancelledAt:null,
      inventoryAdjusted: Boolean(updateCart), inventoryRestored:false
    };
  });
  const allOrders=[...newOrders, ...getPreviewOrders()];
  if (!updateCart) {
    writeOrders(allOrders); // demo=1：沒有真實的瀏覽器購物車清單，不修改庫存。
    return newOrders;
  }
  const cart=readRequiredArray(CART_KEY);
  const products=readRequiredArray(PRODUCT_KEY);
  const productsById=new Map(products.map(product=>[String(product.id),product]));
  const cartByKey=new Map(cart.map(item=>[JSON.stringify([String(item.productId), String(item.variant||'default')]),item]));
  const stockChanges=new Map();
  const cartChanges=new Map();
  for (const draft of drafts) {
    for (const item of draft.items) {
      const productId=String(item.productId), variant=String(item.variant||'default');
      const quantity=Number(item.quantity);
      const key=JSON.stringify([productId,variant]);
      if (!Number.isSafeInteger(quantity)||quantity<1) throw new Error('商品數量無效');
      if (!productsById.has(productId) || !cartByKey.has(key)) throw new Error('購物車商品已變動，請返回購物車重試');
      stockChanges.set(productId,(stockChanges.get(productId)||0)+quantity);
      cartChanges.set(key,(cartChanges.get(key)||0)+quantity);
    }
  }
  for (const [productId,quantity] of stockChanges) {
    const product=productsById.get(productId);
    if (product.status==='delisted' || product.type!=='direct' || !Number.isInteger(Number(product.quantity)) || Number(product.quantity)<quantity) {
      throw new Error(`商品「${product.name||productId}」已下架或庫存不足`);
    }
  }
  for (const [key,quantity] of cartChanges) {
    if (Number(cartByKey.get(key).qty)<quantity) throw new Error('購物車數量已變更，請返回購物車重試');
  }
  // 驗證完成後才修改「複製」的資料，避免儲存失敗污染畫面記憶體。
  const nextProducts=structuredClone(products);
  const nextCart=structuredClone(cart);
  for (const product of nextProducts) if(stockChanges.has(String(product.id))) {
    product.quantity=Math.max(0, Number(product.quantity)-stockChanges.get(String(product.id)));
    if (product.quantity <= 0) {
      product.status = 'sold';
    }
  }
  try {
    const rawSelected = sessionStorage.getItem("ntou_selected_product");
    if (rawSelected) {
      const selected = JSON.parse(rawSelected);
      if (selected && stockChanges.has(String(selected.id))) {
        selected.quantity = Math.max(0, Number(selected.quantity) - stockChanges.get(String(selected.id)));
        if (selected.quantity <= 0) {
          selected.status = 'sold';
        }
        sessionStorage.setItem("ntou_selected_product", JSON.stringify(selected));
      }
    }
  } catch (e) {
    console.warn("同步更新選取商品暫存失敗：", e);
  }
  for (const item of nextCart) {
    const key=JSON.stringify([String(item.productId),String(item.variant||'default')]);
    item.qty=Number(item.qty)-(cartChanges.get(key)||0);
  }
  saveTogether(allOrders,nextCart.filter(item=>item.qty>0),nextProducts);
  return newOrders;
}
/**
 * 將賣家頁既有 DEMO-SALE 範例轉成買賣雙方共用的測試訂單。
 * 僅初始化一次，不會在重新整理時覆蓋已確認的付款或取消狀態。
 * 注意：這些範例不會修改商品庫存，也不是正式會員訂單。
 */
export function initializeSharedSalesDemos(samples) {
  const initializedKey = 'ntou_marketplace_shared_sales_demos_v1';
  if (sessionStorage.getItem(initializedKey) === '1') return;
  if (!Array.isArray(samples)) return;

  const existing = getPreviewOrders();
  const ids = new Set(existing.map(order => order.id));
  const demos = samples.filter(sample => !ids.has(sample.id)).map(sample => {
    const meet = sample.shippingMethod === '校內面交';
    const isSeven = String(sample.shippingMethod).includes('7-ELEVEN');
    const isFamily = String(sample.shippingMethod).includes('全家');
    const shippingCode = meet ? 'meet' : isSeven ? 'seven' : isFamily ? 'family' : 'post';
    const pending = sample.cancelStatus === 'pending';
    const history = pending ? [{
      requestedBy: sample.requestedBy || 'buyer',
      reason: sample.cancelReason || '未提供原因',
      requestedAt: new Date().toISOString(),
      result: 'pending',
      respondedBy: null,
      respondedAt: null
    }] : [];
    return {
      ...structuredClone(sample),
      source: 'checkout-preview',
      isSharedDemo: true,
      sellerId: 'demo-seller',
      sellerName: '測試賣家（示範資料）',
      shippingCode,
      items: sample.items.map((item, index) => ({
        ...item,
        productId: `demo-item-${sample.id}-${index}`,
        variant: 'default',
        image: ''
      })),
      requestedBy: sample.requestedBy || '',
      cancelHistory: history,
      inventoryAdjusted: false,
      inventoryRestored: false
    };
  });

  // 先儲存資料再寫初始化標記，避免中途失敗造成永久無法初始化。
  if (demos.length) writeOrders([...existing, ...demos]);
  sessionStorage.setItem(initializedKey, '1');
}

/**
 * 判斷一張訂單是否曾經提出取消申請。
 * 不論申請仍待處理、已拒絕或已同意，任一方都不能再提出第二次。
 * 同時相容舊版測試訂單的取消欄位與取消歷史。
 */
export function hasRequestedCancellation(order) {
  if (!order) return false;
  if (Array.isArray(order.cancelHistory) && order.cancelHistory.length > 0) return true;
  if (order.cancelStatus && order.cancelStatus !== 'none') return true;
  return Boolean(order.cancelRequestedAt || order.requestedBy || order.cancelledAt || order.status === 'cancelled');
}

/** 統一管理買家／賣家的付款、出貨、完成與取消；取消時只恢復一次測試庫存。 */
/** 驗證買賣操作條件，修改付款、交付、取消與完成狀態。 */
export function applyPreviewAction(orderId, role, action, options={}) {
  const orders = getPreviewOrders();
  const order = orders.find(o=>o.id===orderId);
  if (!order) throw new Error('找不到測試訂單');
  if (order.status!=='processing') throw new Error('只有處理中的訂單可操作');
  const pending=order.cancelStatus==='pending';
  const shipped=order.shipmentStatus==='shipped';
  const meet=order.shippingCode==='meet';
  const timestamp=new Date().toISOString();
  if (action==='payment' && role==='seller') {
    if (pending || order.paymentStatus==='paid') throw new Error('目前無法確認付款');
    order.paymentStatus='paid'; order.paymentConfirmedAt=timestamp;
  } else if (action==='ship' && role==='seller') {
    if (pending || shipped) throw new Error('目前無法標記出貨');
    if (!meet && order.paymentStatus!=='paid') throw new Error('必須先確認匯款');
    if (!meet && !String(options.trackingNumber||'').trim()) throw new Error('請填寫寄件編號');
    order.trackingNumber=meet?'':String(options.trackingNumber).trim();
    order.shipmentStatus='shipped'; order.shippedAt=timestamp;
  } else if (action==='complete' && role==='buyer') {
    if (pending || !shipped || order.paymentStatus!=='paid') throw new Error('付款與交付狀態尚未符合完成條件');
    if (options.confirmReceived!==true) throw new Error('請先確認已實際收到商品');
    order.status='completed';order.completedAt=timestamp;
  } else if (action==='request-cancel' && (role==='buyer'||role==='seller')) {
    if (shipped) throw new Error('商品已寄出／交付，不能申請取消');
    if (hasRequestedCancellation(order)) throw new Error('每張訂單只能申請取消一次，這筆訂單已經使用過取消機會');
    const reason=String(options.reason||'').trim();
    if (!reason) throw new Error('請填寫取消原因');
    // 每張訂單只能提出一次取消申請；保留這次申請供雙方查閱。
    if (!Array.isArray(order.cancelHistory)) order.cancelHistory=[];
    order.cancelHistory.push({requestedBy:role, reason, requestedAt:timestamp, result:'pending', respondedBy:null, respondedAt:null});
    order.cancelStatus='pending'; order.requestedBy=role; order.cancelReason=reason;order.cancelRequestedAt=timestamp;
  } else if ((action==='approve'||action==='reject') && (role==='buyer'||role==='seller')) {
    if (!pending || order.requestedBy===role || shipped) throw new Error('目前無法回覆這筆取消申請');
    // 舊版測試訂單可能沒有 cancelHistory，先補上目前待處理的申請。
    if (!Array.isArray(order.cancelHistory)) order.cancelHistory=[];
    let last=[...order.cancelHistory].reverse().find(record=>record.result==='pending');
    if (!last) {
      last={requestedBy:order.requestedBy, reason:order.cancelReason||'未填寫', requestedAt:order.cancelRequestedAt||null, result:'pending', respondedBy:null, respondedAt:null};
      order.cancelHistory.push(last);
    }
    last.result=action==='approve'?'approved':'rejected';
    last.respondedBy=role;
    last.respondedAt=timestamp;
    order.cancelStatus=last.result;order.cancelRespondedAt=timestamp;
    if (action==='approve') { order.status='cancelled';order.cancelledAt=timestamp; }
  } else {
    throw new Error('沒有權限或無效的操作');
  }
  if (action==='approve' && order.status==='cancelled' && order.inventoryAdjusted && !order.inventoryRestored) {
    const products=readRequiredArray(PRODUCT_KEY);
    const changes=new Map();
    for (const item of order.items) changes.set(String(item.productId),(changes.get(String(item.productId))||0)+Number(item.quantity));
    const copy=structuredClone(products);
    for (const product of copy) if(changes.has(String(product.id))) {
      product.quantity=Number(product.quantity)+changes.get(String(product.id));
      if (product.status === 'sold' && product.quantity > 0) {
        product.status = 'selling';
      }
    }
    order.inventoryRestored=true;
    saveTogether(orders, readRequiredArray(CART_KEY), copy);
  } else writeOrders(orders);
  return order;
}

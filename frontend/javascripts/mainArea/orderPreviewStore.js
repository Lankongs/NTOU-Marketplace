/**
 * 第六階段：前端測試訂單共用資料。
 * TODO-ORDER-API：後端完成後改為 API；sessionStorage 並非跨會員共享資料庫。
 * 請勿用它作為會員身分、付款、庫存或實際交易的權威來源。
 */
const ORDER_KEY = 'ntou_marketplace_order_preview_v1';
export const PREVIEW_EVENT = 'ntou-preview-orders-updated';

export function getPreviewOrders() {
  try {
    const value = JSON.parse(sessionStorage.getItem(ORDER_KEY) || '[]');
    return Array.isArray(value) ? value.filter(o => o && typeof o.id === 'string' && Array.isArray(o.items)) : [];
  } catch {
    return [];
  }
}
function writeOrders(orders) {
  sessionStorage.setItem(ORDER_KEY, JSON.stringify(orders));
  window.dispatchEvent(new Event(PREVIEW_EVENT));
}
function uniqueOrderId() {
  const random = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8).toUpperCase()
    : Math.random().toString(36).slice(2, 10).toUpperCase();
  return `PREVIEW-${Date.now()}-${random}`;
}
export function createPreviewOrders(drafts) {
  if (!Array.isArray(drafts) || !drafts.length) throw new Error('沒有可建立的訂單');
  const now = new Date();
  const createdAt = now.toLocaleString('zh-TW', {hour12:false});
  const newOrders = drafts.map(draft => {
    if (!Array.isArray(draft.items) || !draft.items.length || !Number.isFinite(draft.shippingFee)) throw new Error('訂單資料不完整');
    return {
      id:uniqueOrderId(), source:'checkout-preview', status:'processing', createdAt,
      buyerName:'測試買家（此瀏覽器）', sellerId:String(draft.sellerId), sellerName:String(draft.sellerName || '賣家資訊待補'),
      items:draft.items.map(it=>({productId:String(it.productId), name:String(it.name), image:String(it.image||''), unitPrice:Number(it.price), quantity:Number(it.quantity)})),
      shippingMethod:String(draft.shippingMethod), shippingCode:String(draft.shippingCode),
      destination:String(draft.destination), recipient:String(draft.recipient||''), phone:String(draft.phone||''),
      shippingInfo:{...draft.shippingInfo}, shippingFee:Number(draft.shippingFee),
      paymentMethod:draft.shippingCode==='meet'?'cash':'transfer', paymentStatus:'unpaid', shipmentStatus:'pending',
      trackingNumber:'', cancelStatus:'none', requestedBy:'', cancelReason:'',
      paymentConfirmedAt:null, shippedAt:null, completedAt:null, cancelledAt:null
    };
  });
  writeOrders([...newOrders, ...getPreviewOrders()]);
  return newOrders;
}
/** 透過單一入口修改同一張測試訂單，模擬買家／賣家操作。 */
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
    if (pending || shipped) throw new Error('尚有取消申請或商品已寄出／交付');
    const reason=String(options.reason||'').trim();
    if (!reason) throw new Error('請填寫取消原因');
    order.cancelStatus='pending'; order.requestedBy=role; order.cancelReason=reason;order.cancelRequestedAt=timestamp;
  } else if ((action==='approve'||action==='reject') && (role==='buyer'||role==='seller')) {
    if (!pending || order.requestedBy===role || shipped) throw new Error('目前無法回覆這筆取消申請');
    order.cancelStatus=action==='approve'?'approved':'rejected';order.cancelRespondedAt=timestamp;
    if (action==='approve') { order.status='cancelled';order.cancelledAt=timestamp; }
  } else {
    throw new Error('沒有權限或無效的操作');
  }
  writeOrders(orders);
  return order;
}

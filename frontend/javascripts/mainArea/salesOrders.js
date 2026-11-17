import { getPreviewOrders, applyPreviewAction, PREVIEW_EVENT } from './orderPreviewStore.js';
/**
 * 我的銷售訂單：第五階段前端互動預覽。
 * SAMPLE_ORDERS 僅在本頁記憶體，重新整理即還原。
 * 不與購買訂單、商品庫存、購物車或通知系統同步。
 */
const SAMPLE_ORDERS = [
  {
    id: 'DEMO-SALE001', status: 'processing', createdAt: '2026/11/16 15:30', buyerName: '測試買家 A',
    paymentStatus: 'unpaid', shipmentStatus: 'pending', shippingMethod: '7-ELEVEN 取貨',
    destination: '海大門市（測試）', recipient: '測試收件人', phone: '09xx-xxx-xxx',
    shippingFee: 60, trackingNumber: '', cancelStatus: 'none',
    items: [{name: '演算法參考書', unitPrice: 350, quantity: 1}, {name: '計算機', unitPrice: 500, quantity: 1}]
  },
  {
    id: 'DEMO-SALE002', status: 'processing', createdAt: '2026/11/16 17:00', buyerName: '測試買家 B',
    paymentStatus: 'unpaid', shipmentStatus: 'pending', shippingMethod: '校內面交',
    destination: '海大圖書館一樓，2026/11/20 15:00', recipient: '', phone: '',
    shippingFee: 0, trackingNumber: '', cancelStatus: 'pending', requestedBy: 'buyer',
    cancelReason: '臨時無法面交，希望取消交易',
    items: [{name: '二手小說', unitPrice: 200, quantity: 1}]
  },
  {
    id: 'DEMO-SALE003', status: 'completed', createdAt: '2026/11/14 12:30', buyerName: '測試買家 C',
    paymentStatus: 'paid', shipmentStatus: 'shipped', shippingMethod: '全家取貨',
    destination: '基隆門市（測試）', recipient: '測試收件人', phone: '',
    shippingFee: 60, trackingNumber: 'DEMO-999111', cancelStatus: 'none',
    items: [{name: '資料結構講義', unitPrice: 250, quantity: 1}]
  },
  {
    id: 'DEMO-SALE004', status: 'cancelled', createdAt: '2026/11/12 09:00', buyerName: '測試買家 D',
    paymentStatus: 'unpaid', shipmentStatus: 'pending', shippingMethod: '郵寄包裹',
    destination: '測試地址', recipient: '測試收件人', phone: '',
    shippingFee: 80, trackingNumber: '', cancelStatus: 'approved', cancelReason: '雙方協議取消（示範）',
    items: [{name: '英文原文書', unitPrice: 160, quantity: 1}]
  }
];

const labels = {processing:'貨物處理中', completed:'已完成', cancelled:'已取消'};
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n => `NT$${Number(n || 0).toLocaleString('zh-TW')}`;
const expanded = new Set();
const previewTrackingDrafts = new Map();
function allOrders(){ return [...getPreviewOrders(), ...SAMPLE_ORDERS]; }
function findOrder(id){ return allOrders().find(o=>o.id===id); }
let currentStatus = 'processing';
let pendingAction = null;

function isMeet(order) { return order.shippingMethod === '校內面交'; }
function subtotal(order) { return order.items.reduce((s, item) => s + item.unitPrice * item.quantity, 0); }
function statusText(order) { return order.shipmentStatus === 'shipped' ? (isMeet(order) ? '已交付' : '已寄出') : (isMeet(order) ? '尚未交付' : '尚未寄出'); }
function notice(text, danger = false) {
  const node = document.getElementById('sales-order-notice');
  node.textContent = text;
  node.className = `alert mt-3 ${danger ? 'alert-danger' : 'alert-info'}`;
  node.hidden = !text;
}
function actionButton(order, action, title, classes = 'btn-outline-primary', disabled = false) {
  return `<button type="button" class="btn btn-sm ${classes}" data-sales-action="${action}" data-order-id="${escapeHtml(order.id)}" ${disabled?'disabled':''}>${title}</button>`;
}
function details(order) {
  const canManage = order.status === 'processing';
  const locked = order.cancelStatus === 'pending';
  const paymentDone = order.paymentStatus === 'paid';
  const shippingDone = order.shipmentStatus === 'shipped';
  const items = order.items.map(item => `<div class="d-flex justify-content-between gap-2 py-2 border-bottom"><div><div class="fw-semibold">${escapeHtml(item.name)}</div><div class="text-muted small">${money(item.unitPrice)} × ${Number(item.quantity)}</div></div><span class="fw-semibold">${money(item.unitPrice*item.quantity)}</span></div>`).join('');
  let buttons = '';
  if (canManage) {
    buttons += `<div class="d-flex flex-wrap gap-2 mt-3">`;
    buttons += `<button type="button" class="btn btn-sm btn-outline-secondary" disabled title="聊天室由其他組員開發">聯絡買家（開發中）</button>`;
    if (locked && order.requestedBy === 'buyer') {
      buttons += actionButton(order,'approve','同意取消','btn-outline-danger');
      buttons += actionButton(order,'reject','拒絕取消','btn-outline-secondary');
    } else if (locked) {
      buttons += `<span class="small text-muted align-self-center">已提出取消申請，等待買家回覆；暫停出貨。</span>`;
    } else {
      if (!paymentDone) buttons += actionButton(order,'payment','確認已收到款項');
      if (!shippingDone) buttons += actionButton(order,'ship',isMeet(order)?'確認已交付':'確認已寄出','btn-primary', !paymentDone && !isMeet(order));
      if (!shippingDone) buttons += actionButton(order,'request-cancel','申請取消訂單','btn-outline-danger');
    }
    buttons += `</div>`;
    if (!isMeet(order) && !paymentDone && !locked && !shippingDone) buttons += `<p class="small text-muted mt-2 mb-0">超商／郵寄需先確認收到匯款，才可標記出貨。</p>`;
    if (isMeet(order) && !paymentDone && shippingDone) buttons += `<p class="small text-muted mt-2 mb-0">面交請另外確認現金付款。</p>`;
  } else buttons = `<p class="text-muted small mt-3 mb-0">歷史訂單僅供查看。</p>`;
  return `<div class="purchase-order-detail border-top pt-3 mt-3" id="sales-detail-${escapeHtml(order.id)}">
    <h5 class="h6 fw-bold">商品明細</h5>${items}
    <h5 class="h6 fw-bold mt-4">買家與配送資料</h5>
    <dl class="purchase-order-facts">
      <dt>買家</dt><dd>${escapeHtml(order.buyerName)}</dd>
      <dt>運送方式</dt><dd>${escapeHtml(order.shippingMethod)}</dd>
      <dt>收件／面交資訊</dt><dd>${escapeHtml(order.destination)}</dd>
      ${order.recipient?`<dt>收件人</dt><dd>${escapeHtml(order.recipient)}</dd>`:''}
      ${order.phone?`<dt>聯絡電話</dt><dd>${escapeHtml(order.phone)}</dd>`:''}
      <dt>付款狀態</dt><dd>${paymentDone?'已付款（賣家確認）':'尚未付款'}</dd>
      <dt>${isMeet(order)?'交付狀態':'寄件狀態'}</dt><dd>${statusText(order)}</dd>
      ${order.trackingNumber?`<dt>寄件編號</dt><dd>${escapeHtml(order.trackingNumber)}</dd>`:''}
    </dl>
    ${canManage && !isMeet(order) && !shippingDone && !locked ? `<div class="mt-3"><label class="form-label small fw-semibold" for="tracking-${escapeHtml(order.id)}">寄件編號（確認出貨前必填）</label><input id="tracking-${escapeHtml(order.id)}" class="form-control form-control-sm" maxlength="80" data-tracking-id="${escapeHtml(order.id)}" placeholder="請輸入實際寄件編號" value="${escapeHtml(order.source==='checkout-preview'?(previewTrackingDrafts.get(order.id)||''):(order.draftTracking||''))}" /></div>`:''}
    <h5 class="h6 fw-bold mt-4">金額明細</h5>
    <div class="d-flex justify-content-between mb-1"><span>商品小計</span><span>${money(subtotal(order))}</span></div>
    <div class="d-flex justify-content-between mb-1"><span>運費</span><span>${money(order.shippingFee)}</span></div>
    <div class="d-flex justify-content-between border-top pt-2 fw-bold"><span>訂單總額</span><span>${money(subtotal(order)+order.shippingFee)}</span></div>
    ${locked?`<div class="alert alert-warning mt-3 mb-0">取消申請待回覆：${escapeHtml(order.cancelReason)}。處理前不可標記出貨。</div>`:''}
    ${order.status==='cancelled'?`<div class="alert alert-light border mt-3 mb-0">取消原因：${escapeHtml(order.cancelReason || '未提供')}</div>`:''}
    ${order.cancelStatus==='rejected'?`<div class="alert alert-light border mt-3 mb-0">之前的取消申請已被拒絕，訂單繼續處理。</div>`:''}
    ${buttons}</div>`;
}
function renderOrder(order) {
  const first = order.items[0];
  const isExpanded = expanded.has(order.id);
  const extra = order.items.length > 1 ? `，另有 ${order.items.length-1} 種商品` : '';
  return `<article class="card border purchase-order-card mb-3"><div class="card-body">
    <div class="d-flex justify-content-between align-items-start gap-2 flex-wrap">
      <div><div class="fw-bold">訂單 #${escapeHtml(order.id)}</div><div class="small text-muted mt-1">${escapeHtml(order.createdAt)} · 買家：${escapeHtml(order.buyerName)}</div></div>
      <div class="d-flex gap-1 flex-wrap"><span class="badge ${order.status==='processing'?'text-bg-warning':order.status==='completed'?'text-bg-success':'text-bg-danger'}">${labels[order.status]}</span>${order.cancelStatus==='pending'?'<span class="badge text-bg-light border">取消申請中</span>':''}</div>
    </div>
    <div class="mt-3">${escapeHtml(first.name)} × ${Number(first.quantity)}${extra}</div>
    <div class="d-flex justify-content-between gap-2 align-items-center mt-2 flex-wrap">
      <span class="small text-muted">${escapeHtml(order.shippingMethod)} · ${order.paymentStatus==='paid'?'已付款':'尚未付款'} · ${statusText(order)}</span>
      <strong>${money(subtotal(order)+order.shippingFee)}</strong>
    </div>
    <button type="button" class="btn btn-outline-secondary btn-sm w-100 mt-3" data-sales-toggle="${escapeHtml(order.id)}" aria-expanded="${isExpanded}" aria-controls="sales-detail-${escapeHtml(order.id)}">${isExpanded?'收合訂單詳情':'展開訂單詳情'} <i class="bi bi-chevron-${isExpanded?'up':'down'} ms-1"></i></button>
    ${isExpanded?details(order):''}
  </div></article>`;
}
function render() {
  const list = document.getElementById('sales-order-list');
  if (!list) return;
  const found = allOrders().filter(order => order.status === currentStatus);
  list.innerHTML = found.length ? found.map(renderOrder).join('') : `<div class="alert alert-light border">這個分類目前沒有訂單。</div>`;
  document.querySelectorAll('#sales-order-tabs [data-sales-status]').forEach(button => {
    const active = button.dataset.salesStatus === currentStatus;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}
function openConfirm(order, action) {
  let description = '';
  if (action==='payment') description = '請確認您已實際收到買家的款項，確定標記為「已付款」嗎？';
  else if (action==='ship') {
    if (order.cancelStatus==='pending') return notice('取消申請尚未處理，不可出貨。',true);
    if (!isMeet(order) && order.paymentStatus!=='paid') return notice('請先確認收到匯款。',true);
    if (!isMeet(order) && !(order.source==='checkout-preview'?(previewTrackingDrafts.get(order.id)||''):order.draftTracking)?.trim()) return notice('請先填寫寄件編號。',true);
    description = isMeet(order) ? '請確認已實際將商品交給買家。確認後無法透過一般流程取消。' : `請確認商品已寄出，寄件編號為「${order.source==='checkout-preview'?(previewTrackingDrafts.get(order.id)||''):order.draftTracking}」。確認後無法透過一般流程取消。`;
  } else if (action==='request-cancel') description='取消申請必須由買家同意才能成立，送出後將暫停出貨。請填寫取消原因。';
  else if (action==='approve') description='同意買家的取消申請？此預覽會將示例訂單改為已取消；正式版須由後端恢復庫存。';
  else if (action==='reject') description='拒絕買家的取消申請？訂單將恢復一般處理狀態。';
  pendingAction = {id:order.id, action};
  document.getElementById('salesActionModalTitle').textContent = `訂單 #${order.id} — 確認操作`;
  document.getElementById('sales-action-description').textContent = description;
  document.getElementById('sales-action-reason-wrapper').hidden = action !== 'request-cancel';
  document.getElementById('sales-action-reason').value = '';
  const button=document.getElementById('sales-action-confirm');
  button.className=`btn ${action==='approve'||action==='request-cancel'?'btn-danger':'btn-primary'}`;
  window.bootstrap.Modal.getOrCreateInstance(document.getElementById('salesActionModal')).show();
}
function completeAction(event) {
  event.preventDefault();
  if (!pendingAction) return;
  const order=findOrder(pendingAction.id);
  if (!order || order.status!=='processing') return;
  const action=pendingAction.action;
  if (order.source==='checkout-preview') {
    try {
      const options={};
      if (action==='ship') options.trackingNumber=previewTrackingDrafts.get(order.id)||'';
      if (action==='request-cancel') options.reason=document.getElementById('sales-action-reason').value.trim();
      applyPreviewAction(order.id,'seller',action,options);
    } catch(error) { notice(error.message,true); return; }
    window.bootstrap.Modal.getInstance(document.getElementById('salesActionModal')).hide();
    pendingAction=null;
    notice('已更新共用前端測試訂單；切換買家視角可看到相同狀態。');
    render();
    return;
  }
  if (action==='payment' && order.paymentStatus==='unpaid') order.paymentStatus='paid';
  else if (action==='ship' && order.shipmentStatus==='pending' && order.cancelStatus!=='pending') {
    if (!isMeet(order) && (order.paymentStatus!=='paid' || !order.draftTracking?.trim())) return notice('出貨條件未符合。',true);
    order.shipmentStatus='shipped';
    order.trackingNumber=isMeet(order)?'':order.draftTracking.trim();
  } else if (action==='request-cancel' && order.shipmentStatus==='pending' && order.cancelStatus!=='pending') {
    const reason=document.getElementById('sales-action-reason').value.trim();
    if (!reason) { document.getElementById('sales-action-reason').focus(); return notice('請輸入取消原因。',true); }
    order.cancelStatus='pending'; order.requestedBy='seller'; order.cancelReason=reason;
  } else if (action==='approve' && order.cancelStatus==='pending' && order.requestedBy==='buyer' && order.shipmentStatus==='pending') {
    order.status='cancelled'; order.cancelStatus='approved';
  } else if (action==='reject' && order.cancelStatus==='pending' && order.requestedBy==='buyer') {
    order.cancelStatus='rejected';
  } else return notice('目前訂單狀態不允許這個操作。',true);
  window.bootstrap.Modal.getInstance(document.getElementById('salesActionModal')).hide();
  pendingAction=null;
  notice('前端示範狀態已更新（重新整理會還原），沒有更新真實訂單。');
  render();
}
function init() {
  document.querySelectorAll('#sales-order-tabs [data-sales-status]').forEach(button=>button.addEventListener('click',()=>{
    currentStatus=button.dataset.salesStatus;
    notice(''); render();
  }));
  document.getElementById('sales-order-list')?.addEventListener('input',event=>{
    const input=event.target.closest('[data-tracking-id]');
    if (!input) return;
    const order=findOrder(input.dataset.trackingId);
    if (order?.source==='checkout-preview') previewTrackingDrafts.set(order.id,input.value);
    else if(order) order.draftTracking=input.value;
  });
  document.getElementById('sales-order-list')?.addEventListener('click',event=>{
    const toggle=event.target.closest('[data-sales-toggle]');
    if (toggle) {
      const id=toggle.dataset.salesToggle;
      if (expanded.has(id)) expanded.delete(id); else expanded.add(id);
      render(); return;
    }
    const button=event.target.closest('[data-sales-action]');
    if (!button) return;
    const order=findOrder(button.dataset.orderId);
    if (order) openConfirm(order,button.dataset.salesAction);
  });
  document.getElementById('sales-action-form')?.addEventListener('submit',completeAction);
  window.addEventListener(PREVIEW_EVENT,render);
  render();
}
window.addEventListener('DOMContentLoaded',init);

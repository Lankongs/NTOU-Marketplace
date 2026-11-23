import { getPreviewOrders, applyPreviewAction, hasRequestedCancellation, PREVIEW_EVENT } from './orderPreviewStore.js';
/**
 * 我的購買訂單 — 第一階段 UI 預覽
 * 僅提供固定的測試資料與頁籤／卡片展開互動；尚不建立、修改訂單。
 * 後端上線後，把 SAMPLE_ORDERS 換成 API 資料即可。
 */
const SAMPLE_ORDERS = [
  {
    id: 'DEMO-ORD001', status: 'processing', createdAt: '2026/11/16 15:30',
    sellerName: '測試賣家 A', paymentStatus: 'paid', shipmentStatus: 'shipped',
    shippingMethod: '7-ELEVEN 取貨', destination: '海大門市（範例）',
    trackingNumber: 'DEMO-123456', shippingFee: 60,
    items: [
      { name: '演算法參考書', unitPrice: 350, quantity: 1 },
      { name: '工程計算機', unitPrice: 500, quantity: 1 }
    ]
  },
  {
    id: 'DEMO-ORD002', status: 'processing', createdAt: '2026/11/16 17:10',
    sellerName: '測試賣家 B', paymentStatus: 'unpaid', shipmentStatus: 'pending',
    shippingMethod: '校內面交', destination: '海大圖書館一樓；2026/11/20 15:00',
    trackingNumber: '', shippingFee: 0,
    items: [{ name: '二手小說', unitPrice: 200, quantity: 1 }]
  },
  {
    id: 'DEMO-ORD003', status: 'completed', createdAt: '2026/11/14 12:00',
    sellerName: '測試賣家 C', paymentStatus: 'paid', shipmentStatus: 'shipped',
    shippingMethod: '郵寄包裹', destination: '測試收件地址（範例）',
    trackingNumber: 'DEMO-987654', shippingFee: 80,
    items: [{ name: '資料結構講義', unitPrice: 250, quantity: 1 }]
  },
  {
    id: 'DEMO-ORD004', status: 'cancelled', createdAt: '2026/11/12 10:20',
    sellerName: '測試賣家 D', paymentStatus: 'unpaid', shipmentStatus: 'pending',
    shippingMethod: '校內面交', destination: '尚未交付',
    trackingNumber: '', shippingFee: 0, cancelReason: '買賣雙方協議取消（範例）',
    items: [{ name: '二手英文課本', unitPrice: 160, quantity: 1 }]
  }
];

const statusLabels = { processing: '貨物處理中', completed: '已完成', cancelled: '已取消' };
/** 將動態文字進行 HTML 跳脫，避免被當成標籤。 */
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
));
/** 將金額格式化為新台幣。 */
const money = (value) => `NT$${Number(value).toLocaleString('zh-TW')}`;


const VIEW_ROLE = 'buyer';
/**
 * 取消申請詳情只顯示一個資訊框：申請方、目前處理結果和原因。
 * 同一筆訂單只允許一次申請，因此不需在畫面重複顯示歷史清單。
 * 使用跳脫過的文字，避免使用者填寫的原因變成 HTML。
 */
function renderCancelDetail(order) {
  const entry = Array.isArray(order.cancelHistory) ? order.cancelHistory[0] : null;
  const reason = order.cancelReason || entry?.reason;
  if (!reason) return '';
  const requester = order.requestedBy || entry?.requestedBy;
  const roleName = requester === 'seller' ? '賣家' : requester === 'buyer' ? '買家' : '雙方';
  let state = '取消原因';
  if (order.cancelStatus === 'pending') {
    state = requester === VIEW_ROLE ? '取消申請待對方回覆' : '取消申請待回覆';
  } else if (order.cancelStatus === 'rejected') {
    state = '取消申請已拒絕';
  } else if (order.cancelStatus === 'approved' || order.status === 'cancelled') {
    state = '取消申請已同意';
  }
  return `<div class="alert alert-light border mt-3 mb-0" role="status">${roleName}${state}：${escapeHtml(reason)}</div>`;
}

const opened = new Set(); // 每張訂單獨立記錄展開狀態，可以同時展開多張。
let currentStatus = 'processing';

/**
 * 依買家視角取得訂單摘要上的取消狀態標籤。
 * 對方申請時顯示「待你回覆」，自己申請時顯示「等待賣家回覆」。
 */
function purchaseCancelBadge(order) {
  if (order.status !== 'processing') return '';
  if (order.cancelStatus === 'pending') {
    const waitingMe = order.requestedBy === 'seller';
    const text = waitingMe ? '賣家取消申請待回覆' : '買家取消申請中';
    const style = waitingMe ? 'text-bg-danger' : 'text-bg-light border';
    return `<span class="badge ${style} ms-1">${text}</span>`;
  }
  if (order.cancelStatus === 'rejected') {
    return `<span class="badge text-bg-secondary ms-1">${order.requestedBy === 'seller' ? '賣家' : '買家'}取消申請已拒絕</span>`;
  }
  return '';
}

/** 計算單件商品乘上數量的小計。 */
function itemSubtotal(item) {
  return item.unitPrice * item.quantity;
}

/** 組裝買家訂單卡片與展開詳情。 */
function renderOrder(order) {
  const subtotal = order.items.reduce((sum, item) => sum + itemSubtotal(item), 0);
  const expanded = opened.has(order.id);
  const isMeet = order.shippingMethod === '校內面交';
  const shippingLabel = isMeet ? '交付狀態' : '寄件狀態';
  const shippedLabel = order.shipmentStatus === 'shipped'
    ? (isMeet ? '已交付' : '已寄出')
    : (isMeet ? '尚未交付' : '尚未寄出');
  const items = order.items.map((item) => `
    <div class="d-flex justify-content-between gap-2 py-2 border-bottom">
      <div><div class="fw-semibold">${escapeHtml(item.name)}</div>
      <div class="text-muted small">${money(item.unitPrice)} × ${item.quantity}</div></div>
      <div class="fw-semibold">${money(itemSubtotal(item))}</div>
    </div>`).join('');
  const detail = expanded ? `
    <div class="purchase-order-detail border-top pt-3 mt-3" id="detail-${order.id}">
      <h5 class="h6 fw-bold">商品明細</h5>
      ${items}
      <h5 class="h6 fw-bold mt-4">運送與付款資訊</h5>
      <dl class="purchase-order-facts">
        <dt>運送方式</dt><dd>${escapeHtml(order.shippingMethod)}</dd>
        <dt>配送／面交資料</dt><dd>${escapeHtml(order.destination)}</dd>
        <dt>付款狀態</dt><dd>${order.paymentStatus === 'paid' ? '已付款（賣家確認）' : '尚未付款'}</dd>
        <dt>${shippingLabel}</dt><dd>${shippedLabel}</dd>
        ${order.trackingNumber ? `<dt>寄件編號</dt><dd>${escapeHtml(order.trackingNumber)}</dd>` : ''}
      </dl>
      <h5 class="h6 fw-bold mt-4">金額明細</h5>
      <div class="d-flex justify-content-between mb-1"><span>商品小計</span><span>${money(subtotal)}</span></div>
      <div class="d-flex justify-content-between mb-2"><span>運費</span><span>${money(order.shippingFee)}</span></div>
      <div class="d-flex justify-content-between border-top pt-2 fw-bold"><span>應付總額</span><span>${money(subtotal + order.shippingFee)}</span></div>
      ${renderCancelDetail(order)}
      ${order.status === 'processing' ? `
        <div class="d-flex flex-wrap gap-2 mt-4">
          <button type="button" class="btn btn-outline-secondary btn-sm" disabled title="等待聊天室開發">聯絡賣家（開發中）</button>
          ${order.source === 'checkout-preview' ? `
            ${order.cancelStatus==='pending' && order.requestedBy==='seller' ? `
              <button type="button" class="btn btn-outline-danger btn-sm" data-purchase-action="approve" data-order-id="${escapeHtml(order.id)}">同意取消</button>
              <button type="button" class="btn btn-outline-secondary btn-sm" data-purchase-action="reject" data-order-id="${escapeHtml(order.id)}">拒絕取消</button>
            ` : order.cancelStatus==='pending' ? '' : `
              ${order.shipmentStatus==='pending' && !hasRequestedCancellation(order) ? `<button type="button" class="btn btn-outline-danger btn-sm" data-purchase-action="request-cancel" data-order-id="${escapeHtml(order.id)}">申請取消</button>` : ''}
              ${order.paymentStatus==='paid' && order.shipmentStatus==='shipped' ? `<button type="button" class="btn btn-primary btn-sm" data-purchase-action="complete" data-order-id="${escapeHtml(order.id)}">確認收貨並完成訂單</button>` : '<span class="small text-muted">完成訂單需等待賣家確認付款、寄件／交付。</span>'}
            `}
          ` : '<span class="small text-muted">舊版示範訂單不開放交易操作。</span>'}
        </div>
        <p class="text-muted small mt-2 mb-0">僅模擬本瀏覽器買家視角，尚無會員驗證；不會更動真正的庫存或交易。</p>
      ` : '<p class="text-muted small mt-3 mb-0">歷史訂單僅供查看，不提供修改。</p>'}
    </div>` : '';

  const first = order.items[0];
  const otherCount = order.items.length - 1;
  return `
    <article class="card border purchase-order-card mb-3">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-start gap-2 flex-wrap">
          <div>
            <div class="fw-bold">訂單 #${escapeHtml(order.id)} ${order.isSharedDemo ? '<span class="badge text-bg-light border ms-1">模擬範例</span>' : ''}</div>
            <div class="small text-muted mt-1">${escapeHtml(order.createdAt)} · 賣家：${escapeHtml(order.sellerName)}</div>
          </div>
          <div class="d-flex flex-wrap gap-1 align-items-center">
            <span class="badge ${order.status === 'processing' ? 'text-bg-warning' : order.status === 'completed' ? 'text-bg-success' : 'text-bg-danger'}">${statusLabels[order.status]}</span>
            ${purchaseCancelBadge(order)}
          </div>
        </div>
        <div class="mt-3">${escapeHtml(first.name)} × ${first.quantity}${otherCount ? `，另有 ${otherCount} 種商品` : ''}</div>
        <div class="d-flex justify-content-between gap-2 align-items-center mt-2 flex-wrap">
          <span class="small text-muted">${escapeHtml(order.shippingMethod)} · ${order.paymentStatus === 'paid' ? '已付款' : '尚未付款'} · ${shippedLabel}</span>
          <strong>${money(subtotal + order.shippingFee)}</strong>
        </div>
        <button type="button" class="btn btn-outline-secondary btn-sm w-100 mt-3" data-toggle-order="${escapeHtml(order.id)}"
          aria-expanded="${expanded}" aria-controls="detail-${escapeHtml(order.id)}">
          ${expanded ? '收合訂單詳情' : '展開訂單詳情'} <i class="bi bi-chevron-${expanded ? 'up' : 'down'} ms-1"></i>
        </button>
        ${detail}
      </div>
    </article>`;
}

/** 依照頁籤篩選訂單並重新顯示列表。 */
function render() {
  const list = document.getElementById('purchase-order-list');
  if (!list) return;
  const filtered = [...getPreviewOrders(), ...SAMPLE_ORDERS].filter((order) => order.status === currentStatus);
  list.innerHTML = filtered.length
    ? filtered.map(renderOrder).join('')
    : '<div class="alert alert-light border">這個分類目前沒有訂單。</div>';
  document.querySelectorAll('#purchase-order-tabs [data-order-status]').forEach((button) => {
    const active = button.dataset.orderStatus === currentStatus;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

/** 綁定買家訂單的頁籤、展開和操作事件。 */
function init() {
  document.querySelectorAll('#purchase-order-tabs [data-order-status]').forEach((button) => {
    button.addEventListener('click', () => {
      currentStatus = button.dataset.orderStatus;
      render();
    });
  });
  document.getElementById('purchase-order-list')?.addEventListener('click', (event) => {
    const actionButton = event.target.closest('[data-purchase-action]');
    if (actionButton) {
      const id=actionButton.dataset.orderId, action=actionButton.dataset.purchaseAction;
      const order=getPreviewOrders().find(o=>o.id===id);
      if (!order) return;
      try {
        let options={};
        if (action==='request-cancel') {
          const reason=prompt(`訂單 #${id}：請輸入取消原因（送出後須賣家同意）`);
          if (reason===null) return;
          if (!confirm('每張訂單只能提出一次取消申請；若對方拒絕，就不能再次申請。確定送出嗎？')) return;
          options.reason=reason.trim();
          if (!options.reason) { alert('取消原因不可空白'); return; }
        } else if (action==='complete') {
          if (!confirm('請先確認已實際收到商品，並且付款與出貨狀態均已完成。確定完成這張測試訂單？')) return;
          options.confirmReceived=true;
        } else if (!confirm(action==='approve'?'同意取消這筆測試訂單？':'拒絕取消申請，繼續處理訂單？')) return;
        applyPreviewAction(id,'buyer',action,options);
      } catch(error) { alert(error.message); }
      render();
      return;
    }
    const button = event.target.closest('[data-toggle-order]');
    if (!button) return;
    const id = button.dataset.toggleOrder;
    if (opened.has(id)) opened.delete(id);
    else opened.add(id);
    render();
  });
  window.addEventListener(PREVIEW_EVENT, render);
  render();
}

window.addEventListener('DOMContentLoaded', init);

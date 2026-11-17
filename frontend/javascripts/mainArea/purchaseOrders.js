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
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
));
const money = (value) => `NT$${Number(value).toLocaleString('zh-TW')}`;
const opened = new Set(); // 每張訂單獨立記錄展開狀態，可以同時展開多張。
let currentStatus = 'processing';

function itemSubtotal(item) {
  return item.unitPrice * item.quantity;
}

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
      ${order.cancelReason ? `<div class="alert alert-light border mt-3 mb-0">取消原因：${escapeHtml(order.cancelReason)}</div>` : ''}
      ${order.status === 'processing' ? `
        <div class="d-flex flex-wrap gap-2 mt-4">
          <button type="button" class="btn btn-outline-secondary btn-sm" disabled title="等待聊天室開發">聯絡賣家（開發中）</button>
          ${order.shipmentStatus === 'pending' ? `<button type="button" class="btn btn-outline-danger btn-sm" disabled title="等待訂單後端整合">申請取消（待串接）</button>` : ''}
          <button type="button" class="btn btn-primary btn-sm" disabled title="完成訂單需要真實買賣雙方狀態與後端驗證">完成訂單（待串接）</button>
        </div>
        <p class="text-muted small mt-2 mb-0">操作按鈕暫不會更動訂單；正式版會檢查已付款、已寄出／交付及買家確認收到商品。</p>
      ` : '<p class="text-muted small mt-3 mb-0">歷史訂單僅供查看，不提供修改。</p>'}
    </div>` : '';

  const first = order.items[0];
  const otherCount = order.items.length - 1;
  return `
    <article class="card border purchase-order-card mb-3">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-start gap-2 flex-wrap">
          <div>
            <div class="fw-bold">訂單 #${escapeHtml(order.id)}</div>
            <div class="small text-muted mt-1">${escapeHtml(order.createdAt)} · 賣家：${escapeHtml(order.sellerName)}</div>
          </div>
          <span class="badge ${order.status === 'processing' ? 'text-bg-warning' : order.status === 'completed' ? 'text-bg-success' : 'text-bg-danger'}">${statusLabels[order.status]}</span>
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

function render() {
  const list = document.getElementById('purchase-order-list');
  if (!list) return;
  const filtered = SAMPLE_ORDERS.filter((order) => order.status === currentStatus);
  list.innerHTML = filtered.length
    ? filtered.map(renderOrder).join('')
    : '<div class="alert alert-light border">這個分類目前沒有訂單。</div>';
  document.querySelectorAll('#purchase-order-tabs [data-order-status]').forEach((button) => {
    const active = button.dataset.orderStatus === currentStatus;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function init() {
  document.querySelectorAll('#purchase-order-tabs [data-order-status]').forEach((button) => {
    button.addEventListener('click', () => {
      currentStatus = button.dataset.orderStatus;
      render();
    });
  });
  document.getElementById('purchase-order-list')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-toggle-order]');
    if (!button) return;
    const id = button.dataset.toggleOrder;
    if (opened.has(id)) opened.delete(id);
    else opened.add(id);
    render();
  });
  render();
}

window.addEventListener('DOMContentLoaded', init);

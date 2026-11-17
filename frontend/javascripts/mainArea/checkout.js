import { createPreviewOrders } from './orderPreviewStore.js';
// 第二階段：前端結帳預覽。尚未接後端，絕不建立正式訂單。
// 預留購物車接入格式：sessionStorage.setItem('checkoutSelection', JSON.stringify({items:[...], sellerFees:{...}}))
// items: [{productId,sellerId,sellerName,name,price,quantity,image,shippingMethods:['meet','seven','family','post']}]
// sellerFees: { [sellerId]: {seven:60, family:60, post:80, meet:0} }
const METHODS = {meet:'校內面交',seven:'7-ELEVEN 取貨',family:'全家取貨',post:'郵寄'};
const STORE_MAPS = {seven:'https://emap.pcsc.com.tw/',family:'https://www.family.com.tw/Marketing/zh/Map'};
const demo = {
  items:[
    {productId:'demo-book',sellerId:'demo-a',sellerName:'海大同學 A',name:'演算法參考書',price:350,quantity:1,image:'',shippingMethods:['meet','seven','family','post']},
    {productId:'demo-calculator',sellerId:'demo-a',sellerName:'海大同學 A',name:'工程計算機',price:500,quantity:1,image:'',shippingMethods:['meet','seven','family']}
  ], sellerFees:{'demo-a':{meet:0,seven:60,family:60,post:80}}
};
// 兩位賣家的前端展示資料（?demo=multi），不需要正式會員或資料庫。
// 測試賣家 A 有兩件商品、賣家 B 有一件商品，驗證自動拆單和各自運費。
const multiSellerDemo = {
  items: [
    ...demo.items,
    {productId:'demo-mouse',sellerId:'demo-b',sellerName:'海大同學 B',name:'二手滑鼠',price:220,quantity:1,image:'',shippingMethods:['seven','family','post']}
  ],
  sellerFees: {
    ...demo.sellerFees,
    'demo-b': {meet:0,seven:65,family:65,post:70}
  }
};
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = v => `NT$${Number(v).toLocaleString('zh-TW')}`;
const notice = document.querySelector('#checkout-notice');
const sellerContainer = document.querySelector('#checkout-sellers');
const summary = document.querySelector('#checkout-summary-lines');
const submit = document.querySelector('#checkout-submit');
let isDemo = false;
let checkout = {items: [], sellerFees: {}};
const demoMode = new URLSearchParams(location.search).get('demo');
if (demoMode === '1' || demoMode === 'multi') {
  checkout = demoMode === 'multi' ? multiSellerDemo : demo;
  isDemo = true;
} else {
  try {
    const saved = sessionStorage.getItem('checkoutSelection');
    if (saved) checkout = JSON.parse(saved);
  } catch {
    checkout = {items: [], sellerFees: {}};
  }
}
// 資料來自瀏覽器，實際正式下單時必須由後端重新驗證價格、庫存、商品所有權及運費。
const groups = new Map();
for (const item of Array.isArray(checkout.items) ? checkout.items : []) {
  const quantity = Number(item.quantity), price = Number(item.price);
  if (!item.sellerId || !item.productId || !Number.isInteger(quantity) || quantity < 1 || !Number.isFinite(price) || price < 0) continue;
  if (!groups.has(item.sellerId)) groups.set(item.sellerId,{sellerId:item.sellerId,name:item.sellerName||'賣家',items:[],method:'',fees:checkout.sellerFees?.[item.sellerId] || {},common:[]});
  groups.get(item.sellerId).items.push({...item,quantity,price});
}
for (const group of groups.values()) {
  // 每件商品都必須提供配送方式，缺漏時不得假設全部都支援。
  const validLists = group.items.map(it => Array.isArray(it.shippingMethods) ? it.shippingMethods : []);
  group.common = Object.keys(METHODS).filter(m => validLists.every(list => list.includes(m)) && Number.isFinite(Number(group.fees[m])) && group.fees[m] !== '' && group.fees[m] != null && Number(group.fees[m]) >= 0);
  // 超商取貨先選配送類別，再選 7-ELEVEN／全家。
  group.category = group.common.includes('meet') ? 'meet' : group.common.includes('post') && !group.common.some(m=>m==='seven'||m==='family') ? 'post' : group.common.some(m=>m==='seven'||m==='family') ? 'store' : '';
  group.method = group.category==='store' ? '' : group.category;
}
const sellers = [...groups.values()];
// 切換配送選項時保留同一位賣家、同一種運送方式下曾填寫的表單內容。
const shippingDrafts = new Map();
/**
 * 結帳頁一般狀態不顯示測試說明，只在沒有待結帳商品時顯示提示。
 * 必填錯誤、建立訂單失敗等訊息仍會由對應事件顯示。
 */
notice.hidden = sellers.length > 0;
notice.className = 'alert alert-info';
notice.textContent = sellers.length === 0
  ? '目前沒有待結帳商品，請先回購物車勾選商品後再進入結帳。'
  : '';
document.querySelector('#checkout-back')?.addEventListener('click',()=>window.location.assign('cart.html'));

/** 根據運送方式產生對應的收件／面交欄位。 */
function shippingFields(method, id) {
  const field = (label, name, placeholder='', type='text') => `<div class="col-12 col-md-6"><label class="form-label" for="${id}-${name}">${label} <span class="text-danger">*</span></label><input class="form-control" required id="${id}-${name}" name="${name}" type="${type}" placeholder="${escapeHTML(placeholder)}"></div>`;
  if (method === 'meet') return `<p class="small text-muted">請先與賣家約好地點及時間。</p><div class="row g-3">${field('面交地點','meetingPlace','例如：海大圖書館一樓')}${field('面交時間','meetingTime','','datetime-local')}</div>`;
  if (method === 'seven' || method === 'family') return `<p class="small"><a target="_blank" rel="noopener noreferrer" href="${STORE_MAPS[method]}">開啟${METHODS[method]}官方門市地圖</a>（查詢後手動填寫）</p><div class="row g-3">${field('門市名稱','storeName')}${field('門市店號','storeCode')}${field('門市地址','storeAddress')}${field('收件人姓名','recipientName')}${field('聯絡電話','phone','','tel')}</div>`;
  if (method === 'post') return `<div class="row g-3">${field('收件人姓名','recipientName')}${field('聯絡電話','phone','','tel')}${field('郵遞區號','postalCode')}${field('完整收件地址','address')}</div>`;
  return '<div class="text-danger">此賣家商品沒有可共同使用且已設定運費的配送方式，請返回購物車分開結帳。</div>';
}
/** 產生單一賣家訂單卡片，包含商品、運送選項及收件表單。 */
function renderGroup(group, index) {
  const id = `seller-${index}`;
  const subtotal = group.items.reduce((sum,it)=>sum+it.price*it.quantity,0);
  const itemsHTML = group.items.map(it => `<div class="d-flex align-items-center gap-3 py-3 border-bottom"><div class="checkout-product-photo">${it.image?`<img alt="${escapeHTML(it.name)}" src="${escapeHTML(it.image)}">`:''}</div><div class="flex-grow-1"><div class="fw-semibold">${escapeHTML(it.name)}</div><div class="small text-muted">${money(it.price)} × ${it.quantity}</div></div><strong>${money(it.price*it.quantity)}</strong></div>`).join('');
  const hasStore = group.common.some(m => m==='seven'||m==='family');
  const categories = [
    ...(group.common.includes('meet') ? [{key:'meet',label:`校內面交（${money(group.fees.meet)}）`}] : []),
    ...(hasStore ? [{key:'store',label:'超商取貨'}] : []),
    ...(group.common.includes('post') ? [{key:'post',label:`郵寄（${money(group.fees.post)}）`}] : []),
  ];
  const methodsHTML = categories.map(entry=>`<label class="form-check form-check-inline mb-2"><input class="form-check-input" type="radio" name="${id}-category" value="${entry.key}" data-delivery-category ${group.category===entry.key?'checked':''}><span class="form-check-label">${entry.label}</span></label>`).join('');
  const brandsHTML = group.category === 'store' ? `<div class="checkout-store-choices rounded-3 p-3 mb-3"><div class="fw-semibold mb-2">請選擇取貨超商</div>${['seven','family'].filter(m=>group.common.includes(m)).map(m=>`<label class="form-check form-check-inline mb-2"><input class="form-check-input" type="radio" name="${id}-brand" value="${m}" data-store-brand ${group.method===m?'checked':''}><span class="form-check-label">${METHODS[m]}（${money(group.fees[m])}）</span></label>`).join('')}<p class="small text-muted mb-0">選擇品牌後，才會顯示對應門市資料。</p></div>` : '';
  const formContent = group.method ? shippingFields(group.method,id) : group.category === 'store' ? '<p class="text-muted mb-0">請先選擇 7-ELEVEN 或全家。</p>' : shippingFields('',id);
  const payment = group.method === 'meet' ? '面交現金' : group.method ? '銀行匯款（賣家下單後提供匯款資訊）' : '選擇運送方式後顯示';
  return `<article class="card shadow-sm border-0 mb-4 checkout-seller-group" data-seller-index="${index}"><div class="card-body p-4"><h2 class="h5 fw-bold">賣家：${escapeHTML(group.name)}</h2>${itemsHTML}<div class="d-flex justify-content-between my-3"><span>商品小計</span><strong>${money(subtotal)}</strong></div><h3 class="h6 fw-bold mt-4">運送方式</h3><p class="text-muted small">同一張訂單只選擇一種運送方式，運費只收一次。超商品牌在這裡選擇。</p><div class="mb-2">${methodsHTML||'<p class="text-danger">無共同配送方式，請返回購物車調整商品。</p>'}</div>${brandsHTML}<form class="checkout-seller-form" novalidate><div class="checkout-form-panel p-3 rounded-3 mb-3"><h3 class="h6 fw-bold mb-3">${group.method?METHODS[group.method]+'資訊':'配送資訊'}</h3>${formContent}</div></form><h3 class="h6 fw-bold">付款方式</h3><p>${payment}</p><button type="button" class="btn btn-outline-secondary btn-sm" disabled>聯絡賣家（聊天室開發中）</button></div></article>`;
}
/** 保存目前卡片內輸入的值，以免切換超商品牌或配送方式後消失。 */
function rememberShippingFields(article, group) {
  if (!article || !group.method) return;
  const values = {};
  article.querySelectorAll('form.checkout-seller-form [name]').forEach(input => {
    values[input.name] = input.value;
  });
  shippingDrafts.set(JSON.stringify([group.sellerId, group.method]), values);
}

/** 重新生成配送卡片後，還原該運送方式先前填過的資料。 */
function restoreShippingFields(article, group) {
  if (!article || !group.method) return;
  const values = shippingDrafts.get(JSON.stringify([group.sellerId, group.method])) || {};
  article.querySelectorAll('form.checkout-seller-form [name]').forEach(input => {
    if (Object.hasOwn(values, input.name)) input.value = values[input.name];
  });
}

/** 渲染全部賣家卡片，並監聽配送方式／超商品牌的變更。 */
function renderSellers() {
  sellerContainer.innerHTML = sellers.length ? sellers.map(renderGroup).join('') : '<div class="alert alert-warning">沒有可結帳的商品，請返回購物車重新選取。</div>';
  // 使用事件委派，只更新目前賣家的卡片，不影響其他賣家已填寫的資料。
  sellerContainer.addEventListener('change',event=>{
    const input=event.target;
    if(!input.matches('[data-delivery-category], [data-store-brand]')) return;
    const article=input.closest('[data-seller-index]');
    if(!article) return;
    const index=Number(article.dataset.sellerIndex);
    const group=sellers[index];
    rememberShippingFields(article, group);
    if (input.matches('[data-delivery-category]')) {
      group.category=input.value;
      group.method=input.value==='store'?'':input.value;
    } else if (input.matches('[data-store-brand]')) {
      group.category='store';
      group.method=input.value;
    }
    article.outerHTML=renderGroup(group,index);
    restoreShippingFields(sellerContainer.querySelector(`[data-seller-index="${index}"]`), group);
    updateSummary();
  });
  updateSummary();
}
/** 計算各賣家商品小計與單次運費，並設定確認按鈕狀態。 */
function updateSummary() {
  const subtotal = sellers.reduce((sum,g)=>sum+g.items.reduce((s,it)=>s+it.price*it.quantity,0),0);
  const ready = sellers.length>0 && sellers.every(g=>g.common.length>0 && g.method && Number.isFinite(Number(g.fees[g.method])));
  const shipping = ready?sellers.reduce((sum,g)=>sum+Number(g.fees[g.method]),0):null;
  summary.innerHTML=sellers.map(g=>`<div class="d-flex justify-content-between gap-2 mb-2 checkout-summary-line"><span>${escapeHTML(g.name)}（${g.items.length} 種商品）</span><span>${g.method?`${METHODS[g.method]} ${money(g.fees[g.method])}`:g.category==='store'?'請選擇超商品牌':'未選配送'}</span></div>`).join('');
  document.querySelector('#checkout-subtotal').textContent=money(subtotal);
  document.querySelector('#checkout-shipping-fee').textContent=shipping==null?'尚未設定':money(shipping);
  document.querySelector('#checkout-total').textContent=shipping==null?'—':money(subtotal+shipping);
  submit.disabled=!ready;
}
// 送出前驗證各個配送必填欄位，再開啟二次確認視窗。
submit.addEventListener('click',()=>{
  let firstInvalid;
  for (const form of sellerContainer.querySelectorAll('form.checkout-seller-form')) {
    for (const input of form.querySelectorAll('input[required]')) {
      if (!input.value.trim() || !input.checkValidity()) {input.classList.add('is-invalid');firstInvalid??=input;}
      else input.classList.remove('is-invalid');
    }
  }
  if(firstInvalid){ firstInvalid.focus();notice.textContent='請先填妥所有賣家的必填配送資料。';notice.className='alert alert-warning';notice.hidden=false;return; }
  notice.hidden = true; // 驗證通過後隱藏先前的必填提醒。
  const total = document.querySelector('#checkout-total').textContent;
  document.querySelector('#checkout-confirm-details').innerHTML=`<p>本次將向 <strong>${sellers.length}</strong> 位賣家購買商品（本次前端測試將分別建立 ${sellers.length} 張訂單）。</p><ul>${sellers.map(g=>`<li>${escapeHTML(g.name)}：${METHODS[g.method]}，運費 ${money(g.fees[g.method])}</li>`).join('')}</ul><p class="fw-bold">應付總額：${total}</p>`;
  bootstrap.Modal.getOrCreateInstance(document.querySelector('#checkoutConfirmModal')).show();
});
// 確認後建立本瀏覽器的測試訂單，並同步前端購物車與商品庫存。
document.querySelector('#checkout-preview-confirm').addEventListener('click',()=>{
  // 將每位賣家的配送表單資料保存成一張測試訂單，正式版須改由後端驗證與建立。
  const drafts=sellers.map((group,index)=>{
    const fields={};
    const form=sellerContainer.querySelector(`[data-seller-index="${index}"] form.checkout-seller-form`);
    for(const input of form.querySelectorAll('[name]')) fields[input.name]=input.value.trim();
    let destination='';
    if(group.method==='meet') destination=`${fields.meetingPlace}；${fields.meetingTime.replace('T',' ')}`;
    else if(group.method==='seven'||group.method==='family') destination=`${fields.storeName}（店號 ${fields.storeCode}），${fields.storeAddress}`;
    else destination=`${fields.postalCode} ${fields.address}`;
    return {
      sellerId:group.sellerId, sellerName:group.name, items:group.items,
      shippingCode:group.method, shippingMethod:METHODS[group.method], shippingFee:Number(group.fees[group.method]),
      destination, recipient:fields.recipientName||'', phone:fields.phone||'', shippingInfo:fields
    };
  });
  const button=document.querySelector('#checkout-preview-confirm');
  button.disabled=true;
  try {
    const created=createPreviewOrders(drafts, {updateCart: !isDemo});
    sessionStorage.removeItem('checkoutSelection'); // 避免重新整理後重複送出同一份結帳草稿
    bootstrap.Modal.getOrCreateInstance(document.querySelector('#checkoutConfirmModal')).hide();
    notice.textContent=`已建立 ${created.length} 筆前端測試訂單；${isDemo?'範例模式不修改購物車': '已扣除測試庫存並移除已下單購物車商品'}。不會通知其他會員。`;
    notice.className='alert alert-success'; notice.hidden=false;
    submit.disabled=true;
    // 透過 query string 開啟個人頁面的「我的購買訂單」。
    window.location.assign('./selfPage.html?view=purchase');
  } catch(error) {
    button.disabled=false;
    notice.textContent=`無法儲存測試訂單：${error.message}`;
    notice.className='alert alert-danger';notice.hidden=false;
    bootstrap.Modal.getOrCreateInstance(document.querySelector('#checkoutConfirmModal')).hide();
    window.scrollTo({top:0,behavior:'smooth'});
  }
});

renderSellers();

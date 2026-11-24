import { getNotifications } from './notificationApi.js';

let currentMenu = null;
const STYLE_ID = 'ntou-notification-styles';

// 通知頁更新列表後，同步選單與紅點，不另外送出請求
export function syncNotificationMenu(notifications) {
  currentMenu?.update(notifications);
}

// 共用導覽列與靜態導覽列都使用現有的通知按鈕
export function initNotificationMenu() {
  const button = document.getElementById('notify-button');
  // 同一按鈕不重複綁定；導覽列重建時先清理舊選單
  if (currentMenu?.button === button) return;
  currentMenu?.destroy();
  currentMenu = null;
  if (!button) return;

  loadStyles();
  const events = new AbortController();
  const options = { signal: events.signal };
  const badge = element('span', 'ntou-notification-dot');
  badge.hidden = true;
  badge.setAttribute('aria-hidden', 'true');
  button.classList.add('ntou-notification-button');
  button.append(badge);
  button.setAttribute('aria-label', '通知');
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', 'ntou-notification-menu');
  button.title = '通知';

  const panel = element('section', 'ntou-notification-menu');
  panel.id = 'ntou-notification-menu';
  panel.hidden = true;
  panel.setAttribute('aria-label', '最近通知');
  const heading = element('div', 'ntou-notification-menu-heading');
  heading.append(element('h2', 'ntou-notification-menu-title', '通知'));
  const closeButton = element('button', 'ntou-notification-close btn btn-sm btn-outline-secondary', '關閉');
  closeButton.type = 'button';
  heading.append(closeButton);
  const body = element('div', 'ntou-notification-menu-body');
  body.setAttribute('aria-live', 'polite');
  const footer = element('a', 'ntou-notification-menu-footer', '查看全部通知');
  footer.href = './notifications.html';
  panel.append(heading, body, footer);
  // 放在 body 避免手機版導覽列收合區域裁切選單
  document.body.append(panel);

  let pending = null;
  let disposed = false;
  let revision = 0;

  function close(restoreFocus = false) {
    panel.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    if (restoreFocus) button.focus();
  }

  function position() {
    if (panel.hidden) return;
    const rect = button.getBoundingClientRect();
    const width = Math.min(380, Math.max(0, window.innerWidth - 24));
    panel.style.width = `${width}px`;
    panel.style.left = `${Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12))}px`;
    const top = Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - 180));
    panel.style.top = `${top}px`;
    panel.style.maxHeight = `${Math.max(0, window.innerHeight - top - 12)}px`;
  }

  function showMessage(message, actionText, action) {
    const state = element('div', 'ntou-notification-state');
    state.append(element('p', '', message));
    if (actionText) {
      const control = element('button', 'btn btn-sm btn-outline-primary', actionText);
      control.type = 'button';
      control.addEventListener('click', action, options);
      state.append(control);
    }
    body.replaceChildren(state);
  }

  function render(notifications) {
    // 未讀可能在第六筆以後，紅點不能只檢查選單顯示的五筆
    const unread = notifications.some(notification => notification.readAt == null);
    badge.hidden = !unread;
    button.setAttribute('aria-label', unread ? '通知，有未讀通知' : '通知，沒有未讀通知');
    if (!notifications.length) {
      showMessage('目前沒有通知');
      return;
    }
    const list = element('ul', 'ntou-notification-list');
    // 只截取顯示數量，不改變後端回傳的排序
    for (const notification of notifications.slice(0, 5)) {
      const item = element('li', 'ntou-notification-item');
      if (notification.readAt == null) item.classList.add('ntou-notification-item-unread');
      const details = element('div', 'ntou-notification-menu-item-content');
      const title = element('div', 'ntou-notification-item-title');
      title.append(element('span', '', notification.title || '通知'));
      const time = element('time', 'ntou-notification-time');
      const date = new Date(notification.createdAt);
      if (notification.createdAt && !Number.isNaN(date.getTime())) {
        time.dateTime = date.toISOString();
        time.textContent = date.toLocaleString('zh-TW', { hour12: false });
      } else {
        time.textContent = '時間未提供';
      }
      details.append(title, element('p', 'ntou-notification-content', notification.content || ''), time);
      item.append(details);
      if (notification.readAt == null) {
        const dot = element('span', 'ntou-notification-item-dot');
        dot.setAttribute('role', 'img');
        dot.setAttribute('aria-label', '未讀通知');
        item.append(dot);
      }
      list.append(item);
    }
    body.replaceChildren(list);
  }

  async function refresh() {
    // 載入未完成時共用同一請求，避免連續開關選單重複查詢
    if (pending) return pending;
    badge.hidden = true;
    button.setAttribute('aria-label', '通知');
    showMessage('通知載入中…');
    body.setAttribute('aria-busy', 'true');
    // 記住請求版本，頁面同步已讀後便不採用較舊的回應
    const requestRevision = revision;
    pending = (async () => {
      try {
        const notifications = await getNotifications();
        if (!disposed && button.isConnected && requestRevision === revision) render(notifications);
      } catch (error) {
        if (disposed || !button.isConnected || requestRevision !== revision) return;
        if (error.status === 401) {
          showMessage('請先登入以查看通知', '前往登入', () => location.assign('./login.html'));
        } else {
          showMessage('通知載入失敗，請稍後再試', '重新載入', () => refresh());
        }
      } finally {
        body.removeAttribute('aria-busy');
        pending = null;
      }
    })();
    return pending;
  }

  button.addEventListener('click', () => {
    if (!panel.hidden) {
      close();
      return;
    }
    panel.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    position();
    refresh();
  }, options);
  closeButton.addEventListener('click', () => close(true), options);
  document.addEventListener('click', event => {
    if (!panel.contains(event.target) && !button.contains(event.target)) close();
  }, options);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) {
      event.preventDefault();
      close(true);
    }
  }, options);
  window.addEventListener('resize', position, options);
  window.addEventListener('scroll', position, { ...options, capture: true });
  window.addEventListener('pageshow', event => {
    if (event.persisted) {
      close();
      refresh();
    }
  }, options);

  currentMenu = {
    button,
    update(notifications) {
      // 忽略較早送出的請求，避免覆蓋頁面更新後的狀態
      revision++;
      body.removeAttribute('aria-busy');
      if (Array.isArray(notifications)) {
        render(notifications);
      } else {
        badge.hidden = true;
        button.setAttribute('aria-label', '通知');
        if (notifications === null) {
          showMessage('請先登入以查看通知', '前往登入', () => location.assign('./login.html'));
        } else {
          showMessage('通知載入失敗，請稍後再試', '重新載入', () => refresh());
        }
      }
    },
    destroy() {
      disposed = true;
      // 一次解除本選單的事件，避免舊按鈕與全域監聽器殘留
      events.abort();
      panel.remove();
      badge.remove();
    }
  };
  // 初次載入取得完整列表，讓鈴鐺不用先開啟就能顯示紅點
  refresh();
}

function loadStyles() {
  const href = new URL('../../notifications.css', import.meta.url).href;
  if (document.getElementById(STYLE_ID)
      || [...document.querySelectorAll('link[rel="stylesheet"]')].some(link => link.href === href)) return;
  const link = document.createElement('link');
  link.id = STYLE_ID;
  link.rel = 'stylesheet';
  link.href = href;
  document.head.append(link);
}

// 通知內容只填入文字，不將後端字串當成 HTML
function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

import { getNotifications, markNotificationRead, markAllNotificationsRead } from './notificationApi.js';
import { syncNotificationMenu } from './notificationMenu.js';

// 完整通知頁沿用既有 API，不在開啟頁面時自動標記已讀
function initNotificationPage() {
  const list = document.getElementById('notification-page-list');
  if (!list || list.dataset.initialized) return;
  list.dataset.initialized = 'true';
  const readAll = document.getElementById('notification-read-all');
  const summary = document.getElementById('notification-summary');
  const status = document.getElementById('notification-page-status');
  const statusText = document.getElementById('notification-status-text');
  const retry = document.getElementById('notification-retry');
  const login = document.getElementById('notification-login');
  const notice = document.getElementById('notification-notice');
  let notifications = [];
  let available = false;
  let busy = false;
  let noticeTimer = null;
  let pageVisible = true;
  // 以通知 ID 保存節點，標記已讀時只更新對應項目
  const notificationNodes = new Map();

  function updateButtons() {
    readAll.disabled = busy || !available || !notifications.some(item => item.readAt == null);
    retry.disabled = busy;
    list.querySelectorAll('button').forEach(button => { button.disabled = busy || !available; });
    list.setAttribute('aria-busy', String(busy));
  }

  function showStatus(message, { canRetry = false, needsLogin = false } = {}) {
    status.hidden = false;
    statusText.textContent = message;
    retry.hidden = !canRetry;
    login.hidden = !needsLogin;
  }

  function clearNoticeTimer() {
    if (noticeTimer !== null) clearTimeout(noticeTimer);
    noticeTimer = null;
  }

  function showNotice(message, isError = false, autoHide = false) {
    // 新操作先取消舊計時器，避免關閉後來顯示的錯誤提示
    clearNoticeTimer();
    if (!pageVisible) return;
    notice.textContent = message;
    notice.hidden = !message;
    notice.classList.toggle('ntou-notifications-notice-error', isError);
    notice.classList.toggle('ntou-notifications-notice-floating', Boolean(message && autoHide && !isError));
    if (message && autoHide) {
      noticeTimer = setTimeout(() => {
        noticeTimer = null;
        notice.hidden = true;
        notice.textContent = '';
      }, 2500);
    }
  }

  function updateSummary() {
    const unread = notifications.filter(item => item.readAt == null).length;
    summary.textContent = `共 ${notifications.length} 筆通知，${unread} 筆未讀`;
  }

  function render() {
    list.replaceChildren();
    notificationNodes.clear();
    updateSummary();
    status.hidden = notifications.length > 0;
    if (!notifications.length) showStatus('目前沒有通知');

    // 保留後端順序，通知文字只使用 textContent
    for (const notification of notifications) {
      const unread = notification.readAt == null;
      const item = element('li', 'ntou-notification-item ntou-notifications-row');
      if (unread) item.classList.add('ntou-notification-item-unread');
      const details = element('div', 'ntou-notifications-details');
      const heading = element('div', 'ntou-notification-item-title');
      heading.append(element('h2', 'ntou-notifications-item-title', notification.title || '通知'));
      const label = element('span', unread ? 'ntou-notification-unread-label' : 'ntou-notifications-read-label',
        unread ? '未讀' : '已讀');
      heading.append(label);
      const time = element('time', 'ntou-notification-time');
      const date = new Date(notification.createdAt);
      if (notification.createdAt && !Number.isNaN(date.getTime())) {
        time.dateTime = date.toISOString();
        time.textContent = date.toLocaleString('zh-TW', { hour12: false });
      } else {
        time.textContent = '時間未提供';
      }
      details.append(heading, element('p', 'ntou-notification-content', notification.content || ''), time);
      item.append(details);
      if (unread) {
        const button = element('button', 'btn btn-sm btn-outline-primary ntou-notifications-read-button', '標記已讀');
        button.type = 'button';
        button.addEventListener('click', () => changeReadState(notification.id));
        item.append(button);
      }
      list.append(item);
      notificationNodes.set(notification.id, { item, label });
    }
    updateButtons();
  }

  // 初次載入或手動重試才查詢列表，失敗時保留原本內容
  async function load() {
    available = false;
    if (!notifications.length) summary.textContent = '查看你的最新通知與已讀狀態';
    showStatus('通知載入中…');
    updateButtons();
    try {
      notifications = await getNotifications();
      available = true;
      render();
      syncNotificationMenu(notifications);
      return true;
    } catch (error) {
      if (error.status === 401) {
        showNotice('');
        showStatus('尚未登入或登入已過期，請重新登入以查看通知', { needsLogin: true });
        syncNotificationMenu(null);
      } else {
        showStatus('通知載入失敗，請稍後重試', { canRetry: true });
        syncNotificationMenu(undefined);
      }
      return false;
    }
  }

  async function reload() {
    if (busy) return;
    busy = true;
    showNotice('');
    try {
      await load();
    } finally {
      busy = false;
      updateButtons();
    }
  }

  // 204 不含時間，暫用本機時間表示已讀；下次 GET 會取得伺服器時間
  function updateReadState(id, all) {
    const readAt = new Date().toISOString();
    for (const notification of notifications) {
      if (notification.readAt != null || (!all && notification.id !== id)) continue;
      notification.readAt = readAt;
      const nodes = notificationNodes.get(notification.id);
      if (!nodes) continue;
      nodes.item.classList.remove('ntou-notification-item-unread');
      nodes.label.className = 'ntou-notifications-read-label';
      nodes.label.textContent = '已讀';
      nodes.item.querySelector('button')?.remove();
    }
    updateSummary();
    // 共用更新後的資料，讓列表統計與鈴鐺紅點保持一致
    syncNotificationMenu(notifications);
  }

  // 成功後只更新已讀項目，保留列表節點以避免閃爍
  async function changeReadState(id, all = false) {
    if (busy || !available) return;
    busy = true;
    showNotice('');
    updateButtons();
    try {
      if (all) await markAllNotificationsRead();
      else await markNotificationRead(id);
      // 確認伺服器成功後才改畫面，失敗時不必還原已讀狀態
      updateReadState(id, all);
      status.hidden = true;
      if (all) showNotice('已將全部通知標記為已讀', false, true);
    } catch (error) {
      // 操作失敗保留原本內容，登入過期時另外停用已讀操作
      if (error.status === 401) {
        available = false;
        showStatus('登入已過期，請重新登入', { needsLogin: true });
        syncNotificationMenu(null);
      } else if (error.status === 404) {
        showNotice('這筆通知已不存在或無法存取，請重新載入確認', true);
        showStatus('可重新載入以確認最新狀態', { canRetry: true });
      } else if (error.status === 403) {
        showNotice('CSRF 驗證仍未通過，請重新整理後再試', true);
      } else {
        showNotice('已讀操作未完成，請稍後重試；若狀態不確定，可重新載入確認', true);
        retry.hidden = false;
        status.hidden = false;
        statusText.textContent = '可重新載入以確認最新狀態';
      }
    } finally {
      busy = false;
      updateButtons();
    }
  }

  readAll.addEventListener('click', () => changeReadState(null, true));
  retry.addEventListener('click', reload);
  window.addEventListener('pagehide', () => {
    // 離開時清除提示與計時器，避免尚未完成的請求再次顯示提示
    showNotice('');
    pageVisible = false;
  });
  window.addEventListener('pageshow', event => {
    pageVisible = true;
    if (event.persisted) reload();
  });
  reload();
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNotificationPage, { once: true });
} else {
  initNotificationPage();
}

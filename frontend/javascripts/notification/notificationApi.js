const NOTIFICATION_PATH = '/api/notifications';

// 使用同來源 Session，204 不解析回應本文
async function request(path, options = {}) {
  const response = await fetch(path, { ...options, credentials: 'same-origin', cache: 'no-store' });
  // 已讀 API 成功時沒有本文，直接解析 JSON 會誤判為失敗
  if (response.status === 204) return null;

  let result = null;
  try {
    result = await response.json();
  } catch {
    // 非 JSON 錯誤仍保留狀態碼，讓畫面判斷登入或連線問題
  }
  if (!response.ok) {
    const error = new Error(typeof result?.message === 'string'
      ? result.message : `通知操作失敗：HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return result;
}

// 保留後端排序，紅點需根據完整列表判斷
export async function getNotifications() {
  const notifications = await request(NOTIFICATION_PATH);
  if (!Array.isArray(notifications)) throw new Error('通知回應格式錯誤');
  return notifications;
}

// 每次 PATCH 先取得 CSRF，403 最多重新取得並重試一次
async function patch(path) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const csrf = await request('/api/auth/csrf');
    if (typeof csrf?.headerName !== 'string' || typeof csrf?.token !== 'string') {
      throw new Error('無法取得 CSRF 驗證資料');
    }
    try {
      return await request(path, {
        method: 'PATCH',
        headers: { [csrf.headerName]: csrf.token }
      });
    } catch (error) {
      // Token 可能已失效，只針對 403 更新後重試，避免無限請求
      if (error.status !== 403 || attempt === 1) throw error;
    }
  }
}

export function markNotificationRead(id) {
  if (typeof id !== 'string' || !id.trim()) throw new Error('缺少通知 ID');
  return patch(`${NOTIFICATION_PATH}/${encodeURIComponent(id)}/read`);
}

export function markAllNotificationsRead() {
  return patch(`${NOTIFICATION_PATH}/read-all`);
}

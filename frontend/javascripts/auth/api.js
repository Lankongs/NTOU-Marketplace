export async function api(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', ...options });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.message || '操作失敗，請稍後再試。');
    error.status = response.status;
    throw error;
  }
  return result;
}

// CSRF token 綁定 Session；登入會更換 Session，因此每次 POST 重新取得。
export async function post(path, body) {
  const csrf = await api('/api/auth/csrf');
  return api(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
}

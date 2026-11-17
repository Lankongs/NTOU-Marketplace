import { api, post } from './api.js';
const form = document.querySelector('#loginForm');
const account = document.querySelector('#account');
const password = document.querySelector('#password');
const submit = document.querySelector('#submit');
const error = document.querySelector('#error');
const registerSuccess = document.querySelector('#registerSuccess');
try {
  if (sessionStorage.getItem('ntou_registration_success') === '1') {
    sessionStorage.removeItem('ntou_registration_success');
    registerSuccess.hidden = false;
  }
} catch {
  // The login page still works if the browser blocks session storage.
}
window.addEventListener('pageshow', event => {
  if (event.persisted) registerSuccess.hidden = true;
});
api('/api/auth/me').then(() => location.replace('/home')).catch(() => {});
document.querySelector('#togglePassword').addEventListener('click', event => {
  const visible = password.type === 'password';
  password.type = visible ? 'text' : 'password';
  event.currentTarget.textContent = visible ? '隱藏密碼' : '顯示密碼';
  event.currentTarget.setAttribute('aria-pressed', String(visible));
});
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (submit.disabled) return;
  error.hidden = true; submit.disabled = true; submit.textContent = '登入中…';
  try {
    await post('/api/auth/login', { account: account.value, password: password.value });
    password.value = ''; location.assign('/home');
  } catch (failure) {
    error.textContent = failure instanceof TypeError ? '無法連線，請確認 Spring Boot 仍在執行。' : failure.message;
    error.hidden = false; submit.disabled = false; submit.textContent = '登入 →';
  }
});

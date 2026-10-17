import { api, post } from './api.js';
const button = document.querySelector('#user-button');
const label = document.querySelector('#member-label');
const logout = document.querySelector('#logout-button');
const message = document.querySelector('#auth-message');
let loggedIn = false;
async function refreshMember() {
  try {
    const { user } = await api('/api/auth/me');
    loggedIn = true; label.textContent = `${user.displayName}（${user.account}）`;
    button.setAttribute('aria-label', `已登入：${user.displayName}`);
    logout.hidden = false; message.hidden = true;
  } catch (error) {
    loggedIn = false; label.textContent = '登入'; logout.hidden = true;
    button.setAttribute('aria-label', '會員登入');
    if (error.status !== 401) { message.textContent = '無法取得登入狀態，請確認後端連線。'; message.hidden = false; }
  }
}
button.addEventListener('click', () => { if (!loggedIn) location.assign('/login.html'); });
logout.addEventListener('click', async () => {
  logout.disabled = true;
  try { await post('/api/auth/logout'); location.replace('/login.html'); }
  catch (error) { message.textContent = error.message; message.hidden = false; logout.disabled = false; }
});
window.addEventListener('pageshow', refreshMember);

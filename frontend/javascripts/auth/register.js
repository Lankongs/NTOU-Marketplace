import { post } from './api.js';

const form = document.querySelector('#registerForm');
const password = document.querySelector('#password');
const confirmation = document.querySelector('#confirmPassword');
const submit = document.querySelector('#submit');
const error = document.querySelector('#error');

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (submit.disabled) return;
  error.hidden = true;

  if (password.value !== confirmation.value) {
    error.textContent = '兩次輸入的密碼不一致。';
    error.hidden = false;
    confirmation.focus();
    return;
  }

  submit.disabled = true;
  submit.textContent = '註冊中…';
  try {
    await post('/api/auth/register', {
      account: form.elements.account.value.trim(),
      displayName: form.elements.displayName.value.trim(),
      password: password.value,
      email: form.elements.email.value.trim()
    });
    form.reset();
    try {
      sessionStorage.setItem('ntou_registration_success', '1');
    } catch {
      // Account creation already succeeded, so continue to login.
    }
    location.replace('/login.html');
  } catch (failure) {
    error.textContent = '註冊服務暫時無法使用，請稍後再試。';
    if (failure.status >= 400 && failure.status < 500) {
      error.textContent = failure.message;
    }
    error.hidden = false;
    submit.disabled = false;
    submit.textContent = '註冊';
  }
});

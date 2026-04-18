import { api } from './api.js';

export async function login({ googleIdToken, password }) {
  return api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ googleIdToken, password }),
  });
}

export async function logout() {
  return api('/auth/logout', { method: 'POST' });
}

export async function me() {
  return api('/api/me');
}

export async function forgot(email) {
  return api('/auth/forgot', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function reset(token, newPassword) {
  return api('/auth/reset', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  });
}

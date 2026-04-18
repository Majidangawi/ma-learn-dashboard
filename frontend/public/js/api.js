const API_BASE = window.__MA_DASHBOARD_API__ ?? 'https://api-staging.malearnsa.com';

export async function api(path, opts = {}) {
  const res = await fetch(API_BASE + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `http_${res.status}`);
  }
  return res.json();
}

export { API_BASE };

const API_BASE = (() => {
  if (typeof window !== 'undefined' && window.__MA_DASHBOARD_API__) return window.__MA_DASHBOARD_API__;
  const h = (typeof location !== 'undefined' && location.host) || '';
  if (h === 'admin.malearnsa.com') return 'https://api.malearnsa.com';
  if (h === 'link.malearnsa.com') return 'https://api.malearnsa.com';
  return 'https://api-staging.malearnsa.com';
})();

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

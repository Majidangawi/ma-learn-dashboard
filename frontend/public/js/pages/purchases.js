// purchases.js — Pending Bank Transfers admin module
// Lists rows from the Waitlist sheet where source = 'bank-transfer-pending',
// lets Majid Confirm or Reject (with reason). Calls the v8 Apps Script
// directly (admin token guards the endpoints).

import { icon } from '../ui/icons.js';

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby2tDtm76JhBU-cwT6wnFVTp5ysYxsf73ZKGxoY-ZadbswSXRK_CkjpgkDbds4cJCO0/exec';
const ADMIN_TOKEN = 'MAL-ADMIN-2026';

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function relativeTime(iso) {
  if (!iso) return '—';
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '—';
  const diffMs = Date.now() - then.getTime();
  const min = 60 * 1000;
  const hr = 60 * min;
  const day = 24 * hr;
  if (diffMs < min) return 'just now';
  if (diffMs < hr) return Math.floor(diffMs / min) + ' min ago';
  if (diffMs < day) return Math.floor(diffMs / hr) + ' hr ago';
  return Math.floor(diffMs / day) + ' days ago';
}

function fmtAbsolute(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
}

// Apps Script via POST + 'no-cors' won't return readable JSON.
// For reads we need real responses, so we use GET with query params.
async function adminCall(action, extra = {}) {
  const params = new URLSearchParams({
    action,
    admin_token: ADMIN_TOKEN,
    ...extra,
  });
  const res = await fetch(APPS_SCRIPT_URL + '?' + params.toString(), {
    method: 'GET',
    redirect: 'follow',
  });
  if (!res.ok) throw new Error('http_' + res.status);
  return res.json();
}

function toast(msg, tone = 'default') {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = `
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
    background: ${tone === 'danger' ? '#3a1212' : tone === 'success' ? '#1a3a1a' : '#1a1a1a'};
    color: ${tone === 'danger' ? '#ff8a8a' : tone === 'success' ? '#8aff8a' : '#f5f0e8'};
    padding: 12px 20px; border-radius: 6px; z-index: 9999;
    font-size: 14px; box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    animation: toast-in 200ms ease-out;
  `;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

export default async function mount(root) {
  root.innerHTML = `
    <style>
      .purchases-page {
        padding: var(--s-6);
        max-width: 880px;
        margin: 0 auto;
      }
      .purchases-head {
        display: flex; align-items: baseline; justify-content: space-between;
        margin-bottom: var(--s-5);
      }
      .purchases-head h1 {
        font-size: var(--fs-h2);
        font-weight: 600;
        margin: 0;
        color: var(--c-fg);
      }
      .purchases-head .count {
        font-size: var(--fs-body-sm);
        color: var(--c-fg-3);
        margin-inline-start: var(--s-3);
      }
      .purchases-empty {
        text-align: center;
        padding: var(--s-8) var(--s-4);
        color: var(--c-fg-3);
        background: var(--c-ink-1);
        border: 1px dashed var(--c-ink-4);
        border-radius: var(--r-md);
      }
      .purchases-card {
        background: var(--c-ink-1);
        border: 1px solid var(--c-ink-4);
        border-radius: var(--r-md);
        padding: var(--s-4);
        margin-bottom: var(--s-3);
        transition: border-color 150ms ease;
      }
      .purchases-card:hover { border-color: var(--c-gold-dim); }
      .purchases-card-head {
        display: flex; align-items: baseline; justify-content: space-between;
        margin-bottom: var(--s-3);
      }
      .purchases-card-name {
        font-size: var(--fs-body);
        font-weight: 600;
        color: var(--c-fg);
      }
      .purchases-card-time {
        font-size: var(--fs-label);
        color: var(--c-fg-3);
      }
      .purchases-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: var(--s-3);
        margin-bottom: var(--s-4);
        font-size: var(--fs-body-sm);
      }
      .purchases-grid > div .label {
        font-size: var(--fs-label);
        color: var(--c-fg-3);
        margin-bottom: 2px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .purchases-grid > div .value {
        color: var(--c-fg);
        word-break: break-word;
      }
      .purchases-actions {
        display: flex; gap: var(--s-2); flex-wrap: wrap;
        padding-top: var(--s-3);
        border-top: 1px solid var(--c-ink-3);
      }
      .reject-form {
        display: none;
        margin-top: var(--s-3);
        padding-top: var(--s-3);
        border-top: 1px solid var(--c-ink-3);
      }
      .reject-form.open { display: block; }
      .reject-form textarea {
        width: 100%; min-height: 70px;
        background: var(--c-ink-2);
        border: 1px solid var(--c-ink-4);
        color: var(--c-fg);
        font-family: inherit; font-size: var(--fs-body-sm);
        padding: 10px 12px; border-radius: var(--r-sm);
        resize: vertical;
        margin-bottom: var(--s-2);
      }
      .reject-form textarea:focus {
        outline: none; border-color: var(--c-gold-dim);
      }
      .reject-form .btn-row {
        display: flex; gap: var(--s-2);
      }
    </style>

    <div class="purchases-page">
      <div class="purchases-head">
        <div>
          <h1>Pending Bank Transfers</h1>
          <span class="count" id="purchases-count"></span>
        </div>
        <button data-ui="btn" data-variant="ghost" data-size="sm" id="purchases-refresh">
          ${icon('refresh-cw', { size: 14 })} Refresh
        </button>
      </div>
      <div id="purchases-list">
        <div class="purchases-empty">Loading…</div>
      </div>
    </div>
  `;

  const listEl = root.querySelector('#purchases-list');
  const countEl = root.querySelector('#purchases-count');
  const refreshBtn = root.querySelector('#purchases-refresh');

  async function load() {
    listEl.innerHTML = '<div class="purchases-empty">Loading…</div>';
    countEl.textContent = '';
    try {
      const data = await adminCall('admin_list_pending');
      renderRows(data.rows || []);
    } catch (err) {
      listEl.innerHTML = `<div class="purchases-empty" style="color: var(--c-danger)">Failed to load: ${escapeHtml(err.message)}</div>`;
    }
  }

  function renderRows(rows) {
    countEl.textContent = rows.length === 0 ? '' : `(${rows.length} pending)`;
    if (rows.length === 0) {
      listEl.innerHTML = `<div class="purchases-empty">
        <p style="margin:0 0 4px;font-size:var(--fs-body)">No pending transfers.</p>
        <p style="margin:0;font-size:var(--fs-body-sm)">When buyers submit the bank-transfer form, they'll appear here.</p>
      </div>`;
      return;
    }

    listEl.innerHTML = rows.map(r => `
      <div class="purchases-card" data-row="${r.rowIndex}">
        <div class="purchases-card-head">
          <div class="purchases-card-name">${escapeHtml(r.name || '—')}</div>
          <div class="purchases-card-time" title="${escapeHtml(fmtAbsolute(r.timestamp))}">
            ${escapeHtml(relativeTime(r.timestamp))}
          </div>
        </div>
        <div class="purchases-grid">
          <div><div class="label">Email</div><div class="value">${escapeHtml(r.email || '—')}</div></div>
          <div><div class="label">Phone</div><div class="value" dir="ltr">${escapeHtml(r.phone || '—')}</div></div>
          <div><div class="label">Country</div><div class="value">${escapeHtml(r.country || '—')}</div></div>
          <div><div class="label">Product</div><div class="value">${escapeHtml(r.workshop || '—')}</div></div>
          <div style="grid-column: 1 / -1"><div class="label">UETR / Reference</div><div class="value" dir="ltr">${escapeHtml((r.interest || '').replace(/^UETR\/Ref:\s*/, '') || '—')}</div></div>
        </div>
        <div class="purchases-actions">
          <button data-ui="btn" data-variant="primary" data-size="sm" data-action="confirm">${icon('check', { size: 14 })} Confirm Purchase</button>
          <button data-ui="btn" data-variant="danger" data-size="sm" data-action="reject">${icon('x', { size: 14 })} Reject</button>
        </div>
        <div class="reject-form" data-reject-form>
          <textarea placeholder="Reason for rejection (will be sent to buyer)…" data-reject-reason></textarea>
          <div class="btn-row">
            <button data-ui="btn" data-variant="danger" data-size="sm" data-action="reject-send">Send Rejection</button>
            <button data-ui="btn" data-variant="ghost" data-size="sm" data-action="reject-cancel">Cancel</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  // Event delegation for row actions
  listEl.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const card = btn.closest('.purchases-card');
    if (!card) return;

    const rowIndex = card.dataset.row;
    const action = btn.dataset.action;
    const rejectForm = card.querySelector('[data-reject-form]');

    if (action === 'reject') {
      rejectForm.classList.add('open');
      card.querySelector('[data-reject-reason]').focus();
      return;
    }

    if (action === 'reject-cancel') {
      rejectForm.classList.remove('open');
      card.querySelector('[data-reject-reason]').value = '';
      return;
    }

    if (action === 'reject-send') {
      const reason = card.querySelector('[data-reject-reason]').value.trim();
      if (!reason) {
        toast('Reason is required', 'danger');
        return;
      }
      const buttons = card.querySelectorAll('[data-action]');
      buttons.forEach(b => b.disabled = true);
      try {
        const res = await adminCall('admin_reject', { row_index: rowIndex, reason });
        if (res.success) {
          toast('Rejection sent to ' + res.email, 'success');
          card.style.opacity = '0.5';
          setTimeout(() => load(), 800);
        } else {
          toast('Reject failed: ' + (res.error || 'unknown'), 'danger');
          buttons.forEach(b => b.disabled = false);
        }
      } catch (err) {
        toast('Reject failed: ' + err.message, 'danger');
        buttons.forEach(b => b.disabled = false);
      }
      return;
    }

    if (action === 'confirm') {
      if (!confirm('Confirm this purchase?\nThe buyer will receive the onboarding email immediately.')) return;
      const buttons = card.querySelectorAll('[data-action]');
      buttons.forEach(b => b.disabled = true);
      try {
        const res = await adminCall('admin_confirm', { row_index: rowIndex });
        if (res.success) {
          toast('Confirmed — onboarding email sent to ' + res.email, 'success');
          card.style.opacity = '0.5';
          setTimeout(() => load(), 800);
        } else {
          toast('Confirm failed: ' + (res.error || 'unknown'), 'danger');
          buttons.forEach(b => b.disabled = false);
        }
      } catch (err) {
        toast('Confirm failed: ' + err.message, 'danger');
        buttons.forEach(b => b.disabled = false);
      }
      return;
    }
  });

  refreshBtn.addEventListener('click', load);
  load();
}

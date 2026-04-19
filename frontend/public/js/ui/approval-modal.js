import { api } from '../api.js';

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

export function openApprovalModal({ title, previewHtml, pendingWriteId, onApproved, onRejected }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-card">
      <h3>${escapeHtml(title)}</h3>
      <div class="preview-body">${previewHtml}</div>
      <div class="modal-actions">
        <button class="btn-danger" data-act="reject">Reject</button>
        <button class="btn-primary" data-act="approve">Approve &amp; execute</button>
      </div>
      <div class="modal-msg" aria-live="polite"></div>
    </div>`;
  document.body.appendChild(overlay);
  const msg = overlay.querySelector('.modal-msg');
  overlay.addEventListener('click', async (e) => {
    const act = e.target.dataset?.act;
    if (!act) return;
    msg.textContent = act === 'approve' ? 'Executing…' : 'Rejecting…';
    try {
      const r = await api(`/api/writes/${pendingWriteId}/${act}`, { method: 'POST', body: '{}' });
      if (act === 'approve') onApproved?.(r); else onRejected?.(r);
      overlay.remove();
    } catch (err) {
      msg.textContent = `Error: ${err.message}`;
    }
  });
  return () => overlay.remove();
}

export function renderToggleLessonPreview(p) {
  return `
    <p><strong>${escapeHtml(p.title)}</strong> <span style="color:var(--silver)">(${escapeHtml(p.module)})</span></p>
    <p>Active: <code>${p.from}</code> → <code>${p.to}</code></p>
    <p style="color:var(--silver);font-size:.85rem">This will write to <code>Lessons</code> and append a row to <code>AuditLog</code>.</p>`;
}

export function renderCreateCouponPreview(p) {
  return `
    <table class="preview-table">
      <tr><th>Code</th><td>${escapeHtml(p.code)}</td></tr>
      <tr><th>Type</th><td>${escapeHtml(p.type)}</td></tr>
      <tr><th>Value</th><td>${p.value}</td></tr>
      <tr><th>Products</th><td>${escapeHtml(p.products)}</td></tr>
      <tr><th>Expires</th><td>${escapeHtml(p.endDate || '—')}</td></tr>
      <tr><th>Uses left</th><td>${p.usesLeft ?? '∞'}</td></tr>
    </table>`;
}

export function renderUpdateCouponPreview(p) {
  return `
    <p>Code: <strong>${escapeHtml(p.code)}</strong></p>
    <table class="preview-table">
      ${p.changes.map(c => `<tr><th>${escapeHtml(c.field)}</th><td><code>${escapeHtml(String(c.from))}</code> → <code>${escapeHtml(String(c.to))}</code></td></tr>`).join('')}
    </table>`;
}

export function renderSendEmailPreview(p) {
  const extra = p.requiresExtraApproval
    ? `<p style="color:var(--red)"><strong>Requires extra approval — ${p.totalRecipients} recipients (&gt;500).</strong></p>` : '';
  const samples = p.sample.map(s => `
    <div class="email-sample">
      <div><strong>${escapeHtml(s.email)}</strong></div>
      <div class="subj">${escapeHtml(s.subject)}</div>
      <pre>${escapeHtml(s.body)}</pre>
    </div>`).join('');
  return `
    <p>Language: <strong>${p.language}</strong> · Total: <strong>${p.totalRecipients}</strong></p>
    ${extra}
    <p style="color:var(--silver);font-size:.85rem">Showing first 3 of ${p.totalRecipients}:</p>
    ${samples}`;
}

export function renderLinkbioAddPreview(p) {
  return `
    <table class="preview-table">
      <tr><th>AR</th><td>${escapeHtml(p.titleAR)}</td></tr>
      <tr><th>EN</th><td>${escapeHtml(p.titleEN)}</td></tr>
      <tr><th>URL</th><td><code>${escapeHtml(p.url)}</code></td></tr>
      <tr><th>Icon</th><td>${escapeHtml(p.icon || '—')}</td></tr>
    </table>`;
}

export function renderLinkbioUpdatePreview(p) {
  return `
    <p>LinkID: <strong>${escapeHtml(p.linkId)}</strong></p>
    <table class="preview-table">
      ${p.changes.map(c => `<tr><th>${escapeHtml(c.field)}</th><td><code>${escapeHtml(String(c.from))}</code> → <code>${escapeHtml(String(c.to))}</code></td></tr>`).join('')}
    </table>`;
}

import { api } from '../api.js';
import { openApprovalModal, renderCreateCouponPreview, renderUpdateCouponPreview } from '../ui/approval-modal.js';

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

export default async function mount(root) {
  root.innerHTML = '<h2 style="color:var(--gold)">Coupons</h2><p style="color:var(--silver)">Loading…</p>';
  let { coupons } = await api('/api/data/coupons');

  function status(c) {
    if (!c.active) return 'inactive';
    if (c.endDate && new Date(c.endDate) < new Date()) return 'expired';
    if (c.usesLeft !== null && c.usesLeft <= 0) return 'used-up';
    return 'active';
  }

  function render() {
    const rows = coupons.map(c => `
      <tr data-code="${escapeHtml(c.code)}">
        <td><code>${escapeHtml(c.code)}</code></td>
        <td>${escapeHtml(c.type)}</td>
        <td>${c.value}${c.type === 'percentage' ? '%' : ' SAR'}</td>
        <td>${escapeHtml(c.products)}</td>
        <td>${escapeHtml(c.endDate || '—')}</td>
        <td>${c.usesLeft ?? '∞'}</td>
        <td><span class="status-${status(c)}">${status(c)}</span></td>
        <td>
          <button class="btn-ghost" data-action="toggle" data-code="${escapeHtml(c.code)}">${c.active ? 'Deactivate' : 'Activate'}</button>
        </td>
      </tr>`).join('');

    root.innerHTML = `
      <h2 style="color:var(--gold)">Coupons</h2>
      <button class="btn-primary" id="new-btn" style="margin-bottom:16px">+ New coupon</button>
      <table class="data-table">
        <thead><tr><th>Code</th><th>Type</th><th>Value</th><th>Products</th><th>Expires</th><th>Uses left</th><th>Status</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;

    document.getElementById('new-btn').onclick = () => openCreateForm();
    for (const b of root.querySelectorAll('button[data-action=toggle]')) {
      b.onclick = () => toggleCoupon(b.dataset.code);
    }
  }

  function openCreateForm() {
    const form = document.createElement('div');
    form.className = 'modal-overlay';
    form.innerHTML = `
      <div class="modal-card">
        <h3>New coupon</h3>
        <div class="form-field"><label>Code</label><input id="f-code" placeholder="EARLYBIRD" /></div>
        <div class="form-field"><label>Type</label>
          <select id="f-type"><option value="percentage">Percent %</option><option value="flat">Flat SAR</option></select></div>
        <div class="form-field"><label>Value</label><input id="f-value" type="number" /></div>
        <div class="form-field"><label>Products (csv or "all")</label><input id="f-products" value="all" /></div>
        <div class="form-field"><label>Expires (YYYY-MM-DD)</label><input id="f-expires" type="date" /></div>
        <div class="form-field"><label>Usage cap (blank = unlimited)</label><input id="f-cap" type="number" /></div>
        <div class="modal-actions">
          <button class="btn-ghost" id="cancel">Cancel</button>
          <button class="btn-primary" id="save">Preview</button>
        </div>
        <div class="modal-msg" id="fmsg"></div>
      </div>`;
    document.body.appendChild(form);
    form.querySelector('#cancel').onclick = () => form.remove();
    form.querySelector('#save').onclick = async () => {
      const body = {
        code: form.querySelector('#f-code').value.trim(),
        type: form.querySelector('#f-type').value,
        value: Number(form.querySelector('#f-value').value),
        products: form.querySelector('#f-products').value.trim(),
        endDate: form.querySelector('#f-expires').value,
        usesLeft: form.querySelector('#f-cap').value === '' ? null : Number(form.querySelector('#f-cap').value),
      };
      try {
        const stage = await api('/api/writes/create_coupon', { method: 'POST', body: JSON.stringify(body) });
        form.remove();
        openApprovalModal({
          title: 'Confirm coupon creation',
          previewHtml: renderCreateCouponPreview(stage.preview),
          pendingWriteId: stage.id,
          onApproved: async () => { coupons = (await api('/api/data/coupons')).coupons; render(); },
        });
      } catch (e) {
        form.querySelector('#fmsg').textContent = `Error: ${e.message}`;
      }
    };
  }

  async function toggleCoupon(code) {
    const current = coupons.find(c => c.code === code);
    try {
      const stage = await api('/api/writes/update_coupon', {
        method: 'POST',
        body: JSON.stringify({ code, patch: { active: !current.active } }),
      });
      openApprovalModal({
        title: 'Confirm coupon update',
        previewHtml: renderUpdateCouponPreview(stage.preview),
        pendingWriteId: stage.id,
        onApproved: async () => { coupons = (await api('/api/data/coupons')).coupons; render(); },
      });
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
  }

  render();
}

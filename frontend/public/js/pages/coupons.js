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
        <td style="white-space:nowrap;display:flex;gap:6px;justify-content:flex-end">
          <button class="btn-ghost" data-action="edit" data-code="${escapeHtml(c.code)}">Edit</button>
          <button class="btn-ghost" data-action="toggle" data-code="${escapeHtml(c.code)}">${c.active ? 'Off' : 'On'}</button>
          <button class="btn-danger" data-action="delete" data-code="${escapeHtml(c.code)}">Delete</button>
        </td>
      </tr>`).join('');

    root.innerHTML = `
      <h2 style="color:var(--gold)">Coupons</h2>
      <button class="btn-primary" id="new-btn" style="margin-bottom:16px">+ New coupon</button>
      <table class="data-table">
        <thead><tr><th>Code</th><th>Type</th><th>Value</th><th>Products</th><th>Expires</th><th>Uses left</th><th>Status</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;

    document.getElementById('new-btn').onclick = () => openForm({});
    for (const b of root.querySelectorAll('button[data-action=edit]')) {
      b.onclick = () => openForm(coupons.find(c => c.code === b.dataset.code));
    }
    for (const b of root.querySelectorAll('button[data-action=toggle]')) {
      b.onclick = () => quickToggle(b.dataset.code);
    }
    for (const b of root.querySelectorAll('button[data-action=delete]')) {
      b.onclick = () => deleteCoupon(b.dataset.code);
    }
  }

  // Open the form modal for create (no code passed) or edit (coupon object passed).
  function openForm(initial) {
    const isEdit = !!initial.code;
    const form = document.createElement('div');
    form.className = 'modal-overlay';
    form.innerHTML = `
      <div class="modal-card">
        <h3>${isEdit ? 'Edit coupon' : 'New coupon'}</h3>
        <div class="form-field"><label>Code ${isEdit ? '(read-only)' : ''}</label>
          <input id="f-code" placeholder="EARLYBIRD" value="${escapeHtml(initial.code || '')}" ${isEdit ? 'readonly style="opacity:.6"' : ''} /></div>
        <div class="form-field"><label>Type</label>
          <select id="f-type">
            <option value="percentage" ${initial.type === 'percentage' ? 'selected' : ''}>Percent %</option>
            <option value="flat" ${initial.type === 'flat' ? 'selected' : ''}>Flat SAR</option>
          </select></div>
        <div class="form-field"><label>Value</label>
          <input id="f-value" type="number" step="any" value="${initial.value ?? ''}" /></div>
        <div class="form-field"><label>Min amount (SAR)</label>
          <input id="f-min" type="number" step="any" value="${initial.minSAR ?? 0}" /></div>
        <div class="form-field"><label>Products (csv or "all")</label>
          <input id="f-products" value="${escapeHtml(initial.products || 'all')}" /></div>
        <div class="form-field"><label>Starts (YYYY-MM-DD)</label>
          <input id="f-start" type="date" value="${escapeHtml((initial.startDate || '').slice(0, 10))}" /></div>
        <div class="form-field"><label>Expires (YYYY-MM-DD)</label>
          <input id="f-end" type="date" value="${escapeHtml((initial.endDate || '').slice(0, 10))}" /></div>
        <div class="form-field"><label>Usage cap (blank = unlimited)</label>
          <input id="f-cap" type="number" value="${initial.usesLeft ?? ''}" /></div>
        ${isEdit ? `<div class="form-field"><label>Status</label>
          <select id="f-active"><option value="true" ${initial.active ? 'selected' : ''}>Active</option><option value="false" ${!initial.active ? 'selected' : ''}>Inactive</option></select></div>` : ''}
        <div class="modal-actions">
          <button class="btn-ghost" id="cancel">Cancel</button>
          <button class="btn-primary" id="save">Preview</button>
        </div>
        <div class="modal-msg" id="fmsg"></div>
      </div>`;
    document.body.appendChild(form);
    form.querySelector('#cancel').onclick = () => form.remove();
    form.querySelector('#save').onclick = async () => {
      const code = form.querySelector('#f-code').value.trim();
      const values = {
        type: form.querySelector('#f-type').value,
        value: Number(form.querySelector('#f-value').value),
        minSAR: Number(form.querySelector('#f-min').value || 0),
        products: form.querySelector('#f-products').value.trim() || 'all',
        startDate: form.querySelector('#f-start').value,
        endDate: form.querySelector('#f-end').value,
        usesLeft: form.querySelector('#f-cap').value === '' ? null : Number(form.querySelector('#f-cap').value),
      };
      if (isEdit) {
        values.active = form.querySelector('#f-active').value === 'true';
      }
      try {
        if (isEdit) {
          // Build patch from values that differ from initial
          const patch = {};
          for (const [k, v] of Object.entries(values)) if (v !== initial[k]) patch[k] = v;
          if (!Object.keys(patch).length) { form.remove(); return; }
          const stage = await api('/api/writes/update_coupon', { method: 'POST', body: JSON.stringify({ code, patch }) });
          form.remove();
          openApprovalModal({
            title: 'Confirm coupon update',
            previewHtml: renderUpdateCouponPreview(stage.preview),
            pendingWriteId: stage.id,
            onApproved: async () => { coupons = (await api('/api/data/coupons')).coupons; render(); },
          });
        } else {
          const stage = await api('/api/writes/create_coupon', {
            method: 'POST',
            body: JSON.stringify({ code, ...values }),
          });
          form.remove();
          openApprovalModal({
            title: 'Confirm coupon creation',
            previewHtml: renderCreateCouponPreview(stage.preview),
            pendingWriteId: stage.id,
            onApproved: async () => { coupons = (await api('/api/data/coupons')).coupons; render(); },
          });
        }
      } catch (e) {
        form.querySelector('#fmsg').textContent = `Error: ${e.message}`;
      }
    };
  }

  async function quickToggle(code) {
    const current = coupons.find(c => c.code === code);
    try {
      const stage = await api('/api/writes/update_coupon', {
        method: 'POST',
        body: JSON.stringify({ code, patch: { active: !current.active } }),
      });
      openApprovalModal({
        title: 'Confirm coupon toggle',
        previewHtml: renderUpdateCouponPreview(stage.preview),
        pendingWriteId: stage.id,
        onApproved: async () => { coupons = (await api('/api/data/coupons')).coupons; render(); },
      });
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
  }

  async function deleteCoupon(code) {
    if (!confirm(`Delete coupon ${code} permanently? This removes the row from the sheet.`)) return;
    try {
      const stage = await api('/api/writes/delete_coupon', { method: 'POST', body: JSON.stringify({ code }) });
      openApprovalModal({
        title: 'Confirm permanent delete',
        previewHtml: `
          <p style="color:var(--red)"><strong>Permanent delete</strong> — cannot be undone.</p>
          <table class="preview-table">
            <tr><th>Code</th><td><code>${escapeHtml(stage.preview.code)}</code></td></tr>
            <tr><th>Type</th><td>${escapeHtml(stage.preview.type)}</td></tr>
            <tr><th>Value</th><td>${stage.preview.value}</td></tr>
            <tr><th>Products</th><td>${escapeHtml(stage.preview.products)}</td></tr>
          </table>`,
        pendingWriteId: stage.id,
        onApproved: async () => { coupons = (await api('/api/data/coupons')).coupons; render(); },
      });
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
  }

  render();
}

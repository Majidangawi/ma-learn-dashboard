import { api } from '../api.js';
import { openApprovalModal, renderCreateCouponPreview, renderUpdateCouponPreview } from '../ui/approval-modal.js';
import { icon } from '../ui/icons.js';

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

export default async function mount(root) {
  root.innerHTML = `<div style="padding: var(--s-6); color: var(--c-fg-3); font-size: var(--fs-body-sm)">Loading coupons…</div>`;
  let { coupons } = await api('/api/data/coupons');

  let openCode = null; // '__new__' | coupon code | null

  function status(c) {
    if (!c.active) return 'inactive';
    if (c.endDate && new Date(c.endDate) < new Date()) return 'expired';
    if (c.usesLeft !== null && c.usesLeft <= 0) return 'used-up';
    return 'active';
  }

  function toneFor(st) {
    if (st === 'active') return 'success';
    if (st === 'inactive') return 'warning';
    if (st === 'expired') return 'danger';
    return 'default';
  }

  function buildFormHtml(initial) {
    const isEdit = !!initial.code;
    const current = String(initial.products || 'all').split(',').map(s => s.trim()).filter(Boolean);
    const isAll = current.includes('all') || current.length === 0;
    const options = [
      { key: 'all', label: 'All products' },
      { key: 'intro-to-creative-ai', label: 'T2 (ITCAI) — Intro to Creative AI' },
      { key: 'creative-ai-workshop-t3', label: 'T3 — Creative AI Workshop' },
      { key: 'beyond-lighting', label: 'Beyond Lighting' },
      { key: 'prompt-pack', label: 'Prompt Pack' },
    ];
    return `
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--s-4)">
        <div data-ui="field"><label>Code ${isEdit ? '(read-only)' : ''}</label>
          <input data-ui="input" id="f-code" placeholder="EARLYBIRD" value="${escapeHtml(initial.code || '')}" ${isEdit ? 'readonly style="opacity:.6"' : ''}></div>
        <div data-ui="field"><label>Type</label>
          <select data-ui="select" id="f-type">
            <option value="percentage" ${initial.type === 'percentage' ? 'selected' : ''}>Percent %</option>
            <option value="flat" ${initial.type === 'flat' ? 'selected' : ''}>Flat SAR</option>
          </select></div>
        <div data-ui="field"><label>Value</label><input data-ui="input" id="f-value" type="number" step="any" value="${initial.value ?? ''}"></div>
        <div data-ui="field"><label>Min amount (SAR)</label><input data-ui="input" id="f-min" type="number" step="any" value="${initial.minSAR ?? 0}"></div>
        <div data-ui="field"><label>Starts</label><input data-ui="input" id="f-start" type="date" value="${escapeHtml((initial.startDate || '').slice(0, 10))}"></div>
        <div data-ui="field"><label>Expires</label><input data-ui="input" id="f-end" type="date" value="${escapeHtml((initial.endDate || '').slice(0, 10))}"></div>
        <div data-ui="field"><label>Usage cap (blank = unlimited)</label><input data-ui="input" id="f-cap" type="number" value="${initial.usesLeft ?? ''}"></div>
        ${isEdit ? `<div data-ui="field"><label>Status</label>
          <select data-ui="select" id="f-active"><option value="true" ${initial.active ? 'selected' : ''}>Active</option><option value="false" ${!initial.active ? 'selected' : ''}>Inactive</option></select></div>` : ''}
      </div>

      <div data-ui="field" style="margin-top: var(--s-4)">
        <label>Applies to</label>
        <div id="f-products-group" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--s-2); padding: var(--s-3); background: var(--c-ink-1); border: 1px solid var(--c-ink-4); border-radius: var(--r-md)">
          ${options.map(o => {
            const checked = o.key === 'all' ? isAll : (!isAll && current.includes(o.key));
            return `<label style="display:flex; align-items:center; gap: var(--s-2); cursor:pointer; font-size: var(--fs-body-sm); color: var(--c-fg-2)">
              <input type="checkbox" class="f-prod" value="${o.key}" ${checked ? 'checked' : ''}>
              ${escapeHtml(o.label)}
            </label>`;
          }).join('')}
        </div>
      </div>

      <div style="display:flex; justify-content:flex-end; gap: var(--s-2); margin-top: var(--s-5)">
        <button data-ui="btn" data-variant="ghost"   id="f-cancel">Cancel</button>
        <button data-ui="btn" data-variant="primary" id="f-save">Preview</button>
      </div>
      <div id="f-msg" style="text-align:right; font-size: var(--fs-body-sm); color: var(--c-fg-3); margin-top: var(--s-2)"></div>`;
  }

  function collapse() {
    if (!openCode) return;
    if (openCode === '__new__') {
      const slot = document.getElementById('new-slot');
      if (slot) slot.innerHTML = '';
    } else {
      const tr = root.querySelector(`.coupon-expand[data-for="${CSS.escape(openCode)}"]`);
      if (tr) {
        tr.style.display = 'none';
        const inner = tr.querySelector('.coupon-expand-inner');
        if (inner) inner.innerHTML = '';
      }
    }
    openCode = null;
  }

  function openFormInto(container, initial) {
    container.innerHTML = `<div style="padding: var(--s-5); background: var(--c-ink-2); border-radius: var(--r-md); border: 1px solid var(--c-ink-4)">${buildFormHtml(initial)}</div>`;
    const prodGroup = container.querySelector('#f-products-group');
    prodGroup.addEventListener('change', (e) => {
      const t = e.target;
      if (!t.classList || !t.classList.contains('f-prod')) return;
      const allBox = prodGroup.querySelector('.f-prod[value="all"]');
      const specific = Array.from(prodGroup.querySelectorAll('.f-prod')).filter(b => b.value !== 'all');
      if (t.value === 'all' && t.checked) specific.forEach(b => (b.checked = false));
      else if (t.value !== 'all' && t.checked) allBox.checked = false;
      const anyChecked = Array.from(prodGroup.querySelectorAll('.f-prod')).some(b => b.checked);
      if (!anyChecked) allBox.checked = true;
    });
    container.querySelector('#f-cancel').onclick = collapse;
    container.querySelector('#f-save').onclick = () => submitForm(container, initial);
  }

  function expandNew() {
    collapse();
    openCode = '__new__';
    openFormInto(document.getElementById('new-slot'), {});
  }

  function expandRow(code) {
    collapse();
    openCode = code;
    const tr = root.querySelector(`.coupon-expand[data-for="${CSS.escape(code)}"]`);
    if (!tr) return;
    tr.style.display = '';
    const initial = coupons.find(c => c.code === code) || {};
    openFormInto(tr.querySelector('.coupon-expand-inner'), initial);
  }

  async function submitForm(container, initial) {
    const isEdit = !!initial.code;
    const codeEl = container.querySelector('#f-code');
    const code = codeEl.value.trim();
    const prodGroup = container.querySelector('#f-products-group');
    const prodChecked = Array.from(prodGroup.querySelectorAll('.f-prod:checked')).map(b => b.value);
    const productsValue = prodChecked.includes('all') || prodChecked.length === 0 ? 'all' : prodChecked.join(',');
    const values = {
      type: container.querySelector('#f-type').value,
      value: Number(container.querySelector('#f-value').value),
      minSAR: Number(container.querySelector('#f-min').value || 0),
      products: productsValue,
      startDate: container.querySelector('#f-start').value,
      endDate: container.querySelector('#f-end').value,
      usesLeft: container.querySelector('#f-cap').value === '' ? null : Number(container.querySelector('#f-cap').value),
    };
    if (isEdit) {
      values.active = container.querySelector('#f-active').value === 'true';
    }
    const msgEl = container.querySelector('#f-msg');
    try {
      if (isEdit) {
        const patch = {};
        for (const [k, v] of Object.entries(values)) if (v !== initial[k]) patch[k] = v;
        if (!Object.keys(patch).length) { collapse(); return; }
        const stage = await api('/api/writes/update_coupon', { method: 'POST', body: JSON.stringify({ code, patch }) });
        openApprovalModal({
          title: 'Confirm coupon update',
          previewHtml: renderUpdateCouponPreview(stage.preview),
          pendingWriteId: stage.id,
          onApproved: async () => { coupons = (await api('/api/data/coupons')).coupons; collapse(); render(); },
        });
      } else {
        const stage = await api('/api/writes/create_coupon', {
          method: 'POST',
          body: JSON.stringify({ code, ...values }),
        });
        openApprovalModal({
          title: 'Confirm coupon creation',
          previewHtml: renderCreateCouponPreview(stage.preview),
          pendingWriteId: stage.id,
          onApproved: async () => { coupons = (await api('/api/data/coupons')).coupons; collapse(); render(); },
        });
      }
    } catch (e) {
      if (msgEl) msgEl.textContent = `Error: ${e.message}`;
    }
  }

  function render() {
    const rows = coupons.map(c => {
      const st = status(c);
      const tone = toneFor(st);
      return `
        <tr data-code="${escapeHtml(c.code)}" class="coupon-row" style="border-bottom: 0.5px solid var(--c-ink-4)">
          <td style="padding: var(--s-3); font-family: var(--font-mono); font-size: var(--fs-mono); color: var(--c-gold)"><code>${escapeHtml(c.code)}</code></td>
          <td style="padding: var(--s-3); color: var(--c-fg-2); font-size: var(--fs-body-sm)">${escapeHtml(c.type)}</td>
          <td style="padding: var(--s-3); font-size: var(--fs-body-sm)">${c.value}${c.type === 'percentage' ? '%' : ' SAR'}</td>
          <td style="padding: var(--s-3); color: var(--c-fg-2); font-size: var(--fs-body-sm)">${escapeHtml(c.products)}</td>
          <td style="padding: var(--s-3); color: var(--c-fg-2); font-size: var(--fs-body-sm)">${escapeHtml(c.endDate || '—')}</td>
          <td style="padding: var(--s-3); color: var(--c-fg-2); font-size: var(--fs-body-sm)">${c.usesLeft ?? '∞'}</td>
          <td style="padding: var(--s-3)"><span data-ui="tag" data-tone="${tone}">${st}</span></td>
          <td style="padding: var(--s-3); text-align:right; white-space:nowrap">
            <button data-ui="btn" data-variant="ghost" data-size="sm" data-icon-only data-action="edit"   data-code="${escapeHtml(c.code)}" aria-label="Edit">${icon('edit', { size: 16 })}</button>
            <button data-ui="btn" data-variant="ghost" data-size="sm" data-icon-only data-action="toggle" data-code="${escapeHtml(c.code)}" aria-label="${c.active ? 'Deactivate' : 'Activate'}">${icon(c.active ? 'eye-off' : 'eye', { size: 16 })}</button>
            <button data-ui="btn" data-variant="ghost" data-size="sm" data-icon-only data-action="delete" data-code="${escapeHtml(c.code)}" aria-label="Delete">${icon('trash-2', { size: 16 })}</button>
          </td>
        </tr>
        <tr class="coupon-expand" data-for="${escapeHtml(c.code)}" style="display:none">
          <td colspan="8" style="padding: 0; background: var(--c-ink-2)">
            <div class="coupon-expand-inner" style="padding: var(--s-5)"></div>
          </td>
        </tr>`;
    }).join('');

    root.innerHTML = `
      <section style="max-width:1080px; margin:0 auto; display:grid; gap:var(--s-5)">

        <header style="display:flex; justify-content:space-between; align-items:center; gap:var(--s-3); flex-wrap:wrap">
          <div style="color:var(--c-fg-2); font-size:var(--fs-body-sm)">Discount codes for checkout. Moyasar reads the active coupon set on every order.</div>
          <button data-ui="btn" data-variant="primary" id="new-btn">New coupon</button>
        </header>

        <div id="new-slot"></div>

        <table class="coupons-table" style="width:100%; border-collapse: collapse">
          <thead>
            <tr>
              ${['Code','Type','Value','Products','Expires','Uses left','Status',''].map(h => `
                <th style="text-align:left; padding: var(--s-2) var(--s-3); font-size: var(--fs-label); font-weight:500; letter-spacing:0.08em; text-transform:uppercase; color: var(--c-fg-3); border-bottom: 0.5px solid var(--c-ink-4);">${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </section>`;

    document.getElementById('new-btn').onclick = expandNew;
    for (const b of root.querySelectorAll('button[data-action=edit]'))   b.onclick = () => expandRow(b.dataset.code);
    for (const b of root.querySelectorAll('button[data-action=toggle]')) b.onclick = () => quickToggle(b.dataset.code);
    for (const b of root.querySelectorAll('button[data-action=delete]')) b.onclick = () => deleteCoupon(b.dataset.code);
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
          <p style="color:var(--c-danger)"><strong>Permanent delete</strong> — cannot be undone.</p>
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

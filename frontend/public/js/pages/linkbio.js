import { api } from '../api.js';
import { openApprovalModal, renderLinkbioAddPreview, renderLinkbioUpdatePreview } from '../ui/approval-modal.js';

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
function shorten(u) {
  try {
    const url = new URL(u);
    const path = url.pathname === '/' ? '' : url.pathname;
    return url.hostname.replace(/^www\./, '') + (path.length > 20 ? path.slice(0, 18) + '…' : path);
  } catch { return u.length > 40 ? u.slice(0, 37) + '…' : u; }
}

// Icon SVGs — mirror of the public linkinbio page registry, scaled for 20px badge.
const ICON_SVGS = {
  malearn: '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3zM5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12 2.16c3.2 0 3.58.01 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.27.07 1.65.07 4.85 0 3.2-.01 3.58-.07 4.85-.15 3.22-1.66 4.77-4.92 4.92-1.27.06-1.64.07-4.85.07-3.2 0-3.58-.01-4.85-.07-3.26-.15-4.77-1.7-4.92-4.92-.06-1.27-.07-1.64-.07-4.85 0-3.2.01-3.58.07-4.85C2.38 3.86 3.9 2.31 7.15 2.16 8.42 2.11 8.8 2.16 12 2.16M12 0C8.74 0 8.33.01 7.05.07 2.69.27.27 2.69.07 7.05.01 8.33 0 8.74 0 12c0 3.26.01 3.67.07 4.95.2 4.36 2.62 6.78 6.98 6.98C8.33 23.99 8.74 24 12 24c3.26 0 3.67-.01 4.95-.07 4.35-.2 6.78-2.62 6.98-6.98.06-1.28.07-1.69.07-4.95 0-3.26-.01-3.67-.07-4.95-.2-4.35-2.62-6.78-6.98-6.98C15.67.01 15.26 0 12 0zm0 5.84A6.16 6.16 0 1 0 18.16 12 6.16 6.16 0 0 0 12 5.84zm0 10.16A4 4 0 1 1 16 12a4 4 0 0 1-4 4zm6.4-11.84a1.44 1.44 0 1 0 1.44 1.44 1.44 1.44 0 0 0-1.44-1.44z"/></svg>',
  whatsapp: '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51H6.67c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35M12.05 21.8h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.88 9.88m8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.33.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.69 1.45h.01c6.55 0 11.89-5.34 11.89-11.89a11.82 11.82 0 0 0-3.48-8.41z"/></svg>',
  waitlist: '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm1 14.93V17a1 1 0 0 1-2 0v-.07A8 8 0 0 1 4.07 11H4a1 1 0 0 1 0-2h.07A8 8 0 0 1 11 4.07V4a1 1 0 0 1 2 0v.07A8 8 0 0 1 19.93 11H20a1 1 0 0 1 0 2h-.07A8 8 0 0 1 13 16.93zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 6a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2zM7 12h5v5H7z"/></svg>',
  youtube: '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.54 12 3.54 12 3.54s-7.5 0-9.38.51A3.02 3.02 0 0 0 .5 6.19C0 8.07 0 12 0 12s0 3.93.5 5.81a3.02 3.02 0 0 0 2.12 2.14c1.87.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.14C24 15.93 24 12 24 12s0-3.93-.5-5.81zM9.55 15.57V8.43L15.82 12 9.55 15.57z"/></svg>',
};
function iconHtml(name) {
  const svg = ICON_SVGS[String(name || '').toLowerCase()];
  if (svg) return svg;
  if (name) return `<span class="row-icon-emoji">${escapeHtmlStatic(name)}</span>`;
  return ICON_SVGS.malearn;
}
function escapeHtmlStatic(s) {
  return String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// Action icons (Lucide-style)
const ICON_EDIT = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>';
const ICON_TRASH = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
const ICON_DRAG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><circle cx="9" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>';

export default async function mount(root) {
  root.innerHTML = '<p style="color:var(--c-fg-2)">Loading…</p>';
  let state = await api('/api/data/linkbio');

  function render() {
    const rows = state.items.map(i => `
      <li data-id="${escapeHtml(i.linkId)}" class="lb-row ${i.active ? '' : 'is-off'}">
        <button class="lb-drag" aria-label="Reorder">${ICON_DRAG}</button>
        <div class="lb-icon">${iconHtml(i.icon)}</div>
        <div class="lb-main">
          <div class="lb-title">${escapeHtml(i.titleAR || i.titleEN)}</div>
          <div class="lb-sub">
            <span class="lb-sub-en">${escapeHtml(i.titleEN)}</span>
            <span class="lb-dot">·</span>
            <a class="lb-url" href="${escapeHtml(i.url)}" target="_blank" rel="noopener">${escapeHtml(shorten(i.url))}</a>
          </div>
        </div>
        <div class="lb-side">
          <span class="lb-stat" title="click count">${i.clickCount}</span>
          <button class="lb-pill ${i.active ? 'on' : 'off'}" data-action="toggle" data-id="${escapeHtml(i.linkId)}" type="button" title="${i.active ? 'Deactivate' : 'Activate'}">
            <span class="lb-dot-indicator"></span>${i.active ? 'On' : 'Off'}
          </button>
          <button class="lb-ibtn" data-action="edit" data-id="${escapeHtml(i.linkId)}" aria-label="Edit" title="Edit">${ICON_EDIT}</button>
          <button class="lb-ibtn danger" data-action="delete" data-id="${escapeHtml(i.linkId)}" aria-label="Delete" title="Delete">${ICON_TRASH}</button>
        </div>
      </li>`).join('');

    root.innerHTML = `
      <div style="display:flex; align-items:center; gap: var(--s-3); margin-bottom: var(--s-5); flex-wrap: wrap">
        <button data-ui="btn" data-variant="primary" id="lb-open-public" style="display:inline-flex;align-items:center;gap:8px">Open public page ↗</button>
        <span style="color: var(--c-fg-3); font-size: var(--fs-body-sm)">Live at <span style="font-family: var(--font-mono); font-size: var(--fs-mono); color: var(--c-fg-2)">linkinbio.malearnsa.com</span></span>
      </div>

      <section data-ui="card" style="margin-bottom: var(--s-5)">
        <div style="font-size: var(--fs-label); font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: var(--c-fg-3); margin-bottom: var(--s-3)">Header</div>
        <div data-ui="field"><label>Photo URL</label><input data-ui="input" id="h-photo" value="${escapeHtml(state.header.photoURL)}" /></div>
        <div data-ui="field"><label>Tagline AR</label><input data-ui="input" id="h-ar" value="${escapeHtml(state.header.taglineAR)}" /></div>
        <div data-ui="field"><label>Tagline EN</label><input data-ui="input" id="h-en" value="${escapeHtml(state.header.taglineEN)}" /></div>
        <div style="display:flex; justify-content:flex-end; margin-top: var(--s-3)">
          <button data-ui="btn" data-variant="primary" id="save-header">Save header</button>
        </div>
      </section>

      <div style="display:flex; align-items:center; justify-content: space-between; margin-bottom: var(--s-3)">
        <div style="font-size: var(--fs-label); font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: var(--c-fg-3)">Links</div>
        <button data-ui="btn" data-variant="primary" id="add-btn">Add link</button>
      </div>
      <ul class="linkbio-list">${rows}</ul>`;

    const list = root.querySelector('.linkbio-list');
    if (window.Sortable) {
      window.Sortable.create(list, {
        animation: 150,
        handle: '.lb-drag',
        onEnd: async () => {
          const ids = [...list.querySelectorAll('li')].map(li => li.dataset.id);
          for (let i = 0; i < ids.length; i++) {
            try {
              const stage = await api('/api/writes/linkbio_update', {
                method: 'POST',
                body: JSON.stringify({ linkId: ids[i], patch: { order: i + 1 } }),
              });
              await api(`/api/writes/${stage.id}/approve`, { method: 'POST', body: '{}' });
            } catch (e) { console.warn('reorder failed', ids[i], e); }
          }
          state = await api('/api/data/linkbio');
        },
      });
    }

    document.getElementById('add-btn').onclick = openAddForm;
    document.getElementById('save-header').onclick = saveHeader;
    document.getElementById('lb-open-public').onclick = () => window.open('https://linkinbio.malearnsa.com', '_blank', 'noopener');
    for (const b of root.querySelectorAll('button[data-action=edit]')) b.onclick = () => openEditForm(b.dataset.id);
    for (const b of root.querySelectorAll('button[data-action=delete]')) b.onclick = () => deleteItem(b.dataset.id);
    for (const b of root.querySelectorAll('button[data-action=toggle]')) b.onclick = () => toggleActivePill(b.dataset.id);
  }

  function openAddForm() {
    showForm('Add link', {}, async (vals) => {
      const stage = await api('/api/writes/linkbio_add', { method: 'POST', body: JSON.stringify(vals) });
      openApprovalModal({
        title: 'Confirm new link', previewHtml: renderLinkbioAddPreview(stage.preview), pendingWriteId: stage.id,
        onApproved: async () => { state = await api('/api/data/linkbio'); render(); },
      });
    });
  }
  function openEditForm(id) {
    const cur = state.items.find(i => i.linkId === id);
    showForm('Edit link', cur, async (vals) => {
      const patch = {};
      for (const [k, v] of Object.entries(vals)) if (v !== (cur[k] ?? '')) patch[k] = v;
      if (!Object.keys(patch).length) throw new Error('No changes to save');
      const stage = await api('/api/writes/linkbio_update', { method: 'POST', body: JSON.stringify({ linkId: id, patch }) });
      openApprovalModal({
        title: 'Confirm link update', previewHtml: renderLinkbioUpdatePreview(stage.preview), pendingWriteId: stage.id,
        onApproved: async () => { state = await api('/api/data/linkbio'); render(); },
      });
    });
  }
  function showForm(title, initial, onSubmit) {
    const iconKeys = Object.keys(ICON_SVGS);
    const initialIcon = String(initial.icon || '');
    const iconButtons = [
      `<button type="button" class="icon-pick-btn${initialIcon === '' ? ' is-selected' : ''}" data-icon="" title="None" style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid var(--c-line);border-radius:8px;background:transparent;color:var(--c-fg-2);cursor:pointer;font:inherit"><span style="font-size:12px;color:var(--c-fg-3)">None</span></button>`,
      ...iconKeys.map(k => `<button type="button" class="icon-pick-btn${initialIcon.toLowerCase() === k ? ' is-selected' : ''}" data-icon="${k}" title="${k}" style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid var(--c-line);border-radius:8px;background:transparent;color:var(--c-fg-2);cursor:pointer;font:inherit">${ICON_SVGS[k]}<span style="font-size:12px;color:var(--c-fg-3);text-transform:capitalize">${k}</span></button>`),
    ].join('');
    const o = document.createElement('div');
    o.className = 'modal-overlay';
    o.innerHTML = `
      <div class="modal-card">
        <h3>${escapeHtml(title)}</h3>
        <div class="form-field"><label>Title AR</label><input id="titleAR" value="${escapeHtml(initial.titleAR || '')}" /></div>
        <div class="form-field"><label>Title EN</label><input id="titleEN" value="${escapeHtml(initial.titleEN || '')}" /></div>
        <div class="form-field"><label>URL</label><input id="url" value="${escapeHtml(initial.url || '')}" /></div>
        <div class="form-field">
          <label>Icon</label>
          <div id="icon-picker" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px">${iconButtons}</div>
          <input type="hidden" id="icon" value="${escapeHtml(initialIcon)}" />
        </div>
        <div class="form-field"><label>Description (optional)</label><input id="description" value="${escapeHtml(initial.description || '')}" /></div>
        <div class="modal-actions">
          <button class="btn-ghost" data-ui="btn" data-variant="ghost" id="cancel">Cancel</button>
          <button class="btn-primary" data-ui="btn" data-variant="primary" id="ok">Preview</button>
        </div>
        <div class="modal-msg" id="msg" aria-live="polite"></div>
      </div>`;
    document.body.appendChild(o);
    const iconInput = o.querySelector('#icon');
    const picker = o.querySelector('#icon-picker');
    picker.addEventListener('click', (e) => {
      const btn = e.target.closest('.icon-pick-btn');
      if (!btn) return;
      iconInput.value = btn.dataset.icon || '';
      for (const b of picker.querySelectorAll('.icon-pick-btn')) {
        const on = b === btn;
        b.classList.toggle('is-selected', on);
        b.style.background = on ? 'var(--c-ink-2)' : 'transparent';
        b.style.borderColor = on ? 'var(--c-accent, var(--c-fg-2))' : 'var(--c-line)';
      }
    });
    for (const b of picker.querySelectorAll('.icon-pick-btn.is-selected')) {
      b.style.background = 'var(--c-ink-2)';
      b.style.borderColor = 'var(--c-accent, var(--c-fg-2))';
    }
    o.querySelector('#cancel').onclick = () => o.remove();
    o.querySelector('#ok').onclick = async () => {
      const vals = ['titleAR','titleEN','url','icon','description'].reduce((a, k) => (a[k] = o.querySelector('#'+k).value, a), {});
      const okBtn = o.querySelector('#ok');
      const msg = o.querySelector('#msg');
      okBtn.disabled = true;
      msg.textContent = '';
      try {
        await onSubmit(vals);
        o.remove();
      } catch (e) {
        okBtn.disabled = false;
        msg.textContent = 'Error: ' + (e?.message || e);
      }
    };
  }
  async function deleteItem(id) {
    if (!confirm('Delete link?')) return;
    const stage = await api('/api/writes/linkbio_delete', { method: 'POST', body: JSON.stringify({ linkId: id }) });
    openApprovalModal({
      title: 'Confirm delete', previewHtml: `<p>Delete link <code>${escapeHtml(id)}</code>?</p>`,
      pendingWriteId: stage.id,
      onApproved: async () => { state = await api('/api/data/linkbio'); render(); },
    });
  }
  async function toggleActivePill(id) {
    const cur = state.items.find(i => i.linkId === id);
    if (!cur) return;
    const to = !cur.active;
    const stage = await api('/api/writes/linkbio_update', {
      method: 'POST',
      body: JSON.stringify({ linkId: id, patch: { active: to } }),
    });
    openApprovalModal({
      title: 'Confirm toggle', previewHtml: renderLinkbioUpdatePreview(stage.preview), pendingWriteId: stage.id,
      onApproved: async () => { state = await api('/api/data/linkbio'); render(); },
    });
  }
  async function saveHeader() {
    const body = {
      photoURL: document.getElementById('h-photo').value,
      taglineAR: document.getElementById('h-ar').value,
      taglineEN: document.getElementById('h-en').value,
    };
    const stage = await api('/api/writes/linkbio_header', { method: 'POST', body: JSON.stringify(body) });
    openApprovalModal({
      title: 'Confirm header update',
      previewHtml: `<pre style="white-space:pre-wrap;font:inherit;background:var(--c-ink-2);padding:10px;border-radius:6px">${escapeHtml(JSON.stringify(stage.preview, null, 2))}</pre>`,
      pendingWriteId: stage.id,
      onApproved: async () => { state = await api('/api/data/linkbio'); render(); },
    });
  }

  render();
}

import { api } from '../api.js';
import { openApprovalModal, renderLinkbioAddPreview, renderLinkbioUpdatePreview } from '../ui/approval-modal.js';

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
function shorten(u) { return u.length > 40 ? u.slice(0, 37) + '…' : u; }
function iconIsName(s) {
  if (!s) return false;
  // If >1 char and all ASCII alphanumeric, treat as icon-registry name.
  return s.length > 1 && /^[a-z0-9_-]+$/i.test(s);
}

export default async function mount(root) {
  root.innerHTML = '<h2 style="color:var(--gold)">Link-in-Bio</h2><p style="color:var(--silver)">Loading…</p>';
  let state = await api('/api/data/linkbio');

  function render() {
    const rows = state.items.map(i => `
      <li data-id="${escapeHtml(i.linkId)}" class="linkbio-item">
        <span class="drag">⠿</span>
        <span class="icon ${iconIsName(i.icon) ? 'icon-name' : ''}">${escapeHtml(i.icon || '•')}</span>
        <div class="titles">
          <div>${escapeHtml(i.titleAR)}</div>
          <div class="en">${escapeHtml(i.titleEN)}</div>
        </div>
        <a class="url" href="${escapeHtml(i.url)}" target="_blank">${escapeHtml(shorten(i.url))}</a>
        <span class="clicks">${i.clickCount} clicks</span>
        <label class="toggle"><input type="checkbox" ${i.active ? 'checked' : ''} data-id="${escapeHtml(i.linkId)}" data-field="active" /><span>${i.active ? 'ON' : 'OFF'}</span></label>
        <button class="btn-ghost" data-action="edit" data-id="${escapeHtml(i.linkId)}">Edit</button>
        <button class="btn-danger" data-action="delete" data-id="${escapeHtml(i.linkId)}">Delete</button>
      </li>`).join('');

    root.innerHTML = `
      <h2 style="color:var(--gold)">Link-in-Bio</h2>
      <p style="color:var(--silver);margin-bottom:16px">Public page: <a href="https://link-staging.malearnsa.com" target="_blank">link-staging.malearnsa.com</a></p>

      <section style="background:var(--surface);padding:16px;border-radius:10px;margin-bottom:20px">
        <h3 style="color:var(--gold);margin-bottom:12px">Header</h3>
        <div class="form-field"><label>Photo URL</label><input id="h-photo" value="${escapeHtml(state.header.photoURL)}" /></div>
        <div class="form-field"><label>Tagline AR</label><input id="h-ar" value="${escapeHtml(state.header.taglineAR)}" /></div>
        <div class="form-field"><label>Tagline EN</label><input id="h-en" value="${escapeHtml(state.header.taglineEN)}" /></div>
        <button class="btn-primary" id="save-header">Save header</button>
      </section>

      <button class="btn-primary" id="add-btn" style="margin-bottom:12px">+ Add link</button>
      <ul class="linkbio-list">${rows}</ul>`;

    const list = root.querySelector('.linkbio-list');
    if (window.Sortable) {
      window.Sortable.create(list, {
        animation: 150,
        handle: '.drag',
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
    for (const b of root.querySelectorAll('button[data-action=edit]')) b.onclick = () => openEditForm(b.dataset.id);
    for (const b of root.querySelectorAll('button[data-action=delete]')) b.onclick = () => deleteItem(b.dataset.id);
    for (const cb of root.querySelectorAll('input[data-field=active]')) cb.onchange = (e) => toggleActive(e.target);
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
      for (const [k, v] of Object.entries(vals)) if (v !== cur[k]) patch[k] = v;
      if (!Object.keys(patch).length) return;
      const stage = await api('/api/writes/linkbio_update', { method: 'POST', body: JSON.stringify({ linkId: id, patch }) });
      openApprovalModal({
        title: 'Confirm link update', previewHtml: renderLinkbioUpdatePreview(stage.preview), pendingWriteId: stage.id,
        onApproved: async () => { state = await api('/api/data/linkbio'); render(); },
      });
    });
  }
  function showForm(title, initial, onSubmit) {
    const o = document.createElement('div');
    o.className = 'modal-overlay';
    o.innerHTML = `
      <div class="modal-card">
        <h3>${escapeHtml(title)}</h3>
        <div class="form-field"><label>Title AR</label><input id="titleAR" value="${escapeHtml(initial.titleAR || '')}" /></div>
        <div class="form-field"><label>Title EN</label><input id="titleEN" value="${escapeHtml(initial.titleEN || '')}" /></div>
        <div class="form-field"><label>URL</label><input id="url" value="${escapeHtml(initial.url || '')}" /></div>
        <div class="form-field"><label>Icon / emoji</label><input id="icon" value="${escapeHtml(initial.icon || '')}" /></div>
        <div class="form-field"><label>Description (optional)</label><input id="description" value="${escapeHtml(initial.description || '')}" /></div>
        <div class="modal-actions">
          <button class="btn-ghost" id="cancel">Cancel</button>
          <button class="btn-primary" id="ok">Preview</button>
        </div>
        <div class="modal-msg" id="msg"></div>
      </div>`;
    document.body.appendChild(o);
    o.querySelector('#cancel').onclick = () => o.remove();
    o.querySelector('#ok').onclick = async () => {
      const vals = ['titleAR','titleEN','url','icon','description'].reduce((a, k) => (a[k] = o.querySelector('#'+k).value, a), {});
      try { o.remove(); await onSubmit(vals); } catch (e) { o.querySelector('#msg').textContent = 'Error: '+e.message; }
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
  async function toggleActive(cb) {
    const id = cb.dataset.id; const to = cb.checked;
    cb.disabled = true; cb.checked = !to;
    const stage = await api('/api/writes/linkbio_update', {
      method: 'POST',
      body: JSON.stringify({ linkId: id, patch: { active: to } }),
    });
    openApprovalModal({
      title: 'Confirm toggle', previewHtml: renderLinkbioUpdatePreview(stage.preview), pendingWriteId: stage.id,
      onApproved: async () => { state = await api('/api/data/linkbio'); render(); },
      onRejected: () => { cb.disabled = false; },
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
      previewHtml: `<pre style="white-space:pre-wrap;font:inherit;background:var(--surface2);padding:10px;border-radius:6px">${escapeHtml(JSON.stringify(stage.preview, null, 2))}</pre>`,
      pendingWriteId: stage.id,
      onApproved: async () => { state = await api('/api/data/linkbio'); render(); },
    });
  }

  render();
}

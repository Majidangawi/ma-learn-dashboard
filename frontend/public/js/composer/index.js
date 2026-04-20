import { BLOCK_TYPES, VARIABLES, newId, withIds, stripIds } from './blocks.js';
import { openBlockPicker } from './picker.js';
import { renderPreview } from './preview.js';

/**
 * mountComposer({ root, initialBlocks, language, onChange }) → { getBlocks, destroy }
 * - root: HTMLElement to render into
 * - initialBlocks: array of Block (matches backend schema)
 * - language: 'AR' | 'EN'
 * - onChange: (blocks) => void; fires on every edit (already without __id)
 */
export function mountComposer({ root, initialBlocks = [], language = 'AR', onChange }) {
  let blocks = withIds(initialBlocks.length ? initialBlocks : [BLOCK_TYPES.text.default()]);
  let lang = language;
  let sampleVars = {
    name: 'Majid', product: 'T3', token: 'MA-XXX', course: 'Creative AI',
    module: 'Module 4', nextModule: 'Module 5', playerURL: 'https://player.malearnsa.com/m4',
    unsubscribeUrl: 'https://x/u/demo',
  };

  root.innerHTML = `
    <div class="composer-wrap">
      <div class="composer-panel">
        <div class="composer-toolbar">
          <label>Language:
            <select class="composer-lang">
              <option value="AR" ${lang === 'AR' ? 'selected' : ''}>العربية</option>
              <option value="EN" ${lang === 'EN' ? 'selected' : ''}>English</option>
            </select>
          </label>
        </div>
        <div class="composer-blocks"></div>
        <button type="button" class="composer-add">＋ Add block</button>
      </div>
      <div class="composer-preview">
        <div class="composer-preview-label">Live preview</div>
        <div class="composer-preview-frame"></div>
      </div>
    </div>`;

  const blocksEl = root.querySelector('.composer-blocks');
  const previewEl = root.querySelector('.composer-preview-frame');
  const addBtn = root.querySelector('.composer-add');
  const langSel = root.querySelector('.composer-lang');

  // emit() = data changed, preview + onChange must refresh, but DO NOT rebuild
  // the block DOM (that kills input focus mid-typing). renderAll() is only
  // called on structural edits (add/remove/reorder block).
  let previewTimer = null;
  function emit() {
    const clean = stripIds(blocks);
    onChange && onChange(clean);
    // Debounce preview re-render so typing stays snappy and the iframe doesn't
    // thrash on every keystroke.
    clearTimeout(previewTimer);
    previewTimer = setTimeout(renderPreviewPane, 250);
  }

  function renderPreviewPane() {
    const html = renderPreview(stripIds(blocks), lang, sampleVars);
    previewEl.innerHTML = `<iframe sandbox srcdoc="${escapeAttr(`<!doctype html><html><body style='margin:0;background:#0E0E0E;padding:16px'>${html}</body></html>`)}"></iframe>`;
  }

  function renderAll() {
    blocksEl.innerHTML = '';
    blocks.forEach((b, i) => blocksEl.appendChild(renderBlock(b, i)));
    renderPreviewPane();
  }

  // Full rebuild after structural change (add/remove/reorder).
  function rebuild() {
    const clean = stripIds(blocks);
    onChange && onChange(clean);
    renderAll();
  }

  function renderBlock(b, i) {
    const def = BLOCK_TYPES[b.type];
    const wrap = document.createElement('div');
    wrap.className = 'composer-block';
    wrap.dataset.id = b.__id;
    wrap.innerHTML = `
      <div class="composer-block-handle" title="Drag to reorder">⋮⋮</div>
      <div class="composer-block-body"></div>
      <div class="composer-block-actions">
        <button type="button" class="composer-del" title="Delete block">×</button>
      </div>`;
    wrap.querySelector('.composer-block-body').appendChild(renderBlockForm(b));
    wrap.querySelector('.composer-del').onclick = () => { blocks.splice(i, 1); rebuild(); };

    // Drag and drop reorder (lightweight, no lib)
    const handle = wrap.querySelector('.composer-block-handle');
    handle.draggable = true;
    handle.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', String(i)); });
    wrap.addEventListener('dragover', (e) => e.preventDefault());
    wrap.addEventListener('drop', (e) => {
      e.preventDefault();
      const from = Number(e.dataTransfer.getData('text/plain'));
      if (from === i) return;
      const [moved] = blocks.splice(from, 1);
      blocks.splice(i, 0, moved);
      rebuild();
    });
    return wrap;
  }

  function renderBlockForm(b) {
    const el = document.createElement('div');
    switch (b.type) {
      case 'text': {
        const ta = document.createElement('textarea');
        ta.rows = 3; ta.dir = lang === 'AR' ? 'rtl' : 'ltr';
        ta.placeholder = 'Type text, or press / for variables';
        ta.value = b.content;
        ta.oninput = () => { b.content = ta.value; emit(); };
        ta.onkeydown = (e) => {
          if (e.key === '/') setTimeout(() => openVariablePicker(ta, (key) => {
            const pos = ta.selectionStart;
            // Remove the just-typed "/"
            const before = ta.value.slice(0, pos - 1);
            const after = ta.value.slice(pos);
            ta.value = before + '{' + key + '}' + after;
            b.content = ta.value; emit();
          }), 0);
        };
        el.appendChild(ta);
        break;
      }
      case 'heading': {
        const inp = document.createElement('input');
        inp.dir = lang === 'AR' ? 'rtl' : 'ltr';
        inp.placeholder = 'Heading text';
        inp.value = b.text;
        inp.oninput = () => { b.text = inp.value; emit(); };
        el.appendChild(inp);
        break;
      }
      case 'banner': {
        el.innerHTML = `
          <label>Image URL or Upload</label>
          <div style="display:flex;gap:8px;align-items:center">
            <input class="b-url" placeholder="https://..." value="${escapeAttr(b.url)}" style="flex:1" />
            <input type="file" accept="image/*" class="b-file" style="display:none" />
            <button type="button" class="b-upload btn-ghost">Upload</button>
          </div>
          <label>Alt text</label>
          <input class="b-alt" value="${escapeAttr(b.alt)}" placeholder="Short description" />
          <label>Optional link</label>
          <input class="b-link" value="${escapeAttr(b.link || '')}" placeholder="https://..." />`;
        el.querySelector('.b-url').oninput = (e) => { b.url = e.target.value; emit(); };
        el.querySelector('.b-alt').oninput = (e) => { b.alt = e.target.value; emit(); };
        el.querySelector('.b-link').oninput = (e) => { b.link = e.target.value; emit(); };
        el.querySelector('.b-upload').onclick = () => el.querySelector('.b-file').click();
        el.querySelector('.b-file').onchange = async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const msg = document.createElement('span');
          msg.textContent = 'Uploading…';
          el.appendChild(msg);
          try {
            const { url } = await uploadImage(file);
            b.url = url;
            el.querySelector('.b-url').value = url;
            emit();
          } catch (err) {
            msg.textContent = 'Upload failed: ' + err.message;
            return;
          }
          msg.remove();
        };
        break;
      }
      case 'cta': {
        el.innerHTML = `
          <label>Button label</label>
          <input class="b-label" value="${escapeAttr(b.label)}" placeholder="Watch now" />
          <label>URL</label>
          <input class="b-url" value="${escapeAttr(b.url)}" placeholder="https://..." />
          <label>Color</label>
          <select class="b-color">
            <option value="gold" ${b.color === 'gold' ? 'selected' : ''}>Gold</option>
            <option value="black" ${b.color === 'black' ? 'selected' : ''}>Black</option>
          </select>`;
        el.querySelector('.b-label').oninput = (e) => { b.label = e.target.value; emit(); };
        el.querySelector('.b-url').oninput = (e) => { b.url = e.target.value; emit(); };
        el.querySelector('.b-color').onchange = (e) => { b.color = e.target.value; emit(); };
        break;
      }
      case 'bullet_list': {
        const ta = document.createElement('textarea');
        ta.rows = 4; ta.dir = lang === 'AR' ? 'rtl' : 'ltr';
        ta.placeholder = 'One item per line';
        ta.value = (b.items || []).join('\n');
        ta.oninput = () => { b.items = ta.value.split('\n'); emit(); };
        el.appendChild(ta);
        break;
      }
      case 'divider':
        el.innerHTML = '<em style="color:#888">— divider —</em>';
        break;
    }
    return el;
  }

  function openVariablePicker(targetTextarea, onPick) {
    const rect = targetTextarea.getBoundingClientRect();
    const pop = document.createElement('div');
    pop.className = 'variable-picker';
    pop.style.position = 'absolute';
    pop.style.top = `${window.scrollY + rect.top - 10}px`;
    pop.style.left = `${window.scrollX + rect.left + 100}px`;
    pop.innerHTML = VARIABLES.map(v => `<button type="button" data-k="${v.key}">{${v.key}} · ${v.label}</button>`).join('');
    document.body.appendChild(pop);
    const close = () => { document.removeEventListener('click', onDoc); pop.remove(); };
    const onDoc = (e) => { if (!pop.contains(e.target)) close(); };
    setTimeout(() => document.addEventListener('click', onDoc), 0);
    pop.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-k]');
      if (!btn) return;
      onPick(btn.dataset.k);
      close();
    });
  }

  async function uploadImage(file) {
    const dataBase64 = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(',')[1]);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
    const res = await fetch((window.__MA_DASHBOARD_API__ || '/api') + '/api/writes/upload_email_image', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, contentType: file.type, dataBase64 }),
    });
    if (!res.ok) throw new Error('http_' + res.status);
    return res.json();
  }

  addBtn.addEventListener('click', () => {
    openBlockPicker(addBtn, (newBlock) => {
      blocks.push({ ...newBlock, __id: newId() });
      rebuild();
    });
  });

  langSel.addEventListener('change', () => {
    lang = langSel.value;
    rebuild();
  });

  renderAll();

  return {
    getBlocks: () => stripIds(blocks),
    getLanguage: () => lang,
    destroy: () => { root.innerHTML = ''; },
  };
}

function escapeAttr(s) {
  return String(s ?? '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

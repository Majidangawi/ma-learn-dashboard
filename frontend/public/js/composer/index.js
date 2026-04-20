import { BLOCK_TYPES, VARIABLES, newId, withIds, stripIds } from './blocks.js';
import { openBlockPicker } from './picker.js';
import { renderPreview } from './preview.js';
import { API_BASE } from '../api.js';

/**
 * mountComposer({ root, initialBlocks, language, onChange, getHeader }) → composer handle
 * - root: HTMLElement to render into
 * - initialBlocks: array of Block (matches backend schema)
 * - language: 'AR' | 'EN'
 * - onChange: (blocks) => void; fires on every edit (already without __id)
 * - getHeader (optional): () => { subject, preheader } — when provided, the
 *   live preview shows an inbox-style header (subject bold + preheader gray).
 *   Call the returned handle's refreshPreview() when subject/preheader change.
 *
 * Returned handle: { getBlocks, getLanguage, refreshPreview, destroy }
 */

// Dropbox share links with ?dl=1 force a download; for inline <img> rendering
// we need ?raw=1 instead. Rewrite automatically so Majid can paste either form.
function normalizeImageUrl(url) {
  if (!url) return url;
  if (/^https?:\/\/(www\.)?dropbox\.com\//.test(url)) {
    return url.replace(/([?&])dl=1(\b|$)/, '$1raw=1$2');
  }
  return url;
}

export function mountComposer({ root, initialBlocks = [], language = 'AR', onChange, getHeader }) {
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
    // Normalize any Dropbox dl=1 links in banner blocks so they render inline.
    const previewBlocks = stripIds(blocks).map(b =>
      b.type === 'banner' ? { ...b, url: normalizeImageUrl(b.url) } : b
    );
    const bodyHtml = renderPreview(previewBlocks, lang, sampleVars);

    // Inbox-style header (subject + preheader) if the parent provided them.
    let header = '';
    if (typeof getHeader === 'function') {
      const h = getHeader() || {};
      const subj = h.subject || '';
      const pre = h.preheader || '';
      if (subj || pre) {
        const isAR = lang === 'AR';
        const dir = isAR ? 'rtl' : 'ltr';
        header = `
<div dir="${dir}" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto 12px;padding:12px 16px;background:#fff;border-radius:6px;border:1px solid #e5e5e5;">
  <div style="color:#111;font-weight:bold;font-size:.95rem;margin-bottom:4px;">${escapeHtml(subj) || '<span style="color:#bbb;">(no subject)</span>'}</div>
  <div style="color:#888;font-size:.82rem;">${escapeHtml(pre) || '<span style="color:#ccc;">(no preheader)</span>'}</div>
</div>`;
      }
    }

    const fullHtml = header + bodyHtml;
    const srcdoc = escapeAttr(`<!doctype html><html><body style='margin:0;background:#0E0E0E;padding:16px' onload='parent.postMessage({type:"composer-preview-ready"},"*")'>${fullHtml}</body></html>`);

    // Preserve the iframe's scroll position across re-renders so typing doesn't
    // jump back to the top. We reuse the existing iframe when possible and
    // capture scrollY before swapping srcdoc.
    let iframe = previewEl.querySelector('iframe');
    let savedScroll = 0;
    try {
      if (iframe && iframe.contentWindow) savedScroll = iframe.contentWindow.scrollY || 0;
    } catch (_) { /* cross-origin-ish, ignore */ }

    if (!iframe) {
      previewEl.innerHTML = '';
      iframe = document.createElement('iframe');
      iframe.setAttribute('sandbox', 'allow-same-origin');
      previewEl.appendChild(iframe);
    }
    iframe.srcdoc = srcdoc.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
    // Restore scroll once the new doc has rendered.
    iframe.addEventListener('load', function onLoad() {
      iframe.removeEventListener('load', onLoad);
      try { iframe.contentWindow.scrollTo(0, savedScroll); } catch (_) {}
    });
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

    // Drag + drop reorder. The drag handle (⋮⋮) is the draggable element; the
    // whole block is the drop target. We show a gold indicator line above or
    // below the target depending on whether the cursor is in the top or bottom
    // half of the hovered block.
    const handle = wrap.querySelector('.composer-block-handle');
    handle.draggable = true;
    handle.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', String(i));
      e.dataTransfer.effectAllowed = 'move';
      wrap.classList.add('dragging');
    });
    handle.addEventListener('dragend', () => {
      wrap.classList.remove('dragging');
      blocksEl.querySelectorAll('.drop-above, .drop-below').forEach(el => {
        el.classList.remove('drop-above', 'drop-below');
      });
    });
    wrap.addEventListener('dragover', (e) => {
      e.preventDefault();
      const rect = wrap.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      const above = e.clientY < mid;
      blocksEl.querySelectorAll('.drop-above, .drop-below').forEach(el => {
        if (el !== wrap) el.classList.remove('drop-above', 'drop-below');
      });
      wrap.classList.toggle('drop-above', above);
      wrap.classList.toggle('drop-below', !above);
    });
    wrap.addEventListener('dragleave', (e) => {
      // Only clear when leaving the wrap entirely, not when moving between
      // inner children (relatedTarget is outside the wrap).
      if (!wrap.contains(e.relatedTarget)) {
        wrap.classList.remove('drop-above', 'drop-below');
      }
    });
    wrap.addEventListener('drop', (e) => {
      e.preventDefault();
      const from = Number(e.dataTransfer.getData('text/plain'));
      const insertAbove = wrap.classList.contains('drop-above');
      wrap.classList.remove('drop-above', 'drop-below');
      if (Number.isNaN(from) || from === i) return;
      const [moved] = blocks.splice(from, 1);
      // After removing `from`, target index shifts down by 1 if from < i.
      let insertAt = from < i ? i - 1 : i;
      if (!insertAbove) insertAt += 1;
      blocks.splice(insertAt, 0, moved);
      rebuild();
    });
    return wrap;
  }

  function renderBlockForm(b) {
    const el = document.createElement('div');
    switch (b.type) {
      case 'text': {
        const editor = makeRichEditor({
          html: b.content || '',
          dir: lang === 'AR' ? 'rtl' : 'ltr',
          placeholder: 'Type text. Select a word + use the floating toolbar for bold / italic / link. Type / for variables.',
          onChange: (html) => { b.content = html; emit(); },
          onSlash: (ta) => openVariablePicker(ta, (key) => insertTextAtCursor(ta, `{${key}}`, (h) => { b.content = h; emit(); })),
        });
        el.appendChild(editor);
        break;
      }
      case 'heading': {
        const level = b.level || 2;
        const bold = b.bold !== false;
        const italic = !!b.italic;
        el.innerHTML = `
          <div style="display:flex;gap:10px;align-items:center;margin-bottom:6px;flex-wrap:wrap">
            <label style="margin:0;display:flex;align-items:center;gap:6px">
              <span style="color:#888;font-size:.8rem">Size</span>
              <select class="h-level" style="width:auto">
                <option value="1" ${level === 1 ? 'selected' : ''}>H1 · massive</option>
                <option value="2" ${level === 2 ? 'selected' : ''}>H2 · huge</option>
                <option value="3" ${level === 3 ? 'selected' : ''}>H3 · big</option>
              </select>
            </label>
            <button type="button" class="h-bold ${bold ? 'active' : ''}" title="Bold heading" style="padding:4px 10px;background:${bold ? '#C9A84C' : '#1a1a1a'};color:${bold ? '#000' : '#ddd'};border:1px solid #333;border-radius:4px;cursor:pointer;font-weight:bold;">B</button>
            <button type="button" class="h-italic ${italic ? 'active' : ''}" title="Italic heading" style="padding:4px 10px;background:${italic ? '#C9A84C' : '#1a1a1a'};color:${italic ? '#000' : '#ddd'};border:1px solid #333;border-radius:4px;cursor:pointer;font-style:italic;">I</button>
          </div>
          <div class="h-text-mount"></div>
          <label style="margin-top:8px">Subheading (optional — smaller gray line under the heading)</label>
          <input class="h-sub" dir="${lang === 'AR' ? 'rtl' : 'ltr'}" placeholder="Optional supporting line" value="${escapeAttr(b.subtext || '')}" />
        `;
        const headingEditor = makeRichEditor({
          html: b.text || '',
          dir: lang === 'AR' ? 'rtl' : 'ltr',
          placeholder: 'Heading text',
          singleLine: true,
          onChange: (html) => { b.text = html; emit(); },
          onSlash: (ta) => openVariablePicker(ta, (key) => insertTextAtCursor(ta, `{${key}}`, (h) => { b.text = h; emit(); })),
        });
        el.querySelector('.h-text-mount').appendChild(headingEditor);
        el.querySelector('.h-level').onchange = (e) => { b.level = Number(e.target.value); emit(); renderAll(); };
        el.querySelector('.h-bold').onclick = () => { b.bold = !(b.bold !== false); emit(); renderAll(); };
        el.querySelector('.h-italic').onclick = () => { b.italic = !b.italic; emit(); renderAll(); };
        el.querySelector('.h-sub').oninput = (e) => { b.subtext = e.target.value; emit(); };
        break;
      }
      case 'banner': {
        const showToggleId = `show-pv-${b.__id}`;
        const progress = b.__upload && b.__upload.status === 'uploading'
          ? `<div class="upload-bar"><div class="upload-bar-fill" style="width:${b.__upload.progress || 0}%"></div><div class="upload-bar-label">Uploading ${Math.round(b.__upload.progress || 0)}%</div></div>`
          : '';
        const errorMsg = b.__upload && b.__upload.status === 'error'
          ? `<div style="color:#ff6b6b;font-size:.82rem;margin:6px 0;">Upload failed: ${escapeHtml(b.__upload.error || '')}</div>`
          : '';
        el.innerHTML = `
          <label>Image URL or Upload</label>
          <div style="display:flex;gap:8px;align-items:center">
            <input class="b-url" placeholder="https://..." value="${escapeAttr(b.url)}" style="flex:1" />
            <input type="file" accept="image/*" class="b-file" style="display:none" />
            <button type="button" class="b-upload btn-ghost" ${b.__upload && b.__upload.status === 'uploading' ? 'disabled' : ''}>${b.__upload && b.__upload.status === 'uploading' ? 'Uploading…' : 'Upload'}</button>
          </div>
          ${progress}${errorMsg}
          <label title="Shown to screen readers + shown instead of the image when the email client blocks images (Gmail does this by default). Keep it short + descriptive.">Alt text <span style="color:#888;font-size:.8rem;">(for screen readers + image-blocked inboxes)</span></label>
          <input class="b-alt" value="${escapeAttr(b.alt)}" placeholder="Short description" />
          <label>Optional link (wraps image)</label>
          <input class="b-link" value="${escapeAttr(b.link || '')}" placeholder="https://..." />
          <label style="display:flex;align-items:center;gap:8px;margin-top:10px;cursor:pointer">
            <input type="checkbox" id="${showToggleId}" ${b.visibleInPreview === false ? '' : 'checked'} style="width:auto" />
            <span style="color:#ccc;font-size:.85rem;">Show in live preview (the image still sends in the email either way)</span>
          </label>`;
        el.querySelector('.b-url').oninput = (e) => { b.url = e.target.value; emit(); };
        el.querySelector('.b-alt').oninput = (e) => { b.alt = e.target.value; emit(); };
        el.querySelector('.b-link').oninput = (e) => { b.link = e.target.value; emit(); };
        el.querySelector(`#${showToggleId}`).onchange = (e) => {
          b.visibleInPreview = e.target.checked;
          emit();
        };
        el.querySelector('.b-upload').onclick = () => el.querySelector('.b-file').click();
        el.querySelector('.b-file').onchange = (e) => {
          const file = e.target.files[0];
          if (!file) return;
          startUpload(b, file);
        };
        break;
      }
      case 'quote': {
        const ta = document.createElement('textarea');
        ta.rows = 3; ta.dir = lang === 'AR' ? 'rtl' : 'ltr';
        ta.placeholder = 'A quote or emphasized line. Renders in a gold-accent box.';
        ta.value = b.text;
        ta.oninput = () => { b.text = ta.value; emit(); };
        el.appendChild(ta);
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

  // Rich-text contentEditable editor. Returns the DOM node to mount.
  // Floating toolbar (B / I / 🔗) appears above a selection when the user
  // highlights text inside this editor. `/` triggers the variable picker.
  function makeRichEditor({ html, dir, placeholder, onChange, onSlash, singleLine }) {
    const ed = document.createElement('div');
    ed.className = 'rich-editor' + (singleLine ? ' single-line' : '');
    ed.contentEditable = 'true';
    ed.dir = dir;
    ed.setAttribute('data-placeholder', placeholder || '');
    // contentEditable doesn't take `value` — we set innerHTML once, then let
    // the browser handle editing. DON'T re-set it on every keystroke; that
    // wipes the caret.
    ed.innerHTML = html || '';

    // Sanitize on paste — strip everything except B/I/U/A/BR.
    ed.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text/plain');
      document.execCommand('insertText', false, text);
    });

    ed.addEventListener('input', () => {
      onChange && onChange(ed.innerHTML);
    });

    // Single-line headings: swallow Enter to prevent newlines.
    if (singleLine) {
      ed.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') e.preventDefault();
      });
    }

    // Slash command for variable picker.
    ed.addEventListener('keyup', (e) => {
      if (e.key !== '/') return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      // Only trigger when the "/" is the just-typed char right before caret.
      const offset = range.startOffset;
      const node = range.startContainer;
      if (node.nodeType === 3 && node.textContent[offset - 1] === '/') {
        // Remove the "/" we just typed.
        node.textContent = node.textContent.slice(0, offset - 1) + node.textContent.slice(offset);
        // Place caret at previous position.
        const newRange = document.createRange();
        newRange.setStart(node, offset - 1);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
        onSlash && onSlash(ed);
      }
    });

    // Floating format toolbar on selection.
    ed.addEventListener('mouseup', () => maybeShowFormatToolbar(ed));
    ed.addEventListener('keyup', () => maybeShowFormatToolbar(ed));

    return ed;
  }

  // Insert text at the current caret position inside a contentEditable div.
  function insertTextAtCursor(editor, text, onChange) {
    editor.focus();
    document.execCommand('insertText', false, text);
    onChange && onChange(editor.innerHTML);
  }

  let currentToolbar = null;
  function maybeShowFormatToolbar(editor) {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      hideFormatToolbar();
      return;
    }
    if (!editor.contains(sel.anchorNode)) return;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    if (!rect.width) return;
    showFormatToolbar(rect, editor);
  }
  function hideFormatToolbar() {
    if (currentToolbar) { currentToolbar.remove(); currentToolbar = null; }
  }
  function showFormatToolbar(rect, editor) {
    hideFormatToolbar();
    const bar = document.createElement('div');
    bar.className = 'format-toolbar';
    bar.innerHTML = `
      <button type="button" data-cmd="bold" title="Bold (Cmd+B)"><b>B</b></button>
      <button type="button" data-cmd="italic" title="Italic (Cmd+I)"><i>I</i></button>
      <button type="button" data-cmd="underline" title="Underline"><u>U</u></button>
      <button type="button" data-cmd="link" title="Link">🔗</button>
      <button type="button" data-cmd="unlink" title="Remove link">⌀</button>`;
    document.body.appendChild(bar);
    // Position above the selection, clamp to viewport.
    const barH = bar.offsetHeight;
    const barW = bar.offsetWidth;
    let top = rect.top - barH - 8;
    if (top < 12) top = rect.bottom + 8;
    let left = rect.left + rect.width / 2 - barW / 2;
    if (left + barW > window.innerWidth - 12) left = window.innerWidth - barW - 12;
    if (left < 12) left = 12;
    bar.style.position = 'fixed';
    bar.style.top = `${top}px`;
    bar.style.left = `${left}px`;

    bar.addEventListener('mousedown', (e) => e.preventDefault());  // keep selection
    bar.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-cmd]');
      if (!btn) return;
      const cmd = btn.dataset.cmd;
      editor.focus();
      if (cmd === 'link') {
        const url = prompt('Link URL (include https://):');
        if (url) document.execCommand('createLink', false, url);
        // Apply target=_blank to the new link.
        const sel = window.getSelection();
        if (sel && sel.anchorNode && sel.anchorNode.parentElement && sel.anchorNode.parentElement.tagName === 'A') {
          sel.anchorNode.parentElement.setAttribute('target', '_blank');
          sel.anchorNode.parentElement.setAttribute('rel', 'noopener');
        }
      } else if (cmd === 'unlink') {
        document.execCommand('unlink');
      } else {
        document.execCommand(cmd);
      }
      editor.dispatchEvent(new Event('input'));
      hideFormatToolbar();
    });
    currentToolbar = bar;

    // Close on click elsewhere or escape.
    setTimeout(() => {
      const onDoc = (e) => {
        if (!bar.contains(e.target) && !editor.contains(e.target)) hideFormatToolbar();
      };
      const onKey = (e) => { if (e.key === 'Escape') hideFormatToolbar(); };
      document.addEventListener('mousedown', onDoc, { once: false });
      document.addEventListener('keydown', onKey, { once: true });
      bar.__cleanup = () => document.removeEventListener('mousedown', onDoc);
    }, 0);
  }

  function openVariablePicker(targetTextarea, onPick) {
    const rect = targetTextarea.getBoundingClientRect();
    const pop = document.createElement('div');
    pop.className = 'variable-picker';
    pop.style.position = 'fixed';
    pop.innerHTML = VARIABLES.map(v => `<button type="button" data-k="${v.key}">{${v.key}} · ${v.label}</button>`).join('');
    document.body.appendChild(pop);

    // Clamp to viewport after measuring.
    const popH = pop.offsetHeight;
    const popW = pop.offsetWidth;
    let top = rect.top - 10;
    if (top + popH > window.innerHeight - 12) top = window.innerHeight - popH - 12;
    if (top < 12) top = 12;
    let left = rect.left + 100;
    if (left + popW > window.innerWidth - 12) left = window.innerWidth - popW - 12;
    if (left < 12) left = 12;
    pop.style.top = `${top}px`;
    pop.style.left = `${left}px`;

    const close = () => {
      document.removeEventListener('click', onDoc);
      document.removeEventListener('keydown', onKey);
      pop.remove();
    };
    const onDoc = (e) => { if (!pop.contains(e.target)) close(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    setTimeout(() => {
      document.addEventListener('click', onDoc);
      document.addEventListener('keydown', onKey);
    }, 0);
    pop.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-k]');
      if (!btn) return;
      onPick(btn.dataset.k);
      close();
    });
  }

  // Start an image upload on a block. Tracks progress on the block's `__upload`
  // field so the progress bar survives DOM rebuilds (e.g. user adds another
  // block mid-upload). On success, updates b.url + triggers preview refresh.
  function startUpload(b, file) {
    b.__upload = { status: 'reading', progress: 0 };
    renderAll(); // reflect initial state

    const reader = new FileReader();
    reader.onload = () => {
      const dataBase64 = String(reader.result).split(',')[1];

      const xhr = new XMLHttpRequest();
      xhr.open('POST', API_BASE + '/api/writes/upload_email_image', true);
      xhr.withCredentials = true;
      xhr.setRequestHeader('Content-Type', 'application/json');

      // upload.onprogress fires during POST body send — tracks real bytes sent.
      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return;
        b.__upload = { status: 'uploading', progress: Math.round((e.loaded / e.total) * 100) };
        refreshBlockOnly(b);
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const json = JSON.parse(xhr.responseText);
            b.url = json.url;
            delete b.__upload;
            renderAll(); // full rebuild to refresh url input + preview
            emit();
          } catch (err) {
            b.__upload = { status: 'error', error: 'Bad server response' };
            renderAll();
          }
        } else {
          let msg = `HTTP ${xhr.status}`;
          try { msg = JSON.parse(xhr.responseText).error || msg; } catch (_) {}
          if (xhr.status === 413) msg = 'File too large (max 8 MB). Try compressing or use an image URL.';
          b.__upload = { status: 'error', error: msg };
          renderAll();
        }
      };

      xhr.onerror = () => {
        b.__upload = { status: 'error', error: 'Network error' };
        renderAll();
      };

      b.__upload = { status: 'uploading', progress: 0 };
      renderAll();
      xhr.send(JSON.stringify({ filename: file.name, contentType: file.type, dataBase64 }));
    };
    reader.onerror = () => {
      b.__upload = { status: 'error', error: 'Could not read file' };
      renderAll();
    };
    reader.readAsDataURL(file);
  }

  // Update just one block's form DOM (used during upload progress ticks to avoid
  // destroying other blocks' input focus on every progress event).
  function refreshBlockOnly(b) {
    const existing = blocksEl.querySelector(`[data-id="${b.__id}"]`);
    if (!existing) return;
    const idx = blocks.indexOf(b);
    if (idx < 0) return;
    const fresh = renderBlock(b, idx);
    existing.replaceWith(fresh);
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
    refreshPreview: () => { clearTimeout(previewTimer); renderPreviewPane(); },
    destroy: () => { root.innerHTML = ''; },
  };
}

function escapeAttr(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

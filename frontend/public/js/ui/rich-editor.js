// Minimal rich-text editor: Bold, Italic, Underline, Link, Image.
// Used by the Lessons page — the email-style block composer is wrong
// framing for lesson content (no brand wrap, no unsubscribe footer).
// Content is a plain HTML string; images live inline at insertion point.
//
// mountRichEditor({ root, initialHtml, onChange }) → { getHtml, setHtml, destroy }

import { api, API_BASE } from '../api.js';

function iconSvg(name) {
  const s = {
    bold:      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h8a4 4 0 0 1 0 8H6z"/><path d="M6 12h9a4 4 0 0 1 0 8H6z"/></svg>',
    italic:    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="4"  x2="10" y2="4"/><line x1="14" y1="20" x2="5"  y2="20"/><line x1="15" y1="4"  x2="9"  y2="20"/></svg>',
    underline: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3v7a6 6 0 0 0 12 0V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg>',
    link:      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
    image:     '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>',
  };
  return s[name] || '';
}

export function mountRichEditor({ root, initialHtml = '', onChange }) {
  root.innerHTML = `
    <div class="rte-wrap">
      <div class="rte-toolbar" role="toolbar">
        <button type="button" class="rte-btn" data-ui="btn" data-variant="ghost" data-size="sm" data-cmd="bold"        title="Bold (Cmd/Ctrl+B)">${iconSvg('bold')}</button>
        <button type="button" class="rte-btn" data-ui="btn" data-variant="ghost" data-size="sm" data-cmd="italic"      title="Italic (Cmd/Ctrl+I)">${iconSvg('italic')}</button>
        <button type="button" class="rte-btn" data-ui="btn" data-variant="ghost" data-size="sm" data-cmd="underline"   title="Underline (Cmd/Ctrl+U)">${iconSvg('underline')}</button>
        <span class="rte-sep"></span>
        <button type="button" class="rte-btn" data-ui="btn" data-variant="ghost" data-size="sm" data-action="link"     title="Insert link">${iconSvg('link')} Link</button>
        <button type="button" class="rte-btn" data-ui="btn" data-variant="ghost" data-size="sm" data-action="image"    title="Insert image">${iconSvg('image')} Image</button>
        <span class="rte-spinner" hidden>uploading…</span>
      </div>
      <div class="rte-editor" contenteditable="true" spellcheck="true"></div>
      <input type="file" class="rte-file" accept="image/*" hidden />
    </div>`;

  const editor  = root.querySelector('.rte-editor');
  const fileIn  = root.querySelector('.rte-file');
  const spinner = root.querySelector('.rte-spinner');
  editor.innerHTML = initialHtml || '<p></p>';

  function emit() { onChange && onChange(editor.innerHTML); }

  function exec(cmd, value) {
    editor.focus();
    document.execCommand(cmd, false, value);
    emit();
  }

  function insertHtmlAtCursor(html) {
    editor.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      editor.insertAdjacentHTML('beforeend', html);
    } else {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      const frag = document.createDocumentFragment();
      let node, last;
      while ((node = tmp.firstChild)) { last = frag.appendChild(node); }
      range.insertNode(frag);
      if (last) {
        range.setStartAfter(last);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
    emit();
  }

  root.querySelector('.rte-toolbar').addEventListener('click', async (e) => {
    const btn = e.target.closest('button.rte-btn');
    if (!btn) return;
    const cmd = btn.dataset.cmd;
    const action = btn.dataset.action;
    if (cmd) { exec(cmd); return; }
    if (action === 'link') {
      const url = prompt('URL:');
      if (!url) return;
      exec('createLink', url);
      return;
    }
    if (action === 'image') {
      fileIn.click();
      return;
    }
  });

  fileIn.addEventListener('change', async () => {
    const f = fileIn.files && fileIn.files[0];
    fileIn.value = '';
    if (!f) return;
    if (!/^image\//.test(f.type)) { alert('Please pick an image file'); return; }
    if (f.size > 8_000_000) { alert('Image too large (max 8 MB)'); return; }
    spinner.hidden = false;
    try {
      const dataBase64 = await fileToBase64(f);
      const r = await api('/api/writes/upload_email_image', {
        method: 'POST',
        body: JSON.stringify({ filename: f.name, contentType: f.type, dataBase64 }),
      });
      if (!r || !r.url) throw new Error('No URL returned');
      insertHtmlAtCursor(`<img src="${r.url}" alt="${escapeAttr(f.name)}" style="max-width:100%;height:auto;display:block;margin:8px 0" />`);
    } catch (err) {
      alert('Image upload failed: ' + err.message);
    } finally {
      spinner.hidden = true;
    }
  });

  editor.addEventListener('input', emit);

  return {
    getHtml: () => editor.innerHTML,
    setHtml: (html) => { editor.innerHTML = html || ''; emit(); },
    destroy: () => { root.innerHTML = ''; },
  };
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result || '');
      const comma = s.indexOf(',');
      resolve(comma >= 0 ? s.slice(comma + 1) : s);
    };
    reader.onerror = () => reject(new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

function escapeAttr(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Client-side preview renderer. Mirrors backend/src/mail/blocks.ts.
// Any change in brand styling must be reflected in both files.

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function substitute(s, vars) {
  return s.replace(/\{(\w+)\}/g, (m, k) => (vars && k in vars ? esc(vars[k]) : m));
}

function renderBlock(block, vars, isAR) {
  switch (block.type) {
    case 'text':
      return `<p style="color:#222;margin:12px 0;">${substitute(esc(block.content), vars).replace(/\n/g, '<br>')}</p>`;
    case 'heading':
      return `<p style="font-size:1.15rem;font-weight:bold;color:#222;margin:22px 0 10px;">${substitute(esc(block.text), vars)}</p>`;
    case 'banner': {
      // Banner blocks can be toggled invisible in preview via visibleInPreview=false,
      // but stay in the data and render in the actual email. Helps draft without
      // blowing up the preview with a huge image each time.
      if (block.visibleInPreview === false) {
        return '<div style="background:#faf3d9;border:1px dashed #C9A84C;padding:8px 14px;margin:18px 0;border-radius:6px;font-size:.85rem;color:#7a6614;">🖼 Banner hidden in preview (still sends in email)</div>';
      }
      const img = `<img src="${esc(block.url)}" alt="${esc(block.alt)}" style="max-width:100%;height:auto;border-radius:6px;margin:18px 0;">`;
      return block.link ? `<a href="${esc(block.link)}" style="text-decoration:none;">${img}</a>` : img;
    }
    case 'cta': {
      const color = block.color ?? 'gold';
      const bg = color === 'gold' ? '#C9A84C' : '#0E0E0E';
      const fg = color === 'gold' ? '#0E0E0E' : '#ffffff';
      return `<p style="text-align:center;margin:22px 0;"><a href="${esc(block.url)}" style="display:inline-block;padding:12px 28px;background:${bg};color:${fg};text-decoration:none;border-radius:6px;font-weight:bold;">${esc(block.label)}</a></p>`;
    }
    case 'quote': {
      const borderSide = isAR ? 'border-right' : 'border-left';
      return `<div style="background:#f9f6f0;${borderSide}:3px solid #C9A84C;padding:18px 22px;margin:22px 0;border-radius:4px;"><p style="margin:0;color:#222;font-style:italic;">${substitute(esc(block.text), vars).replace(/\n/g, '<br>')}</p></div>`;
    }
    case 'bullet_list': {
      const padSide = isAR ? 'padding-right' : 'padding-left';
      const items = (block.items || []).filter(Boolean).map(i => `<li style="padding:4px 0;color:#444;">${substitute(esc(i), vars)}</li>`).join('');
      return `<ul style="margin:16px 0;${padSide}:22px;list-style:disc;">${items}</ul>`;
    }
    case 'divider':
      return `<hr style="border:none;border-top:1px solid #C9A84C;opacity:0.4;margin:22px 0;">`;
  }
  return '';
}

export function renderPreview(blocks, language, vars) {
  const isAR = language === 'AR';
  const dir = isAR ? 'rtl' : 'ltr';
  const body = blocks.map(b => renderBlock(b, vars || {}, isAR)).join('\n');
  const signature = isAR
    ? `— <strong>ماجد عنقاوي</strong><br><span style="color:#888;font-size:0.85rem;">صناعة الإلهام · MA Learn</span>`
    : `— <strong>Majid Angawi</strong><br><span style="color:#888;font-size:0.85rem;">Making Inspiration · MA Learn</span>`;
  return `<div dir="${dir}" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#222;line-height:1.7;background:#fff;padding:20px;">
${body}
<hr style="border:none;border-top:1px solid #eee;margin:32px 0 20px;">
<p style="margin:0 0 12px;">${signature}</p>
</div>`;
}

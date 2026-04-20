// Client-side preview renderer. Mirrors backend/src/mail/blocks.ts.
// Any change in brand styling must be reflected in both files.

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function substitute(s, vars) {
  return s.replace(/\{(\w+)\}/g, (m, k) => (vars && k in vars ? esc(vars[k]) : m));
}

// Same allowlist as backend sanitizer — keep in sync.
const ALLOWED_TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 'br', 'a', 'span']);
const ALLOWED_ATTRS_BY_TAG = { a: new Set(['href', 'target', 'rel']), span: new Set([]) };
const SAFE_URL_RE = /^(https?:|mailto:|tel:|#|\/)/i;

function sanitizeInlineHtml(html) {
  if (!html) return '';
  let working = String(html)
    .replace(/<\/(?:div|p)>\s*<(?:div|p)[^>]*>/gi, '<br>')
    .replace(/<(?:div|p)[^>]*>/gi, '')
    .replace(/<\/(?:div|p)>/gi, '<br>');
  return working.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (match, close, tag, attrs) => {
    const tagLc = tag.toLowerCase();
    if (!ALLOWED_TAGS.has(tagLc)) return '';
    if (close) return `</${tagLc}>`;
    if (tagLc === 'br') return '<br>';
    const allowed = ALLOWED_ATTRS_BY_TAG[tagLc];
    if (!allowed || allowed.size === 0) return `<${tagLc}>`;
    const kept = [];
    const attrRe = /([a-zA-Z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
    let m;
    while ((m = attrRe.exec(attrs)) !== null) {
      const name = m[1].toLowerCase();
      const value = m[2] ?? m[3] ?? m[4] ?? '';
      if (!allowed.has(name)) continue;
      if (name === 'href' && !SAFE_URL_RE.test(value)) continue;
      if (name === 'target' && value !== '_blank') continue;
      kept.push(`${name}="${value.replace(/"/g, '&quot;')}"`);
    }
    if (tagLc === 'a' && kept.some(k => k.startsWith('target='))) {
      if (!kept.some(k => k.startsWith('rel='))) kept.push('rel="noopener"');
    }
    return `<${tagLc}${kept.length ? ' ' + kept.join(' ') : ''}>`;
  });
}

function substituteInHtml(html, vars) {
  return html.replace(/\{(\w+)\}/g, (m, k) => (vars && k in vars ? esc(vars[k]) : m));
}

function renderBlock(block, vars, isAR) {
  switch (block.type) {
    case 'text':
      return `<p style="color:#222;margin:12px 0;">${substituteInHtml(sanitizeInlineHtml(block.content || ''), vars || {})}</p>`;
    case 'heading': {
      const sizeMap = { 1: '1.75rem', 2: '1.35rem', 3: '1.1rem' };
      const fontSize = sizeMap[block.level || 2] || sizeMap[2];
      const weight = block.bold === false ? 'normal' : 'bold';
      const style = block.italic ? 'italic' : 'normal';
      const headingHtml = `<p style="font-size:${fontSize};font-weight:${weight};font-style:${style};color:#222;margin:22px 0 6px;line-height:1.3;">${substituteInHtml(sanitizeInlineHtml(block.text || ''), vars || {})}</p>`;
      const subtextHtml = block.subtext
        ? `<p style="font-size:0.9rem;color:#888;margin:0 0 14px;line-height:1.5;">${substitute(esc(block.subtext), vars || {})}</p>`
        : '';
      return headingHtml + subtextHtml;
    }
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
      return `<div style="background:#f9f6f0;${borderSide}:3px solid #C9A84C;padding:18px 22px;margin:22px 0;border-radius:4px;"><p style="margin:0;color:#222;font-style:italic;">${substituteInHtml(sanitizeInlineHtml(block.text || ''), vars || {})}</p></div>`;
    }
    case 'bullet_list': {
      const padSide = isAR ? 'padding-right' : 'padding-left';
      const items = (block.items || []).filter(Boolean).map(i => `<li style="padding:4px 0;color:#444;">${substituteInHtml(sanitizeInlineHtml(i || ''), vars || {})}</li>`).join('');
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

export type Block =
  // `content` for text is rich-text HTML (limited subset: b/strong/i/em/u/a/br).
  | { type: 'text'; content: string }
  // `text` for heading is rich-text HTML; `level` controls size (1=massive,
  // 2=huge, 3=big); `subtext` is an optional subheading line in lower-opacity
  // gray below the heading; `bold`/`italic` default to true/false for the
  // whole heading but inline HTML can override per-span.
  | {
      type: 'heading';
      text: string;
      level?: 1 | 2 | 3;
      subtext?: string;
      bold?: boolean;
      italic?: boolean;
    }
  | { type: 'banner'; url: string; alt: string; link?: string; visibleInPreview?: boolean }
  | { type: 'cta'; label: string; url: string; color?: 'gold' | 'black' }
  | { type: 'quote'; text: string }
  | { type: 'bullet_list'; items: string[] }
  | { type: 'divider' };

export type Variables = Record<string, string>;

function esc(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function substitute(s: string, vars: Variables): string {
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? esc(vars[k]) : m));
}

// For HTML content: substitute vars without double-escaping (the surrounding
// content is already sanitized HTML, and var values should be HTML-escaped
// when inserted since they come from user data).
function substituteInHtml(html: string, vars: Variables): string {
  return html.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? esc(vars[k]) : m));
}

// Minimal inline-HTML sanitizer. Allows only a tight allowlist of tags used
// by the rich-text editor — strips everything else, including any attributes
// not explicitly allowed. This is the trust boundary between the composer
// (which emits whatever contentEditable produces) and the rendered email.
//
// Allowed: b, strong, i, em, u, br, a (with href, target, rel only)
// Also: converts <div> / <p> inside content to <br> pairs (plain email flow)
const ALLOWED_TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 'br', 'a', 'span']);
const ALLOWED_ATTRS_BY_TAG: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel']),
  span: new Set([]),  // span allowed but no attrs (used for styling kept inline)
};
const SAFE_URL_RE = /^(https?:|mailto:|tel:|#|\/)/i;

export function sanitizeInlineHtml(html: string): string {
  if (!html) return '';
  // First, normalize <div>/<p> → <br> so pasted multi-paragraph content renders
  // as line breaks inside the text block's <p> wrapper.
  let working = String(html)
    .replace(/<\/(?:div|p)>\s*<(?:div|p)[^>]*>/gi, '<br>')
    .replace(/<(?:div|p)[^>]*>/gi, '')
    .replace(/<\/(?:div|p)>/gi, '<br>');

  // Walk tags, keep allowed ones with allowed attrs, drop everything else.
  return working.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (match, close, tag, attrs) => {
    const tagLc = tag.toLowerCase();
    if (!ALLOWED_TAGS.has(tagLc)) return '';
    if (close) return `</${tagLc}>`;
    if (tagLc === 'br') return '<br>';
    const allowed = ALLOWED_ATTRS_BY_TAG[tagLc];
    if (!allowed || allowed.size === 0) return `<${tagLc}>`;
    const kept: string[] = [];
    const attrRe = /([a-zA-Z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
    let m: RegExpExecArray | null;
    while ((m = attrRe.exec(attrs)) !== null) {
      const name = m[1].toLowerCase();
      const value = m[2] ?? m[3] ?? m[4] ?? '';
      if (!allowed.has(name)) continue;
      if (name === 'href' && !SAFE_URL_RE.test(value)) continue;
      if (name === 'target' && value !== '_blank') continue;
      kept.push(`${name}="${value.replace(/"/g, '&quot;')}"`);
    }
    // Force external links to have rel="noopener" for safety.
    if (tagLc === 'a' && kept.some(k => k.startsWith('target='))) {
      if (!kept.some(k => k.startsWith('rel='))) kept.push('rel="noopener"');
    }
    return `<${tagLc}${kept.length ? ' ' + kept.join(' ') : ''}>`;
  });
}

// Dropbox share links with ?dl=1 return the file with forced download headers,
// which breaks inline <img> rendering in email clients. Rewrite to ?raw=1.
function normalizeImageUrl(url: string): string {
  if (!url) return url;
  if (/^https?:\/\/(www\.)?dropbox\.com\//.test(url)) {
    return url.replace(/([?&])dl=1(\b|$)/, '$1raw=1$2');
  }
  return url;
}

function renderBlock(block: Block, vars: Variables, isAR: boolean): string {
  switch (block.type) {
    case 'text':
      // Text content is rich-text HTML (bold/italic/links). Sanitize against
      // injection, then substitute variables. Paragraph breaks become <br>.
      return `<p style="color:#222;margin:12px 0;">${substituteInHtml(sanitizeInlineHtml(block.content || ''), vars)}</p>`;
    case 'heading': {
      const level = block.level ?? 2;
      const sizeMap: Record<1 | 2 | 3, string> = { 1: '1.75rem', 2: '1.35rem', 3: '1.1rem' };
      const fontSize = sizeMap[level] ?? sizeMap[2];
      // Heading bold/italic are defaults — the inline HTML can override (e.g.
      // user selects half the heading and unbolds it). Default to bold=true.
      const weight = block.bold === false ? 'normal' : 'bold';
      const style = block.italic ? 'italic' : 'normal';
      const headingHtml = `<p style="font-size:${fontSize};font-weight:${weight};font-style:${style};color:#222;margin:22px 0 6px;line-height:1.3;">${substituteInHtml(sanitizeInlineHtml(block.text || ''), vars)}</p>`;
      const subtextHtml = block.subtext
        ? `<p style="font-size:0.9rem;color:#888;margin:0 0 14px;line-height:1.5;">${substitute(esc(block.subtext), vars)}</p>`
        : '';
      return headingHtml + subtextHtml;
    }
    case 'banner': {
      const normalizedUrl = normalizeImageUrl(block.url);
      const img = `<img src="${esc(normalizedUrl)}" alt="${esc(block.alt)}" style="max-width:100%;height:auto;border-radius:6px;margin:18px 0;">`;
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
      const items = block.items.map(i => `<li style="padding:4px 0;color:#444;">${substitute(esc(i), vars)}</li>`).join('');
      return `<ul style="margin:16px 0;${padSide}:22px;list-style:disc;">${items}</ul>`;
    }
    case 'divider':
      return `<hr style="border:none;border-top:1px solid #C9A84C;opacity:0.4;margin:22px 0;">`;
  }
}

export function renderBlocks(blocks: Block[], language: 'AR' | 'EN', vars: Variables): string {
  const isAR = language === 'AR';
  const dir = isAR ? 'rtl' : 'ltr';
  const body = blocks.map(b => renderBlock(b, vars, isAR)).join('\n');
  const signature = isAR
    ? `— <strong>ماجد عنقاوي</strong><br><span style="color:#888;font-size:0.85rem;">صناعة الإلهام · MA Learn</span>`
    : `— <strong>Majid Angawi</strong><br><span style="color:#888;font-size:0.85rem;">Making Inspiration · MA Learn</span>`;
  const unsub = isAR
    ? `لإلغاء الاشتراك، <a href="{unsubscribeUrl}" style="color:#888;">اضغط هنا</a>.`
    : `To unsubscribe, <a href="{unsubscribeUrl}" style="color:#888;">click here</a>.`;
  return `<div dir="${dir}" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#222;line-height:1.7;">
${body}
<hr style="border:none;border-top:1px solid #eee;margin:32px 0 20px;">
<p style="margin:0 0 12px;">${signature}</p>
<p style="margin:0;font-size:0.75rem;color:#888;">${substitute(unsub, vars)}</p>
</div>`;
}

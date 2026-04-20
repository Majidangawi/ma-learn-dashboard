export type Block =
  | { type: 'text'; content: string }
  | { type: 'heading'; text: string }
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
      return `<p style="color:#222;margin:12px 0;">${substitute(esc(block.content), vars).replace(/\n/g, '<br>')}</p>`;
    case 'heading':
      return `<p style="font-size:1.15rem;font-weight:bold;color:#222;margin:22px 0 10px;">${substitute(esc(block.text), vars)}</p>`;
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

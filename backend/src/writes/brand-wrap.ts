/**
 * Wraps plain-text (with lightweight markdown) into MA Learn brand-styled HTML.
 *
 * Supported markdown syntax:
 *   ## Heading            → gold-accent heading paragraph
 *   > highlight block     → box with gold border (brand accent)
 *   - bullet              → list item
 *   **bold**              → <strong>
 *   blank line            → paragraph break
 *   single \n             → <br> inside paragraph
 */

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));
}

function renderInline(s: string): string {
  return escapeHtml(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

export function brandWrapEmailBody(raw: string, language: 'AR' | 'EN'): string {
  const isAR = language === 'AR';
  const dir = isAR ? 'rtl' : 'ltr';
  const borderSide = isAR ? 'border-right' : 'border-left';
  const padSide = isAR ? 'padding-right' : 'padding-left';

  const signature = isAR
    ? `— <strong>ماجد عنقاوي</strong><br><span style="color:#888;font-size:0.85rem;">صناعة الإلهام · MA Learn</span>`
    : `— <strong>Majid Angawi</strong><br><span style="color:#888;font-size:0.85rem;">Making Inspiration · MA Learn</span>`;

  // Split into blocks separated by one or more blank lines.
  const blocks = raw.trim().split(/\n\s*\n+/);

  const rendered: string[] = [];
  for (const block of blocks) {
    const lines = block.split(/\n/);

    // Heading block (entire block starts with ##)
    if (/^##\s/.test(lines[0])) {
      const text = renderInline(lines[0].replace(/^##\s*/, ''));
      rendered.push(
        `<p style="font-size:1.1rem;font-weight:bold;color:#222;margin:22px 0 12px;">${text}</p>`
      );
      if (lines.length > 1) {
        rendered.push(`<p style="color:#444;">${lines.slice(1).map(renderInline).join('<br>')}</p>`);
      }
      continue;
    }

    // Highlight block (entire block starts with >)
    if (/^>\s/.test(lines[0])) {
      const content = lines.map(l => renderInline(l.replace(/^>\s?/, ''))).join('<br>');
      rendered.push(
        `<div style="background:#f9f6f0;${borderSide}:3px solid #C9A84C;padding:18px 22px;margin:22px 0;border-radius:4px;"><p style="margin:0;color:#222;">${content}</p></div>`
      );
      continue;
    }

    // Bullet list block (all lines start with - or •)
    if (lines.every(l => /^\s*[-•]\s/.test(l))) {
      const items = lines
        .map(l => `<li style="padding:4px 0;color:#444;">${renderInline(l.replace(/^\s*[-•]\s*/, ''))}</li>`)
        .join('');
      rendered.push(
        `<ul style="margin:16px 0;${padSide}:22px;list-style:disc;">${items}</ul>`
      );
      continue;
    }

    // Plain paragraph — single \n becomes <br>.
    const paragraph = lines.map(renderInline).join('<br>');
    rendered.push(`<p style="color:#222;">${paragraph}</p>`);
  }

  return `<div dir="${dir}" style="font-family:Arial,sans-serif;max-width:600px;color:#222;line-height:1.7;">
${rendered.join('\n')}
<hr style="border:none;border-top:1px solid #eee;margin:32px 0 20px;">
<p style="margin:0;">${signature}</p>
</div>`;
}

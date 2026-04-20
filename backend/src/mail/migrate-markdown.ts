import type { Block } from './blocks.js';

// Text blocks now hold rich-text HTML. For migration, escape plain text and
// convert line breaks to <br>. Future-proofs the shim for any old markdown-lite
// content that might still exist in templates.
function plainTextToHtml(s: string): string {
  const escaped = s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  return escaped.replace(/\n/g, '<br>');
}

export function markdownToBlocks(raw: string): Block[] {
  if (!raw || !raw.trim()) return [];
  const out: Block[] = [];
  const sections = raw.trim().split(/\n\s*\n+/);
  for (const section of sections) {
    const lines = section.split(/\n/);
    if (/^##\s/.test(lines[0])) {
      out.push({ type: 'heading', text: plainTextToHtml(lines[0].replace(/^##\s*/, '')), level: 2, bold: true, italic: false });
      if (lines.length > 1) out.push({ type: 'text', content: plainTextToHtml(lines.slice(1).join('\n')) });
    } else if (lines.every(l => /^\s*[-•]\s/.test(l))) {
      out.push({ type: 'bullet_list', items: lines.map(l => l.replace(/^\s*[-•]\s*/, '')) });
    } else if (/^>\s/.test(lines[0])) {
      out.push({ type: 'quote', text: plainTextToHtml(lines.map(l => l.replace(/^>\s?/, '')).join('\n')) });
    } else {
      out.push({ type: 'text', content: plainTextToHtml(section) });
    }
  }
  return out;
}

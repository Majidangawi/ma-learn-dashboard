import type { Block } from './blocks.js';

export function markdownToBlocks(raw: string): Block[] {
  if (!raw || !raw.trim()) return [];
  const out: Block[] = [];
  const sections = raw.trim().split(/\n\s*\n+/);
  for (const section of sections) {
    const lines = section.split(/\n/);
    if (/^##\s/.test(lines[0])) {
      out.push({ type: 'heading', text: lines[0].replace(/^##\s*/, '') });
      if (lines.length > 1) out.push({ type: 'text', content: lines.slice(1).join('\n') });
    } else if (lines.every(l => /^\s*[-•]\s/.test(l))) {
      out.push({ type: 'bullet_list', items: lines.map(l => l.replace(/^\s*[-•]\s*/, '')) });
    } else if (/^>\s/.test(lines[0])) {
      out.push({ type: 'text', content: lines.map(l => l.replace(/^>\s?/, '')).join('\n') });
    } else {
      out.push({ type: 'text', content: section });
    }
  }
  return out;
}

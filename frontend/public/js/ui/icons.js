import { ICONS } from './icons/index.js';

const DEFAULTS = { size: 20, stroke: 1.5, class: '' };

export function icon(name, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const inner = ICONS[name];
  if (!inner) { console.warn('icon: unknown name', name); return ''; }
  const cls = o.class ? ` class="${String(o.class).replace(/"/g, '&quot;')}"` : '';
  return `<svg${cls} width="${o.size}" height="${o.size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${o.stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}

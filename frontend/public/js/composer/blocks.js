// Block type registry. Matches backend src/mail/blocks.ts Block union.

export const BLOCK_TYPES = {
  text: {
    label: 'Text',
    icon: '¶',
    default: () => ({ type: 'text', content: '' }),
  },
  heading: {
    label: 'Heading',
    icon: 'H',
    default: () => ({ type: 'heading', text: '' }),
  },
  banner: {
    label: 'Banner image',
    icon: '🖼',
    default: () => ({ type: 'banner', url: '', alt: '', link: '' }),
  },
  cta: {
    label: 'CTA button',
    icon: '▢',
    default: () => ({ type: 'cta', label: '', url: '', color: 'gold' }),
  },
  bullet_list: {
    label: 'Bullet list',
    icon: '•',
    default: () => ({ type: 'bullet_list', items: [''] }),
  },
  divider: {
    label: 'Divider',
    icon: '—',
    default: () => ({ type: 'divider' }),
  },
};

export const VARIABLES = [
  { key: 'name', label: 'Subscriber name' },
  { key: 'product', label: 'Product' },
  { key: 'token', label: 'Access token' },
  { key: 'course', label: 'Course name' },
  { key: 'module', label: 'Module name' },
  { key: 'nextModule', label: 'Next module' },
  { key: 'playerURL', label: 'Player URL' },
  { key: 'unsubscribeUrl', label: 'Unsubscribe URL' },
];

export function newId() {
  return 'b_' + Math.random().toString(36).slice(2, 10);
}

// Attach id for DOM bookkeeping; backend schema has no id (order is implicit).
export function withIds(blocks) {
  return blocks.map(b => ({ ...b, __id: newId() }));
}

export function stripIds(blocks) {
  return blocks.map(({ __id, ...b }) => b);
}

import { BLOCK_TYPES } from './blocks.js';

export function openBlockPicker(anchorEl, onPick) {
  const rect = anchorEl.getBoundingClientRect();
  const pop = document.createElement('div');
  pop.className = 'block-picker';
  pop.style.position = 'absolute';
  pop.style.top = `${window.scrollY + rect.bottom + 6}px`;
  pop.style.left = `${window.scrollX + rect.left}px`;
  pop.innerHTML = Object.entries(BLOCK_TYPES).map(([key, def]) => `
    <button type="button" data-type="${key}">
      <span class="icon">${def.icon}</span>
      <span class="label">${def.label}</span>
    </button>
  `).join('');
  document.body.appendChild(pop);

  const onDocClick = (e) => {
    if (!pop.contains(e.target) && e.target !== anchorEl) close();
  };
  const close = () => { document.removeEventListener('click', onDocClick); pop.remove(); };
  setTimeout(() => document.addEventListener('click', onDocClick), 0);

  pop.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-type]');
    if (!btn) return;
    const key = btn.dataset.type;
    const def = BLOCK_TYPES[key];
    onPick(def.default());
    close();
  });
}

import { BLOCK_TYPES } from './blocks.js';

export function openBlockPicker(anchorEl, onPick) {
  const rect = anchorEl.getBoundingClientRect();
  const pop = document.createElement('div');
  pop.className = 'block-picker';
  pop.style.position = 'fixed';
  pop.innerHTML = Object.entries(BLOCK_TYPES).map(([key, def]) => `
    <button type="button" data-type="${key}">
      <span class="icon">${def.icon}</span>
      <span class="label">${def.label}</span>
    </button>
  `).join('');
  document.body.appendChild(pop);

  // Measure the popup AFTER it's in the DOM, then decide: below or above the
  // anchor, depending on available viewport space. Clamp to viewport so it
  // can't slide off the bottom/right.
  const gap = 6;
  const popH = pop.offsetHeight;
  const popW = pop.offsetWidth;
  const viewportH = window.innerHeight;
  const viewportW = window.innerWidth;

  let top = rect.bottom + gap;
  if (top + popH > viewportH - 12) {
    // No room below → open above the anchor instead.
    top = rect.top - popH - gap;
  }
  if (top < 12) top = 12;

  let left = rect.left;
  if (left + popW > viewportW - 12) left = viewportW - popW - 12;
  if (left < 12) left = 12;

  pop.style.top = `${top}px`;
  pop.style.left = `${left}px`;
  // Fade in once position is locked so the repositioning jump isn't visible.
  pop.style.opacity = '1';

  const onDocClick = (e) => {
    if (!pop.contains(e.target) && e.target !== anchorEl) close();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const close = () => {
    document.removeEventListener('click', onDocClick);
    document.removeEventListener('keydown', onKey);
    pop.remove();
  };
  setTimeout(() => {
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
  }, 0);

  pop.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-type]');
    if (!btn) return;
    const key = btn.dataset.type;
    const def = BLOCK_TYPES[key];
    onPick(def.default());
    close();
  });
}

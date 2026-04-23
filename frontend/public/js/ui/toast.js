// Toast API. toast(msg, 'success' | 'error' | 'warning' | 'default')

let stack = null;
function ensureStack() {
  if (stack) return stack;
  stack = document.createElement('div');
  stack.className = 'toast-stack';
  stack.setAttribute('role', 'status');
  stack.setAttribute('aria-live', 'polite');
  document.body.appendChild(stack);
  return stack;
}

export function toast(msg, tone = 'default', ttl) {
  const s = ensureStack();
  const el = document.createElement('div');
  el.setAttribute('data-ui', 'toast');
  if (tone !== 'default') el.setAttribute('data-tone', tone);
  el.textContent = msg;
  s.appendChild(el);
  requestAnimationFrame(() => el.setAttribute('data-enter', ''));
  const lifespan = ttl ?? (tone === 'error' ? 5000 : 4000);
  setTimeout(() => {
    el.removeAttribute('data-enter');
    setTimeout(() => el.remove(), 260);
  }, lifespan);
  // Cap stack at 3 visible.
  while (s.children.length > 3) s.firstElementChild.remove();
}

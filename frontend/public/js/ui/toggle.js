// Liquid toggle — render helper.
// Usage: toggleHtml({ id: 'f-active', checked: true, label: 'Active' })

export function toggleHtml({ id, checked = false, label = '', size = 'md' }) {
  const sizeAttr = size === 'sm' ? ' data-size="sm"' : '';
  return `
    <label class="toggle-row" style="display:inline-flex; align-items:center; gap:var(--s-2); cursor:pointer">
      <span data-ui="toggle"${sizeAttr}>
        <input type="checkbox" id="${id}" ${checked ? 'checked' : ''}>
        <span class="track"></span>
        <span class="thumb"></span>
      </span>
      ${label ? `<span style="font-size:var(--fs-body-sm); color:var(--c-fg-2)">${label}</span>` : ''}
    </label>`;
}

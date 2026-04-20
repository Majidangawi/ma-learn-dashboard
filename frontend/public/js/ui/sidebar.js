const NAV = [
  { id: 'home', label: 'Home', href: '#home' },
  { id: 'customers', label: 'Customers', href: '#customers' },
  { id: 'emails', label: 'Emails', href: '#emails' },
  { id: 'newsletter', label: 'Newsletter', href: '#newsletter' },
  { id: 'coupons', label: 'Coupons', href: '#coupons' },
  { id: 'lessons', label: 'Lessons', href: '#lessons' },
  { id: 'linkbio', label: 'Link-in-bio', href: '#linkbio' },
  { id: 'noor', label: 'Noor chat', href: '#noor' },
  { id: 'settings', label: 'Settings', href: '#settings' },
];

export function mountSidebar(root) {
  const el = document.createElement('nav');
  el.className = 'sidebar';
  for (const item of NAV) {
    const a = document.createElement('a');
    a.href = item.href;
    a.dataset.id = item.id;
    a.textContent = item.label;
    el.appendChild(a);
  }
  root.appendChild(el);
  return {
    setActive: (id) => {
      el.querySelectorAll('a').forEach((a) => a.classList.toggle('active', a.dataset.id === id));
    },
  };
}

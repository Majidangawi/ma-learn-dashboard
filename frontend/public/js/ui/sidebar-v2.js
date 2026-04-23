// sidebar-v2.js — Editorial Atelier sidebar. Section headers, ⌘K search,
// and two collapsible panels pinned at the bottom: Activity feed + Noor chat.
// The right rail is retired — this sidebar holds every operational surface.
import { icon } from './icons.js';
import { mountNoorInRail } from './noor-widget.js';
import { mountActivityFeed } from './activity-feed.js';

const NAV = [
  { section: 'DASHBOARD', items: [
    { id: 'home',       label: 'Home',        href: '#home',       icon: 'home' },
    { id: 'activity',   label: 'Activity',    href: '#activity',   icon: 'activity' },
  ]},
  { section: 'CONTENT', items: [
    { id: 'emails',     label: 'Emails',      href: '#emails',     icon: 'mail' },
    { id: 'newsletter', label: 'Newsletter',  href: '#newsletter', icon: 'megaphone' },
    { id: 'lessons',    label: 'Lessons',     href: '#lessons',    icon: 'book-open' },
    { id: 'linkbio',    label: 'Link-in-bio', href: '#linkbio',    icon: 'link' },
  ]},
  { section: 'PEOPLE', items: [
    { id: 'contacts',   label: 'Contacts',    href: '#contacts',   icon: 'users' },
    { id: 'coupons',    label: 'Coupons',     href: '#coupons',    icon: 'ticket' },
  ]},
];

export function mountSidebar(root, { user = 'Majid', env = 'staging' } = {}) {
  const el = document.createElement('aside');
  el.className = 'shell-sidebar';
  el.innerHTML = `
    <div class="sidebar-head">
      <div class="brand">MA Learn</div>
    </div>
    <div class="sidebar-search">
      <span class="search-icon">${icon('search', { size: 16 })}</span>
      <input data-ui="input" placeholder="Search…" id="sidebar-search-input">
      <span class="kbd">⌘K</span>
    </div>
    <nav class="sidebar-nav" aria-label="Primary">
      ${NAV.map(s => `
        <div class="nav-section">
          <span class="nav-section-label">${s.section}</span>
          ${s.items.map(i => `
            <a class="nav-item" href="${i.href}" data-id="${i.id}">
              ${icon(i.icon, { size: 18 })}
              <span>${i.label}</span>
            </a>`).join('')}
        </div>`).join('')}
    </nav>
    <section class="sidebar-pane" id="sidebar-activity-section" data-pane="activity">
      <header class="sidebar-pane-head" id="sidebar-activity-head">
        <span>Activity</span>
        <span class="toggle-icon">${icon('chevron-down', { size: 16 })}</span>
      </header>
      <div class="sidebar-pane-body" id="sidebar-activity-body"></div>
    </section>
    <section class="sidebar-pane" id="sidebar-noor-section" data-pane="noor">
      <header class="sidebar-pane-head" id="sidebar-noor-head">
        <span>Noor</span>
        <span class="toggle-icon">${icon('chevron-down', { size: 16 })}</span>
      </header>
      <div class="sidebar-pane-body" id="sidebar-noor-body"></div>
    </section>
    <div class="sidebar-foot">
      <span class="env-dot" data-env="${env}" title="${env}"></span>
      <span>${user} · ${env}</span>
    </div>`;
  root.appendChild(el);

  // Collapsible pane helper — state persists; content mounts on first open.
  function wirePane(sectionId, storageKey, mountFn) {
    const section = el.querySelector('#' + sectionId);
    const head    = section.querySelector('.sidebar-pane-head');
    const body    = section.querySelector('.sidebar-pane-body');
    let mounted   = false;
    const ensureMounted = () => { if (!mounted) { mountFn(body); mounted = true; } };
    // Default: collapsed unless localStorage says otherwise.
    if (localStorage.getItem(storageKey) !== '0') section.classList.add('collapsed');
    else ensureMounted();
    head.onclick = () => {
      section.classList.toggle('collapsed');
      const collapsed = section.classList.contains('collapsed');
      localStorage.setItem(storageKey, collapsed ? '1' : '0');
      if (!collapsed) ensureMounted();
    };
  }
  wirePane('sidebar-activity-section', 'sidebar.activity.collapsed', mountActivityFeed);
  wirePane('sidebar-noor-section',     'sidebar.noor.collapsed',     mountNoorInRail);

  // Focus the search input on ⌘K / Ctrl+K
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      el.querySelector('#sidebar-search-input').focus();
    }
  });

  return {
    setActive: (id) => {
      el.querySelectorAll('.nav-item').forEach(a => {
        if (a.dataset.id === id) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
      });
    },
  };
}

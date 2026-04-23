// topbar.js — page title on the left, icon cluster on the right.
import { icon } from './icons.js';
import { logout } from '../session.js';

const TITLES = {
  home:       ['Home',         'Today\'s briefing'],
  activity:   ['Activity',     'Last 20 writes'],
  emails:     ['Emails',       'Templates and sends'],
  newsletter: ['Newsletter',   'Drafts, scheduled, sent'],
  lessons:    ['Lessons',      'Player admin'],
  linkbio:    ['Link-in-bio',  'Live at linkinbio.malearnsa.com'],
  contacts:   ['Contacts',     'Unified customers + subscribers'],
  coupons:    ['Coupons',      'Discount codes'],
};

export function mountTopbar(root) {
  const el = document.createElement('header');
  el.className = 'shell-topbar';
  el.innerHTML = `
    <div class="topbar-title">
      <h1 id="tb-title">Home</h1>
      <div class="subtitle" id="tb-sub">Today's briefing</div>
    </div>
    <div class="topbar-actions">
      <button data-ui="btn" data-variant="ghost" data-icon-only title="Refresh"       id="tb-refresh" aria-label="Refresh">${icon('refresh-cw', { size: 18 })}</button>
      <button data-ui="btn" data-variant="ghost" data-icon-only title="Notifications" id="tb-notif"   aria-label="Notifications">${icon('bell', { size: 18 })}</button>
      <button data-ui="btn" data-variant="ghost" data-icon-only title="Language"      id="tb-lang"    aria-label="Language">${icon('globe', { size: 18 })}</button>
      <button data-ui="btn" data-variant="ghost" data-icon-only title="Logout"        id="tb-logout"  aria-label="Logout">${icon('log-out', { size: 18 })}</button>
    </div>`;
  root.appendChild(el);

  el.querySelector('#tb-refresh').onclick = () => location.reload();
  el.querySelector('#tb-logout').onclick  = async () => { await logout(); location.href = 'index.html'; };
  // Notifications + language: Phase 3 wires these to real data. Placeholder no-ops for now.
  el.querySelector('#tb-notif').onclick = () => { /* no-op until activity wiring in Phase 3 */ };
  el.querySelector('#tb-lang').onclick  = () => { /* no-op until locale toggle in Phase 3 */ };

  return {
    setTitle: (pageId) => {
      const [t, s] = TITLES[pageId] ?? [pageId, ''];
      el.querySelector('#tb-title').textContent = t;
      el.querySelector('#tb-sub').textContent   = s;
    },
  };
}

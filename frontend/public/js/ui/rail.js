// rail.js — pinned right rail with Noor top + Activity bottom.
// Both sections are collapsible; state persists in localStorage.
import { icon } from './icons.js';
import { mountNoorInRail } from './noor-widget.js';
import { mountActivityFeed } from './activity-feed.js';

export function mountRail(root) {
  const el = document.createElement('aside');
  el.className = 'shell-rail';
  el.innerHTML = `
    <section class="rail-section rail-noor">
      <header class="rail-head" id="rail-noor-head">
        <span>Noor</span>
        <span class="toggle-icon">${icon('chevron-down', { size: 16 })}</span>
      </header>
      <div class="rail-body" id="rail-noor-body" style="display:flex; flex-direction:column;"></div>
    </section>
    <section class="rail-section rail-activity">
      <header class="rail-head" id="rail-activity-head">
        <span>Activity</span>
        <span class="toggle-icon">${icon('chevron-down', { size: 16 })}</span>
      </header>
      <div class="rail-body" id="rail-activity-body"></div>
    </section>`;
  root.appendChild(el);

  // Collapse persistence
  function wireCollapse(sectionSelector, key) {
    const sec  = el.querySelector(sectionSelector);
    const head = sec.querySelector('.rail-head');
    if (localStorage.getItem(key) === '1') sec.classList.add('collapsed');
    head.onclick = () => {
      sec.classList.toggle('collapsed');
      localStorage.setItem(key, sec.classList.contains('collapsed') ? '1' : '0');
    };
  }
  wireCollapse('.rail-noor',     'rail.noor.collapsed');
  wireCollapse('.rail-activity', 'rail.activity.collapsed');

  mountNoorInRail(el.querySelector('#rail-noor-body'));
  mountActivityFeed(el.querySelector('#rail-activity-body'));
}

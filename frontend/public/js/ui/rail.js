// rail.js — pinned right rail. Noor moved to the left sidebar bottom;
// this rail now holds only the Activity feed (full height, non-collapsible).
import { mountActivityFeed } from './activity-feed.js';

export function mountRail(root) {
  const el = document.createElement('aside');
  el.className = 'shell-rail';
  el.innerHTML = `
    <section class="rail-section rail-activity" style="flex:1">
      <header class="rail-head">
        <span>Activity</span>
      </header>
      <div class="rail-body" id="rail-activity-body"></div>
    </section>`;
  root.appendChild(el);
  mountActivityFeed(el.querySelector('#rail-activity-body'));
}

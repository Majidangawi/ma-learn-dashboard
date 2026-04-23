import { api } from '../api.js';
import { icon } from './icons.js';

const TYPE_ICON = {
  newsletter_send:  'megaphone',
  lesson_save:      'book-open',
  lesson_create:    'plus',
  lesson_delete:    'trash-2',
  token_gift:       'gift',
  coupon_create:    'ticket',
  coupon_update:    'edit',
  contact_gift:     'gift',
  default:          'activity',
};

function relTime(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60)    return Math.floor(s) + 's';
  if (s < 3600)  return Math.floor(s / 60) + 'm';
  if (s < 86400) return Math.floor(s / 3600) + 'h';
  return Math.floor(s / 86400) + 'd';
}

export async function mountActivityFeed(root) {
  root.innerHTML = '<div style="color:var(--c-fg-3); font-size:var(--fs-body-sm); padding:var(--s-2)">Loading…</div>';
  try {
    const { events } = await api('/api/data/activity?limit=20');
    if (!events || events.length === 0) {
      root.innerHTML = `<div style="color:var(--c-fg-3); font-size:var(--fs-body-sm); padding:var(--s-4) 0; text-align:center">No activity yet. Changes you make will appear here.</div>`;
      return;
    }
    root.innerHTML = events.map(e => `
      <div class="activity-row" style="display:flex; align-items:flex-start; gap:var(--s-2); padding:var(--s-2) 0; border-bottom:0.5px solid var(--c-ink-4)">
        <span style="color:var(--c-fg-3); margin-top:2px">${icon(TYPE_ICON[e.type] ?? TYPE_ICON.default, { size: 14 })}</span>
        <div style="flex:1; min-width:0">
          <div style="font-size:var(--fs-body-sm); color:var(--c-fg); line-height:1.4; overflow-wrap:anywhere">${escapeHtml(e.summary)}</div>
          <div style="font-size:11px; color:var(--c-fg-3); margin-top:2px">${relTime(e.at)} ago</div>
        </div>
      </div>`).join('');
  } catch (err) {
    root.innerHTML = `<div style="color:var(--c-fg-3); font-size:var(--fs-body-sm); padding:var(--s-2)">Activity unavailable.</div>`;
  }
}

function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

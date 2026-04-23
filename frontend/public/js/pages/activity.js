import { api } from '../api.js';
import { icon } from '../ui/icons.js';

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

const TYPE_LABEL = {
  newsletter_send: 'Newsletter send',
  lesson_save:     'Lesson save',
  lesson_create:   'Lesson create',
  lesson_delete:   'Lesson delete',
  token_gift:      'Token gift',
  coupon_create:   'Coupon create',
  coupon_update:   'Coupon update',
  contact_gift:    'Contact gift',
  default:         'Other',
};

function fmtDateTime(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function withinRange(iso, key) {
  if (key === 'all') return true;
  const now = Date.now();
  const at = new Date(iso).getTime();
  if (isNaN(at)) return false;
  if (key === 'today') {
    const d = new Date();
    const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    return at >= start;
  }
  if (key === 'this_week') {
    const d = new Date();
    const dow = (d.getUTCDay() + 6) % 7; // Mon=0
    const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow);
    return at >= start;
  }
  if (key === 'last_7')  return at >= now - 7  * 86400000;
  if (key === 'last_30') return at >= now - 30 * 86400000;
  return true;
}

export default async function mount(root) {
  const state = { type: 'all', actor: 'all', range: 'all', events: [] };

  root.innerHTML = '<div style="color:var(--c-fg-3)">Loading activity…</div>';
  try {
    const { events } = await api('/api/data/activity?limit=100');
    state.events = Array.isArray(events) ? events : [];
  } catch (e) {
    root.innerHTML = `<div style="color:var(--c-danger)">Could not load activity: ${escapeHtml(e.message)}</div>`;
    return;
  }

  function filtered() {
    return state.events.filter(e =>
      (state.type === 'all' || e.type === state.type) &&
      (state.actor === 'all' || e.actor === state.actor) &&
      withinRange(e.at, state.range)
    );
  }

  function render() {
    const rows = filtered().map(e => {
      const typeLabel = TYPE_LABEL[e.type] ?? TYPE_LABEL.default;
      return `
        <div class="activity-row" style="display:flex; align-items:flex-start; gap:var(--s-3); padding:var(--s-3) 0; border-bottom:0.5px solid var(--c-ink-4)">
          <span style="color:var(--c-fg-3); margin-top:2px; flex-shrink:0">${icon(TYPE_ICON[e.type] ?? TYPE_ICON.default, { size: 18 })}</span>
          <div style="flex:1; min-width:0">
            <div style="font-size:var(--fs-body); color:var(--c-fg); line-height:1.5; overflow-wrap:anywhere">${escapeHtml(e.summary)}</div>
            <div style="display:flex; gap:var(--s-3); align-items:center; margin-top:4px">
              <span data-ui="tag">${escapeHtml(typeLabel)}</span>
              <span style="font-size:var(--fs-label); color:var(--c-fg-3); letter-spacing:0.04em; text-transform:uppercase">${escapeHtml(e.actor || '—')}</span>
              <span style="font-size:var(--fs-label); color:var(--c-fg-3); font-variant-numeric:tabular-nums">${fmtDateTime(e.at)}</span>
            </div>
          </div>
        </div>`;
    }).join('');

    root.innerHTML = `
      <section style="max-width:960px; margin:0 auto; display:grid; gap:var(--s-5)">

        <header style="display:grid; grid-template-columns: repeat(3, 1fr); gap:var(--s-3)">
          <div data-ui="field">
            <label>Type</label>
            <select data-ui="select" id="f-type">
              <option value="all">All types</option>
              ${Object.entries(TYPE_LABEL).map(([v, l]) => `<option value="${v}" ${state.type === v ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
          </div>
          <div data-ui="field">
            <label>Actor</label>
            <select data-ui="select" id="f-actor">
              <option value="all">All actors</option>
              <option value="majid" ${state.actor === 'majid' ? 'selected' : ''}>Majid</option>
              <option value="noor"  ${state.actor === 'noor'  ? 'selected' : ''}>Noor</option>
            </select>
          </div>
          <div data-ui="field">
            <label>Range</label>
            <select data-ui="select" id="f-range">
              <option value="all">All time</option>
              <option value="today"     ${state.range === 'today'     ? 'selected' : ''}>Today</option>
              <option value="this_week" ${state.range === 'this_week' ? 'selected' : ''}>This week</option>
              <option value="last_7"    ${state.range === 'last_7'    ? 'selected' : ''}>Last 7 days</option>
              <option value="last_30"   ${state.range === 'last_30'   ? 'selected' : ''}>Last 30 days</option>
            </select>
          </div>
        </header>

        <div style="font-size:var(--fs-label); color:var(--c-fg-3); letter-spacing:0.04em; text-transform:uppercase">
          ${filtered().length} of ${state.events.length} events
        </div>

        <section>
          ${rows || '<div style="color:var(--c-fg-3); font-size:var(--fs-body-sm); padding:var(--s-5) 0; text-align:center">No events match these filters.</div>'}
        </section>

      </section>`;

    document.getElementById('f-type').onchange  = (e) => { state.type  = e.target.value; render(); };
    document.getElementById('f-actor').onchange = (e) => { state.actor = e.target.value; render(); };
    document.getElementById('f-range').onchange = (e) => { state.range = e.target.value; render(); };
  }

  render();
}

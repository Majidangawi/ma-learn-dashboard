import { api } from '../api.js';
import { mountComposer } from '../composer/index.js';

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const SEGMENT_PRESETS = [
  { key: 'all', label: 'All active', filter: {} },
  { key: 'buyers', label: 'Buyers only', filter: { sources: ['buyer'] } },
  { key: 'waitlist', label: 'Waitlist only', filter: { sources: ['waitlist'] } },
  { key: 'website', label: 'Website / LIB signups', filter: { sources: ['website', 'lib'] } },
];

const STATUS_TONE = {
  draft: 'gold',
  scheduled: 'warning',
  sending: 'warning',
  sent: 'success',
  failed: 'danger',
};

const STATUS_LABEL = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  sending: 'Sending',
  sent: 'Sent',
  failed: 'Failed',
};

export default async function mount(root) {
  root.innerHTML = '<section style="max-width:1080px; margin:0 auto; color:var(--c-fg-3); font-size:var(--fs-body-sm)">Loading…</section>';

  let { newsletters } = await api('/api/data/newsletters');
  const subCount = await api('/api/data/subscribers/count');

  let activeTab = 'all';
  function filterByTab(list) {
    if (activeTab === 'drafts') return list.filter(n => n.status === 'draft');
    if (activeTab === 'scheduled') return list.filter(n => n.status === 'scheduled');
    if (activeTab === 'sent') return list.filter(n => n.status === 'sent');
    return list.filter(n => n.status !== 'deleted');
  }

  const TABS = [
    { key: 'all', label: 'All' },
    { key: 'drafts', label: 'Drafts' },
    { key: 'scheduled', label: 'Scheduled' },
    { key: 'sent', label: 'Sent' },
  ];

  function render() {
    const list = filterByTab(newsletters);
    root.innerHTML = `
      <section dir="ltr" style="max-width:1080px; margin:0 auto; display:grid; gap:var(--s-6); text-align:left">

        <section style="display:flex; justify-content:space-between; align-items:center; gap:var(--s-3); flex-wrap:wrap">
          <div style="color:var(--c-fg-2); font-size:var(--fs-body-sm); font-variant-numeric:tabular-nums">
            ${subCount.active.toLocaleString()} active · ${subCount.unsubscribed.toLocaleString()} unsubscribed
          </div>
          <button data-ui="btn" data-variant="primary" id="new-btn">+ New newsletter</button>
        </section>

        <nav class="nl-tabs" style="display:flex; gap:var(--s-5); border-bottom:0.5px solid var(--c-ink-4); margin-bottom:var(--s-2)">
          ${TABS.map(t => {
            const isActive = t.key === activeTab;
            const style = [
              'padding:var(--s-3) 0',
              'font-size:var(--fs-label)',
              'font-weight:500',
              'letter-spacing:0.08em',
              'text-transform:uppercase',
              `color:${isActive ? 'var(--c-fg)' : 'var(--c-fg-3)'}`,
              'cursor:pointer',
              'background:transparent',
              'border:0',
              `border-bottom:2px solid ${isActive ? 'var(--c-gold)' : 'transparent'}`,
              'margin-bottom:-0.5px',
              'transition:color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out)',
            ].join(';');
            return `<button class="nl-tab" data-tab="${t.key}" style="${style}">${t.label}</button>`;
          }).join('')}
        </nav>

        <section class="nl-list">
          ${list.length
            ? list.map((nl, i) => renderRow(nl, i === list.length - 1)).join('')
            : `<div style="padding:var(--s-6) 0; color:var(--c-fg-3); font-size:var(--fs-body-sm); text-align:center">No newsletters in this view. Drafts appear after you save a compose.</div>`}
        </section>

      </section>`;

    document.getElementById('new-btn').onclick = () => openCompose({});
    root.querySelectorAll('.nl-tab').forEach(el => {
      el.onclick = () => { activeTab = el.dataset.tab; render(); };
    });
    root.querySelectorAll('.nl-row').forEach(el => {
      el.onclick = () => {
        const nl = newsletters.find(x => x.newsletterId === el.dataset.id);
        if (!nl) return;
        if (nl.status === 'sent') openStats(nl);
        else openCompose(nl);
      };
    });
  }

  function renderRow(nl, isLast) {
    const tone = STATUS_TONE[nl.status] || 'gold';
    const label = STATUS_LABEL[nl.status] || nl.status;

    const meta = nl.status === 'sent'
      ? `Sent ${fmtDate(nl.sentAt)} · ${Number(nl.recipientCount || 0).toLocaleString()} recipients · ${pct(nl.openCount, nl.recipientCount)}% open · ${pct(nl.clickCount, nl.recipientCount)}% click`
      : nl.status === 'scheduled'
        ? `Sends ${fmtDate(nl.scheduledAt)}`
        : `Last edited ${fmtDate(nl.updatedAt)}`;

    const rowStyle = [
      'display:grid',
      'grid-template-columns: 1fr auto',
      'gap:var(--s-3)',
      'align-items:center',
      'padding:var(--s-4) 0',
      'cursor:pointer',
      'transition:background var(--dur-fast) var(--ease-out)',
      isLast ? '' : 'border-bottom:0.5px solid var(--c-ink-4)',
    ].filter(Boolean).join(';');

    return `
      <div class="nl-row" data-id="${escapeHtml(nl.newsletterId)}" style="${rowStyle}">
        <div style="display:grid; gap:var(--s-1); min-width:0">
          <div style="font-size:var(--fs-body); font-weight:500; color:var(--c-fg); white-space:nowrap; overflow:hidden; text-overflow:ellipsis">
            ${escapeHtml(nl.subject || 'Untitled')}
          </div>
          <div class="tnum" style="font-size:var(--fs-body-sm); color:var(--c-fg-3); font-variant-numeric:tabular-nums">
            ${meta}
          </div>
        </div>
        <div style="flex-shrink:0">
          <span data-ui="tag" data-tone="${tone}">${escapeHtml(label)}</span>
        </div>
      </div>`;
  }

  async function openCompose(nl) {
    const isNew = !nl.newsletterId;
    const o = document.createElement('div');
    o.className = 'modal-overlay';
    o.innerHTML = `
      <div class="modal-card" style="max-width:1200px;max-height:92vh;overflow-y:auto">
        <h3>${isNew ? 'New newsletter' : 'Edit newsletter'}</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s-3);margin-bottom:var(--s-3)">
          <div data-ui="field"><label>Subject</label><input data-ui="input" id="n-subj" value="${escapeHtml(nl.subject || '')}" /></div>
          <div data-ui="field"><label>Language</label>
            <select data-ui="select" id="n-lang">
              <option value="AR" ${nl.language === 'AR' ? 'selected' : ''}>العربية</option>
              <option value="EN" ${nl.language === 'EN' ? 'selected' : ''}>English</option>
            </select></div>
        </div>
        <div data-ui="field"><label>Preheader (inbox preview)</label><input data-ui="input" id="n-pre" value="${escapeHtml(nl.preheader || '')}" /></div>
        <div data-ui="field"><label>Segment</label>
          <select data-ui="select" id="n-seg">
            ${SEGMENT_PRESETS.map(s => `<option value="${s.key}">${escapeHtml(s.label)}</option>`).join('')}
          </select>
          <span id="n-count" style="color:var(--c-fg-3);margin-left:var(--s-3);font-variant-numeric:tabular-nums">—</span>
        </div>
        <div id="n-composer"></div>
        <div class="modal-actions">
          <button data-ui="btn" data-variant="ghost" id="n-cancel">Close</button>
          <button data-ui="btn" data-variant="secondary" id="n-save">Save draft</button>
          <button data-ui="btn" data-variant="secondary" id="n-schedule">Schedule…</button>
          <button data-ui="btn" data-variant="primary" id="n-send">Send now</button>
        </div>
        <div class="modal-msg" id="n-msg"></div>
      </div>`;
    document.body.appendChild(o);

    // Click on the dim overlay (outside the card) closes the modal.
    o.addEventListener('mousedown', (e) => { if (e.target === o) o.remove(); });

    let currentBlocks = nl.blocks || [];
    const subjEl = o.querySelector('#n-subj');
    const preEl = o.querySelector('#n-pre');
    const composer = mountComposer({
      root: o.querySelector('#n-composer'),
      initialBlocks: currentBlocks,
      language: nl.language || 'AR',
      onChange: (b) => { currentBlocks = b; },
      getHeader: () => ({ subject: subjEl.value, preheader: preEl.value }),
    });
    subjEl.addEventListener('input', () => composer.refreshPreview());
    preEl.addEventListener('input', () => composer.refreshPreview());

    async function updateCount() {
      const segKey = o.querySelector('#n-seg').value;
      const preset = SEGMENT_PRESETS.find(s => s.key === segKey) || SEGMENT_PRESETS[0];
      const filter = { ...preset.filter, language: o.querySelector('#n-lang').value };
      try {
        const { count } = await api('/api/data/newsletters/preview_segment', {
          method: 'POST', body: JSON.stringify(filter),
        });
        o.querySelector('#n-count').textContent = `${Number(count).toLocaleString()} recipients`;
      } catch (e) {
        o.querySelector('#n-count').textContent = `(count unavailable: ${e.message})`;
      }
    }
    o.querySelector('#n-seg').onchange = updateCount;
    o.querySelector('#n-lang').onchange = updateCount;
    updateCount();

    async function save() {
      const segKey = o.querySelector('#n-seg').value;
      const preset = SEGMENT_PRESETS.find(s => s.key === segKey) || SEGMENT_PRESETS[0];
      const payload = {
        newsletterId: nl.newsletterId,
        subject: o.querySelector('#n-subj').value,
        preheader: o.querySelector('#n-pre').value,
        language: o.querySelector('#n-lang').value,
        blocks: currentBlocks,
        segmentFilter: { ...preset.filter, language: o.querySelector('#n-lang').value },
      };
      const r = await api('/api/writes/newsletter/save', {
        method: 'POST', body: JSON.stringify(payload),
      });
      nl.newsletterId = r.newsletterId;
      return r;
    }

    o.querySelector('#n-save').onclick = async () => {
      o.querySelector('#n-msg').textContent = 'Saving…';
      try {
        await save();
        o.querySelector('#n-msg').textContent = 'Saved.';
        newsletters = (await api('/api/data/newsletters')).newsletters;
      } catch (e) {
        o.querySelector('#n-msg').textContent = `Error: ${e.message}`;
      }
    };

    o.querySelector('#n-send').onclick = async () => {
      if (!window.confirm(`Send this newsletter now? (${o.querySelector('#n-count').textContent})`)) return;
      try {
        await save();
        const res = await api('/api/writes/newsletter/send_now', {
          method: 'POST', body: JSON.stringify({ newsletterId: nl.newsletterId }),
        });
        if (res.ok) {
          o.querySelector('#n-msg').textContent = `Sent to ${res.sent} recipients.`;
          newsletters = (await api('/api/data/newsletters')).newsletters;
          setTimeout(() => { o.remove(); render(); }, 1200);
        } else {
          o.querySelector('#n-msg').textContent = `Error: ${res.error}`;
        }
      } catch (e) {
        o.querySelector('#n-msg').textContent = `Error: ${e.message}`;
      }
    };

    o.querySelector('#n-schedule').onclick = async () => {
      const when = window.prompt('Send at (YYYY-MM-DD HH:mm, KSA time):');
      if (!when) return;
      try {
        await save();
        await api('/api/writes/newsletter/schedule', {
          method: 'POST', body: JSON.stringify({ newsletterId: nl.newsletterId, sendAt: when }),
        });
        newsletters = (await api('/api/data/newsletters')).newsletters;
        o.remove();
        render();
      } catch (e) {
        o.querySelector('#n-msg').textContent = `Error: ${e.message}`;
      }
    };

    o.querySelector('#n-cancel').onclick = () => o.remove();
  }

  function openStats(nl) {
    window.location.hash = `#/newsletter/${nl.newsletterId}/stats`;
  }

  render();
}

function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return String(s);
  return d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}
function pct(n, total) {
  if (!total) return 0;
  return ((Number(n || 0) / Number(total)) * 100).toFixed(1);
}

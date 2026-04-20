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

export default async function mount(root) {
  root.innerHTML = '<h2 style="color:var(--gold)">Newsletter</h2><p style="color:var(--silver)">Loading…</p>';

  let { newsletters } = await api('/api/data/newsletters');
  const subCount = await api('/api/data/subscribers/count');

  let activeTab = 'all';
  function filterByTab(list) {
    if (activeTab === 'drafts') return list.filter(n => n.status === 'draft');
    if (activeTab === 'scheduled') return list.filter(n => n.status === 'scheduled');
    if (activeTab === 'sent') return list.filter(n => n.status === 'sent');
    return list.filter(n => n.status !== 'deleted');
  }

  function render() {
    const list = filterByTab(newsletters);
    root.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div>
          <h2 style="color:var(--gold);margin:0">Newsletter</h2>
          <p style="color:var(--silver);margin:4px 0 0;font-size:.9rem">
            ${subCount.active.toLocaleString()} active · ${subCount.unsubscribed.toLocaleString()} unsubscribed
          </p>
        </div>
        <button class="btn-primary" id="new-btn">+ New newsletter</button>
      </div>

      <div class="tabs" style="margin:14px 0 18px">
        ${['all', 'drafts', 'scheduled', 'sent'].map(t => `
          <button class="tab ${t === activeTab ? 'active' : ''}" data-tab="${t}">${t[0].toUpperCase() + t.slice(1)}</button>
        `).join('')}
      </div>

      <div class="card-grid">
        ${list.length ? list.map(nl => renderCard(nl)).join('') : '<p style="color:var(--silver)">Nothing here yet.</p>'}
      </div>`;

    document.getElementById('new-btn').onclick = () => openCompose({});
    root.querySelectorAll('.tab').forEach(el => { el.onclick = () => { activeTab = el.dataset.tab; render(); }; });
    root.querySelectorAll('.nl-card').forEach(el => {
      el.onclick = () => {
        const nl = newsletters.find(x => x.newsletterId === el.dataset.id);
        if (!nl) return;
        if (nl.status === 'sent') openStats(nl);
        else openCompose(nl);
      };
    });
  }

  function renderCard(nl) {
    const badge = {
      draft: 'Draft',
      scheduled: 'Scheduled',
      sending: 'Sending',
      sent: 'Sent',
      failed: 'Failed',
    }[nl.status] ?? nl.status;

    const bottomLine = nl.status === 'sent'
      ? `Sent ${fmtDate(nl.sentAt)} · ${Number(nl.recipientCount || 0).toLocaleString()} recipients<br>${pct(nl.openCount, nl.recipientCount)}% open · ${pct(nl.clickCount, nl.recipientCount)}% click`
      : nl.status === 'scheduled'
        ? `Sends ${fmtDate(nl.scheduledAt)}`
        : `Last edited ${fmtDate(nl.updatedAt)}`;

    return `
      <div class="nl-card" data-id="${escapeHtml(nl.newsletterId)}">
        <div class="nl-badge">${escapeHtml(badge)}</div>
        <div class="nl-subject">${escapeHtml(nl.subject || 'Untitled')}</div>
        <div class="nl-meta">${bottomLine}</div>
      </div>`;
  }

  async function openCompose(nl) {
    const isNew = !nl.newsletterId;
    const o = document.createElement('div');
    o.className = 'modal-overlay';
    o.innerHTML = `
      <div class="modal-card" style="max-width:1200px;max-height:92vh;overflow-y:auto">
        <h3>${isNew ? 'New newsletter' : 'Edit newsletter'}</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
          <div class="form-field"><label>Subject</label><input id="n-subj" value="${escapeHtml(nl.subject || '')}" /></div>
          <div class="form-field"><label>Language</label>
            <select id="n-lang">
              <option value="AR" ${nl.language === 'AR' ? 'selected' : ''}>العربية</option>
              <option value="EN" ${nl.language === 'EN' ? 'selected' : ''}>English</option>
            </select></div>
        </div>
        <div class="form-field"><label>Preheader (inbox preview)</label><input id="n-pre" value="${escapeHtml(nl.preheader || '')}" /></div>
        <div class="form-field"><label>Segment</label>
          <select id="n-seg">
            ${SEGMENT_PRESETS.map(s => `<option value="${s.key}">${escapeHtml(s.label)}</option>`).join('')}
          </select>
          <span id="n-count" style="color:var(--silver);margin-left:10px">—</span>
        </div>
        <div id="n-composer"></div>
        <div class="modal-actions">
          <button class="btn-ghost" id="n-cancel">Close</button>
          <button class="btn-ghost" id="n-save">Save draft</button>
          <button class="btn-ghost" id="n-schedule">Schedule…</button>
          <button class="btn-primary" id="n-send">Send now</button>
        </div>
        <div class="modal-msg" id="n-msg"></div>
      </div>`;
    document.body.appendChild(o);

    let currentBlocks = nl.blocks || [];
    mountComposer({
      root: o.querySelector('#n-composer'),
      initialBlocks: currentBlocks,
      language: nl.language || 'AR',
      onChange: (b) => { currentBlocks = b; },
    });

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

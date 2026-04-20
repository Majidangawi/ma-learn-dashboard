import { api } from '../api.js';

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export default async function mount(root, params) {
  const id = params && params.id;
  if (!id) {
    root.innerHTML = '<p style="color:var(--red)">Missing newsletter id.</p>';
    return;
  }
  root.innerHTML = '<p style="color:var(--silver)">Loading…</p>';

  const [{ newsletters }, topClicksRes] = await Promise.all([
    api('/api/data/newsletters'),
    api(`/api/data/newsletters/${encodeURIComponent(id)}/top_clicks`),
  ]);

  const nl = newsletters.find(n => n.newsletterId === id);
  if (!nl) { root.innerHTML = '<p style="color:var(--silver)">Newsletter not found.</p>'; return; }
  const links = topClicksRes.links || [];

  const pct = (n) => nl.recipientCount ? ((Number(n || 0) / Number(nl.recipientCount)) * 100).toFixed(1) : '0.0';

  root.innerHTML = `
    <div dir="ltr" style="text-align:left">
    <div style="margin-bottom:14px">
      <a href="#newsletter" style="color:var(--silver);text-decoration:none">← Back to newsletters</a>
    </div>
    <h2 style="color:var(--gold);margin:0 0 4px">${escapeHtml(nl.subject || 'Untitled')}</h2>
    <p style="color:var(--silver);margin:4px 0 24px;font-size:.9rem">
      Sent ${fmtDate(nl.sentAt)} · Language: ${escapeHtml(nl.language)}
    </p>

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px">
      ${kpi(nl.recipientCount, 'Sent')}
      ${kpi(nl.deliveredCount, 'Delivered', pct(nl.deliveredCount))}
      ${kpi(nl.openCount, 'Opened', pct(nl.openCount))}
      ${kpi(nl.clickCount, 'Clicked', pct(nl.clickCount))}
    </div>

    <h3 style="color:var(--gold);margin:20px 0 10px">Top clicked links</h3>
    ${links.length ? `
      <ul style="background:var(--surface);padding:14px 30px;border-radius:10px;list-style:disc">
        ${links.map(l => `<li style="margin:4px 0;color:#ddd"><code>${escapeHtml(l.url)}</code> — ${Number(l.count).toLocaleString()} clicks</li>`).join('')}
      </ul>` : '<p style="color:var(--silver)">No click data yet.</p>'}

    <p style="color:var(--silver);font-size:.8rem;margin:18px 0">
      Unsubscribes: ${Number(nl.unsubCount || 0).toLocaleString()} (${pct(nl.unsubCount)}%) ·
      Bounces: ${Number(nl.bounceCount || 0).toLocaleString()} (${pct(nl.bounceCount)}%)
    </p>
    <p style="color:#888;font-size:.75rem">
      Open rates include proxy loads (Apple Mail Privacy). Clicks are the truer signal.
    </p>

    <div style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn-primary" id="edit-btn" title="Sent newsletters are immutable. This clones the content into a new editable draft.">Edit as new draft</button>
      <button class="btn-ghost" id="clone-btn">Clone</button>
      <button class="btn-ghost" id="resend-btn">Resend to non-openers</button>
    </div>
    <div id="stats-msg" style="color:var(--silver);margin-top:10px;font-size:.9rem"></div>
    </div>`;

  const msg = document.getElementById('stats-msg');

  document.getElementById('edit-btn').onclick = async () => {
    msg.textContent = 'Creating editable draft…';
    try {
      const r = await api('/api/writes/newsletter/clone', {
        method: 'POST',
        body: JSON.stringify({ newsletterId: id }),
      });
      if (r.ok) {
        msg.textContent = 'Draft created — opening editor…';
        // Go back to the newsletter list; the new draft will show in Drafts tab.
        window.location.hash = '#newsletter';
      } else {
        msg.textContent = `Error: ${r.error || 'unknown'}`;
      }
    } catch (e) {
      msg.textContent = `Error: ${e.message}`;
    }
  };

  document.getElementById('clone-btn').onclick = async () => {
    msg.textContent = 'Cloning…';
    try {
      const r = await api('/api/writes/newsletter/clone', {
        method: 'POST',
        body: JSON.stringify({ newsletterId: id }),
      });
      if (r.ok) {
        msg.textContent = 'Cloned — redirecting…';
        window.location.hash = '#newsletter';
      } else {
        msg.textContent = `Error: ${r.error || 'unknown'}`;
      }
    } catch (e) {
      msg.textContent = `Error: ${e.message}`;
    }
  };

  document.getElementById('resend-btn').onclick = async () => {
    if (!window.confirm('Create a resend-to-non-openers draft? You can edit it before sending.')) return;
    msg.textContent = 'Preparing resend draft…';
    try {
      const r = await api('/api/writes/newsletter/resend_non_openers', {
        method: 'POST',
        body: JSON.stringify({ newsletterId: id }),
      });
      if (r.ok) {
        msg.textContent = 'Draft created — redirecting…';
        window.location.hash = '#newsletter';
      } else {
        msg.textContent = `Error: ${r.error || 'unknown'}`;
      }
    } catch (e) {
      msg.textContent = `Error: ${e.message}`;
    }
  };
}

function kpi(n, label, pctStr) {
  return `<div style="background:var(--surface);padding:14px;border-radius:10px;text-align:center">
    <div style="font-size:1.6rem;color:var(--gold);font-weight:bold">${Number(n || 0).toLocaleString()}</div>
    <div style="color:#ccc;font-size:.9rem">${label}</div>
    ${pctStr !== undefined ? `<div style="color:#888;font-size:.8rem">${pctStr}%</div>` : ''}
  </div>`;
}

function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return String(s);
  return d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

import { api } from '../api.js';

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export default async function mount(root, params) {
  const id = params && params.id;
  if (!id) {
    root.innerHTML = '<section style="max-width:1080px; margin:0 auto; color:var(--c-danger); font-size:var(--fs-body-sm)">Missing newsletter id.</section>';
    return;
  }
  root.innerHTML = '<section style="max-width:1080px; margin:0 auto; color:var(--c-fg-3); font-size:var(--fs-body-sm)">Loading…</section>';

  const [{ newsletters }, topClicksRes] = await Promise.all([
    api('/api/data/newsletters'),
    api(`/api/data/newsletters/${encodeURIComponent(id)}/top_clicks`),
  ]);

  const nl = newsletters.find(n => n.newsletterId === id);
  if (!nl) {
    root.innerHTML = '<section style="max-width:1080px; margin:0 auto; color:var(--c-fg-3); font-size:var(--fs-body-sm)">Newsletter not found.</section>';
    return;
  }
  const links = topClicksRes.links || [];

  const pct = (n) => nl.recipientCount ? ((Number(n || 0) / Number(nl.recipientCount)) * 100).toFixed(1) : '0.0';

  const labelCapsStyle = 'font-size:var(--fs-label); font-weight:500; letter-spacing:0.08em; text-transform:uppercase; color:var(--c-fg-3)';
  const kpiNumStyle = 'font-family:Cairo, sans-serif; font-weight:200; font-size:var(--fs-display-l); line-height:1; letter-spacing:-0.015em; color:var(--c-fg); font-variant-numeric:tabular-nums';

  root.innerHTML = `
    <section dir="ltr" style="max-width:1080px; margin:0 auto; display:grid; gap:var(--s-7); text-align:left">

      <section style="display:grid; gap:var(--s-3)">
        <div>
          <button data-ui="btn" data-variant="ghost" id="back-btn">← Back to newsletters</button>
        </div>
        <div style="display:grid; gap:var(--s-2)">
          <h1 style="margin:0; font-family:Cairo, sans-serif; font-weight:300; font-size:var(--fs-display-s, 28px); letter-spacing:-0.01em; color:var(--c-fg)">
            ${escapeHtml(nl.subject || 'Untitled')}
          </h1>
          <div style="${labelCapsStyle}">
            Sent ${fmtDate(nl.sentAt)} · Language ${escapeHtml(nl.language)}
          </div>
        </div>
      </section>

      <hr data-ui="hairline">

      <section>
        <div style="${labelCapsStyle}; margin-bottom:var(--s-4)">Performance</div>
        <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:var(--s-5)">
          ${kpi(nl.recipientCount, 'Sent')}
          ${kpi(nl.deliveredCount, 'Delivered', pct(nl.deliveredCount))}
          ${kpi(nl.openCount, 'Opened', pct(nl.openCount))}
          ${kpi(nl.clickCount, 'Clicked', pct(nl.clickCount))}
        </div>
      </section>

      <hr data-ui="hairline">

      <section>
        <div style="${labelCapsStyle}; margin-bottom:var(--s-4)">Top clicked links</div>
        ${links.length ? `
          <div class="nl-links" style="display:grid; gap:0">
            ${links.map((l, i) => {
              const isLast = i === links.length - 1;
              const rowStyle = [
                'display:grid',
                'grid-template-columns: 1fr auto',
                'gap:var(--s-3)',
                'align-items:center',
                'padding:var(--s-3) 0',
                isLast ? '' : 'border-bottom:0.5px solid var(--c-ink-4)',
              ].filter(Boolean).join(';');
              return `
                <div style="${rowStyle}">
                  <code style="font-size:var(--fs-body-sm); color:var(--c-fg-2); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0">${escapeHtml(l.url)}</code>
                  <span class="tnum" style="font-size:var(--fs-body-sm); color:var(--c-fg); font-variant-numeric:tabular-nums; flex-shrink:0">${Number(l.count).toLocaleString()} clicks</span>
                </div>`;
            }).join('')}
          </div>
        ` : '<div style="color:var(--c-fg-3); font-size:var(--fs-body-sm)">No click data yet.</div>'}
      </section>

      <hr data-ui="hairline">

      <section style="display:grid; gap:var(--s-2)">
        <div class="tnum" style="color:var(--c-fg-2); font-size:var(--fs-body-sm); font-variant-numeric:tabular-nums">
          Unsubscribes: ${Number(nl.unsubCount || 0).toLocaleString()} (${pct(nl.unsubCount)}%) ·
          Bounces: ${Number(nl.bounceCount || 0).toLocaleString()} (${pct(nl.bounceCount)}%)
        </div>
        <div style="color:var(--c-fg-3); font-size:var(--fs-body-sm)">
          Open rates include proxy loads (Apple Mail Privacy). Clicks are the truer signal.
        </div>
      </section>

      <section style="display:flex; gap:var(--s-2); flex-wrap:wrap">
        <button data-ui="btn" data-variant="primary" id="edit-btn" title="Sent newsletters are immutable. This clones the content into a new editable draft.">Edit as new draft</button>
        <button data-ui="btn" data-variant="secondary" id="clone-btn">Clone</button>
        <button data-ui="btn" data-variant="secondary" id="resend-btn">Resend to non-openers</button>
      </section>

      <div id="stats-msg" style="color:var(--c-fg-3); font-size:var(--fs-body-sm)"></div>

    </section>`;

  const backBtn = document.getElementById('back-btn');
  if (backBtn) backBtn.onclick = () => { window.location.hash = '#newsletter'; };

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

  function kpi(n, label, pctStr) {
    return `<div style="display:grid; gap:var(--s-2); padding:var(--s-2) 0">
      <div style="${labelCapsStyle}">${label}</div>
      <div style="${kpiNumStyle}">${Number(n || 0).toLocaleString()}</div>
      ${pctStr !== undefined ? `<div class="tnum" style="color:var(--c-fg-3); font-size:var(--fs-body-sm); font-variant-numeric:tabular-nums">${pctStr}%</div>` : ''}
    </div>`;
  }
}

function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return String(s);
  return d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

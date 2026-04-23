import { api } from '../api.js';
import { mountComposer } from '../composer/index.js';

const SOURCE_LABELS = { buyer: 'buyer', waitlist: 'waitlist', website: 'website', lib: 'lib' };
const PRODUCT_LABELS = {
  'intro-to-creative-ai':   'T2',
  'creative-ai-workshop-t3': 'T3',
  'beyond-lighting':         'BL',
  'prompt-pack':             'PP',
};

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function initials(name, email) {
  const src = (name || email || '?').trim();
  const parts = src.split(/[\s@]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

function relativeTime(iso) {
  if (!iso) return '—';
  const then = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T'));
  if (Number.isNaN(then.getTime())) return '—';
  const diffMs = Date.now() - then.getTime();
  const day = 24 * 60 * 60 * 1000;
  if (diffMs < day) return 'today';
  if (diffMs < 2 * day) return 'yesterday';
  if (diffMs < 30 * day) return `${Math.floor(diffMs / day)} days ago`;
  if (diffMs < 365 * day) return `${Math.floor(diffMs / (30 * day))} months ago`;
  return `${Math.floor(diffMs / (365 * day))} years ago`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function renderChip(type, key) {
  const cls = type === 'source' ? `chip source-${key}` : 'chip product';
  const label = type === 'source' ? (SOURCE_LABELS[key] || key) : (PRODUCT_LABELS[key] || key);
  return `<span class="${cls}">${escapeHtml(label)}</span>`;
}

export default async function mount(root) {
  root.innerHTML = '<div class="contacts-page" dir="ltr"><div class="contacts-list">Loading…</div><div class="contacts-detail empty">Select a contact on the left</div></div>';

  const state = {
    rows: [],
    selectedEmail: null,
    selectedDetail: null,
    filters: { status: 'all', sources: [], products: [], language: 'all', q: '', sort: 'activity' },
  };
  let searchTimer = null;

  async function loadList() {
    const q = new URLSearchParams();
    if (state.filters.status !== 'all') q.set('status', state.filters.status);
    if (state.filters.sources.length) q.set('sources', state.filters.sources.join(','));
    if (state.filters.products.length) q.set('products', state.filters.products.join(','));
    if (state.filters.language !== 'all') q.set('language', state.filters.language);
    if (state.filters.q) q.set('q', state.filters.q);
    if (state.filters.sort) q.set('sort', state.filters.sort);
    const { contacts } = await api('/api/data/contacts?' + q.toString());
    state.rows = contacts;
    renderList();
  }

  async function loadDetail(email) {
    if (!email) { state.selectedDetail = null; renderDetail(); return; }
    state.selectedEmail = email;
    renderDetail({ loading: true });
    try {
      const { contact } = await api('/api/data/contacts/' + encodeURIComponent(email));
      state.selectedDetail = contact;
    } catch (e) {
      state.selectedDetail = { error: e.message };
    }
    renderDetail();
  }

  function render() {
    root.innerHTML = `
      <div class="contacts-page" dir="ltr">
        <aside class="contacts-list" id="contacts-list"></aside>
        <section class="contacts-detail ${state.selectedDetail ? '' : 'empty'}" id="contacts-detail"></section>
      </div>`;
    renderList();
    renderDetail();
  }

  function renderList() {
    const el = document.getElementById('contacts-list');
    if (!el) return;
    const unsubCount = state.rows.filter(r => r.status === 'unsubscribed').length;
    el.innerHTML = `
      <div class="contacts-head">
        <h2>Contacts</h2>
        <p class="sub">${state.rows.length} contacts · ${unsubCount} unsubscribed</p>
      </div>
      <div class="contacts-search">
        <input id="c-search" type="search" placeholder="Search by name or email…" value="${escapeHtml(state.filters.q)}" />
      </div>
      <div class="contacts-filters">
        <select id="c-status">
          <option value="all" ${state.filters.status==='all'?'selected':''}>All status</option>
          <option value="active" ${state.filters.status==='active'?'selected':''}>Active</option>
          <option value="unsubscribed" ${state.filters.status==='unsubscribed'?'selected':''}>Unsubscribed</option>
          <option value="bounced" ${state.filters.status==='bounced'?'selected':''}>Bounced</option>
        </select>
        <select id="c-source">
          <option value="">All sources</option>
          <option value="buyer">Buyer</option>
          <option value="waitlist">Waitlist</option>
          <option value="website">Website</option>
          <option value="lib">Link-in-bio</option>
        </select>
        <select id="c-product">
          <option value="">All products</option>
          <option value="intro-to-creative-ai">T2</option>
          <option value="creative-ai-workshop-t3">T3</option>
          <option value="beyond-lighting">BL</option>
          <option value="prompt-pack">PP</option>
          <option value="__nonbuyer">Non-buyers</option>
        </select>
        <select id="c-language">
          <option value="all" ${state.filters.language==='all'?'selected':''}>AR + EN</option>
          <option value="AR" ${state.filters.language==='AR'?'selected':''}>AR</option>
          <option value="EN" ${state.filters.language==='EN'?'selected':''}>EN</option>
        </select>
        <select id="c-sort">
          <option value="activity" ${state.filters.sort==='activity'?'selected':''}>Sort: last activity</option>
          <option value="added"    ${state.filters.sort==='added'   ?'selected':''}>Sort: added date</option>
          <option value="name"     ${state.filters.sort==='name'    ?'selected':''}>Sort: name A→Z</option>
        </select>
      </div>
      <div class="contacts-rows">
        ${state.rows.length === 0 ? '<p style="color:var(--c-ink-3);padding:20px 0;text-align:center">No contacts match.</p>' :
          state.rows.map(r => `
            <div class="contact-row ${state.selectedEmail===r.email?'active':''} ${r.status==='unsubscribed'?'unsub':''}" data-email="${escapeHtml(r.email)}">
              <div class="contact-avatar">${escapeHtml(initials(r.name, r.email))}</div>
              <div class="contact-body">
                <div class="contact-name">${escapeHtml(r.name || '—')}</div>
                <div class="contact-email">${escapeHtml(r.email)}</div>
                <div class="contact-chips">
                  ${r.sources.map(s => renderChip('source', s)).join('')}
                  ${r.productsBought.map(p => renderChip('product', p)).join('')}
                </div>
                <div class="contact-activity">${escapeHtml(relativeTime(r.lastActivityAt))}</div>
              </div>
            </div>`).join('')}
      </div>`;

    // Wire filter + search handlers.
    document.getElementById('c-status').onchange   = e => { state.filters.status   = e.target.value; loadList(); };
    document.getElementById('c-language').onchange = e => { state.filters.language = e.target.value; loadList(); };
    document.getElementById('c-sort').onchange     = e => { state.filters.sort     = e.target.value; loadList(); };
    document.getElementById('c-source').onchange   = e => { state.filters.sources  = e.target.value ? [e.target.value] : []; loadList(); };
    document.getElementById('c-product').onchange  = e => { state.filters.products = e.target.value ? [e.target.value] : []; loadList(); };
    document.getElementById('c-search').oninput    = e => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { state.filters.q = e.target.value; loadList(); }, 200);
    };
    el.querySelectorAll('.contact-row').forEach(row => {
      row.onclick = () => loadDetail(row.dataset.email);
    });
  }

  function renderDetail(opts = {}) {
    const el = document.getElementById('contacts-detail');
    if (!el) return;
    if (opts.loading) {
      el.className = 'contacts-detail';
      el.innerHTML = '<p style="color:var(--c-ink-3)">Loading…</p>';
      return;
    }
    if (!state.selectedDetail) {
      el.className = 'contacts-detail empty';
      el.innerHTML = 'Select a contact on the left';
      return;
    }
    if (state.selectedDetail.error) {
      el.className = 'contacts-detail';
      el.innerHTML = `<p style="color:var(--c-danger)">Error: ${escapeHtml(state.selectedDetail.error)}</p>`;
      return;
    }
    const c = state.selectedDetail;
    el.className = 'contacts-detail';
    el.innerHTML = `
      <div class="detail-head">
        <div>
          <h2>${escapeHtml(c.name || '—')}</h2>
          <div class="detail-email">
            <span>${escapeHtml(c.email)}</span>
            <button class="copy" id="d-copy" title="Copy email to clipboard">📋</button>
          </div>
          <div class="detail-meta">
            ${escapeHtml(c.status === 'active' ? 'Active' : c.status)} · ${escapeHtml(c.language)}${c.phone ? ' · ' + escapeHtml(c.phone) : ''}
          </div>
        </div>
        <button class="detail-close" id="d-close" title="Close">×</button>
      </div>

      <div class="action-bar" id="d-actions">
        <button class="primary" data-act="email">✉ Send email</button>
        <button data-act="resend" ${c.tokens.length===0?'disabled title="No active courses to resend"':''}>🔗 Resend link</button>
        <button data-act="gift">🎁 Gift</button>
        <button class="danger" data-act="delete">🗑 Delete</button>
      </div>

      <div class="detail-section">
        <h3>Sources</h3>
        ${c.sources.map(s => `<div class="row"><span class="row-title">${escapeHtml(SOURCE_LABELS[s] || s)}</span></div>`).join('')}
      </div>

      <div class="detail-section">
        <h3>Purchases (${c.purchases.length})</h3>
        ${c.purchases.length === 0 ? '<p style="color:var(--c-ink-3);font-size:.85rem">No purchases yet.</p>' :
          c.purchases.map(p => `
            <div class="row">
              <div class="row-title">${escapeHtml(PRODUCT_LABELS[p.product] || p.product)}</div>
              <div class="row-meta">
                ${Number(p.amountSAR).toLocaleString()} SAR${p.coupon ? ' · coupon ' + escapeHtml(p.coupon) : ''} · ${escapeHtml(fmtDate(p.purchasedAt))}
                ${p.paymentId ? '<br>Payment: <code>' + escapeHtml(p.paymentId) + '</code>' : ''}
              </div>
            </div>`).join('')}
      </div>

      <div class="detail-section">
        <h3>Tokens (${c.tokens.length})</h3>
        ${c.tokens.length === 0 ? '<p style="color:var(--c-ink-3);font-size:.85rem">No tokens assigned.</p>' :
          c.tokens.map((t, i) => `
            <div class="token-row">
              <span class="product">${escapeHtml(PRODUCT_LABELS[t.product] || t.product)}</span>
              <code data-idx="${i}">${'█'.repeat(Math.min(16, t.token.length))}</code>
              <span class="status">${escapeHtml(t.status)}</span>
              <button class="reveal" data-idx="${i}">reveal</button>
            </div>`).join('')}
      </div>

      <div class="detail-section">
        <h3>Metadata</h3>
        <div class="row">
          <div class="row-meta">
            Added: ${escapeHtml(fmtDate(c.addedAt))}<br>
            Last activity: ${escapeHtml(fmtDate(c.lastActivityAt))}
          </div>
        </div>
      </div>`;

    // Wire copy + close + token reveal.
    document.getElementById('d-close').onclick = () => {
      state.selectedEmail = null; state.selectedDetail = null; render();
    };
    document.getElementById('d-copy').onclick = async () => {
      try { await navigator.clipboard.writeText(c.email); toast('Email copied ✓', 'success'); }
      catch { toast('Copy failed', 'error'); }
    };
    el.querySelectorAll('button.reveal').forEach(btn => {
      btn.onclick = () => {
        const idx = Number(btn.dataset.idx);
        const codeEl = el.querySelector(`code[data-idx="${idx}"]`);
        if (codeEl.textContent.startsWith('█')) {
          codeEl.textContent = c.tokens[idx].token;
          btn.textContent = 'copy';
        } else {
          navigator.clipboard.writeText(c.tokens[idx].token);
          toast('Token copied ✓', 'success');
        }
      };
    });

    el.querySelectorAll('.action-bar button').forEach(btn => {
      btn.onclick = () => onAction(btn.dataset.act, c);
    });

    // Keyboard nav: Escape closes, j/k & arrows move between rows.
    document.onkeydown = (e) => {
      if (e.key === 'Escape' && state.selectedEmail) {
        state.selectedEmail = null; state.selectedDetail = null; render();
      } else if (['j', 'ArrowDown', 'k', 'ArrowUp'].includes(e.key) && state.selectedEmail) {
        const idx = state.rows.findIndex(r => r.email === state.selectedEmail);
        if (idx === -1) return;
        const delta = (e.key === 'j' || e.key === 'ArrowDown') ? 1 : -1;
        const next = state.rows[idx + delta];
        if (next) { e.preventDefault(); loadDetail(next.email); }
      }
    };
  }

  function toast(msg, kind) {
    const prev = document.querySelector('.contacts-toast');
    if (prev) prev.remove();
    const t = document.createElement('div');
    t.className = 'contacts-toast ' + (kind || '');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  async function onAction(act, c) {
    if (act === 'email')   return actionSendEmail(c);
    if (act === 'resend')  return actionResendLink(c);
    if (act === 'gift')    return actionGift(c);
    if (act === 'delete')  return actionDelete(c);
  }

  function actionSendEmail(c) {
    const o = document.createElement('div');
    o.className = 'modal-overlay';
    o.innerHTML = `
      <div class="modal-card" style="max-width:1100px;max-height:92vh;overflow-y:auto">
        <h3>Send email to ${escapeHtml(c.name || c.email)}</h3>
        <p style="color:var(--c-ink-2);font-size:.85rem;margin-bottom:10px">
          Recipient: <strong>${escapeHtml(c.email)}</strong>
        </p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="form-field"><label>Subject</label><input id="e-subj" value="" /></div>
          <div class="form-field"><label>Language</label>
            <select id="e-lang">
              <option value="${c.language}">${c.language==='AR'?'العربية':'English'}</option>
              <option value="${c.language==='AR'?'EN':'AR'}">${c.language==='AR'?'English':'العربية'}</option>
            </select></div>
        </div>
        <div id="e-composer"></div>
        <div class="modal-actions">
          <button class="btn-ghost" id="e-cancel">Cancel</button>
          <button class="btn-primary" id="e-send">Send</button>
        </div>
        <div class="modal-msg" id="e-msg"></div>
      </div>`;
    document.body.appendChild(o);
    o.addEventListener('mousedown', e => { if (e.target === o) o.remove(); });

    let blocks = [];
    const subjEl = o.querySelector('#e-subj');
    const comp = mountComposer({
      root: o.querySelector('#e-composer'),
      initialBlocks: [],
      language: c.language,
      onChange: b => { blocks = b; },
      getHeader: () => ({ subject: subjEl.value, preheader: '' }),
    });
    subjEl.addEventListener('input', () => comp.refreshPreview());

    o.querySelector('#e-cancel').onclick = () => o.remove();
    o.querySelector('#e-send').onclick = async () => {
      const subject = subjEl.value.trim();
      if (!subject) { o.querySelector('#e-msg').textContent = 'Subject required.'; return; }
      o.querySelector('#e-msg').textContent = 'Sending…';
      try {
        const save = await api('/api/writes/newsletter/save', {
          method: 'POST',
          body: JSON.stringify({
            subject, preheader: '',
            language: o.querySelector('#e-lang').value,
            blocks,
            segmentFilter: { onlyEmails: [c.email] },
          }),
        });
        const send = await api('/api/writes/newsletter/send_now', {
          method: 'POST',
          body: JSON.stringify({ newsletterId: save.newsletterId }),
        });
        if (send.ok) {
          o.querySelector('#e-msg').textContent = `Sent to ${send.sent} recipient.`;
          setTimeout(() => o.remove(), 1200);
        } else {
          o.querySelector('#e-msg').textContent = `Error: ${send.error || 'unknown'}`;
        }
      } catch (e) {
        o.querySelector('#e-msg').textContent = `Error: ${e.message}`;
      }
    };
  }

  async function actionResendLink(c) {
    if (c.tokens.length === 0) return;
    let product;
    if (c.tokens.length === 1) {
      product = c.tokens[0].product;
    } else {
      const options = c.tokens.map((t, i) => `${i + 1}. ${PRODUCT_LABELS[t.product] || t.product}`).join('\n');
      const pick = prompt(`Which course to resend?\n${options}\n\nType 1–${c.tokens.length}:`);
      const idx = Number(pick) - 1;
      if (!(idx >= 0 && idx < c.tokens.length)) return;
      product = c.tokens[idx].product;
    }
    toast('Resending…');
    try {
      const r = await api('/api/writes/contact/resend_link', {
        method: 'POST', body: JSON.stringify({ email: c.email, product }),
      });
      if (r.ok) toast(`Resent ${PRODUCT_LABELS[product] || product} access ✓`, 'success');
      else toast(`Error: ${r.error || 'unknown'}`, 'error');
    } catch (e) {
      toast(`Error: ${e.message}`, 'error');
    }
  }

  function actionGift(c) {
    const o = document.createElement('div');
    o.className = 'modal-overlay';
    o.innerHTML = `
      <div class="modal-card" style="max-width:480px">
        <h3>Gift access to ${escapeHtml(c.name || c.email)}</h3>
        <div class="form-field">
          <label>Which course?</label>
          <select id="g-product">
            <option value="">— Pick —</option>
            <option value="intro-to-creative-ai">T2 — Intro to Creative AI</option>
            <option value="creative-ai-workshop-t3">T3 — Creative AI Workshop</option>
            <option value="beyond-lighting">Beyond Lighting</option>
            <option value="prompt-pack">Prompt Pack</option>
          </select>
        </div>
        <div class="form-field">
          <label>Optional note (included in the email)</label>
          <textarea id="g-note" rows="3"></textarea>
        </div>
        <div class="modal-actions">
          <button class="btn-ghost" id="g-cancel">Cancel</button>
          <button class="btn-primary" id="g-go">Gift it</button>
        </div>
        <div class="modal-msg" id="g-msg"></div>
      </div>`;
    document.body.appendChild(o);
    o.addEventListener('mousedown', e => { if (e.target === o) o.remove(); });
    o.querySelector('#g-cancel').onclick = () => o.remove();
    o.querySelector('#g-go').onclick = async () => {
      const product = o.querySelector('#g-product').value;
      const note = o.querySelector('#g-note').value.trim();
      if (!product) { o.querySelector('#g-msg').textContent = 'Pick a course.'; return; }
      o.querySelector('#g-msg').textContent = 'Gifting…';
      try {
        const r = await api('/api/writes/contact/gift', {
          method: 'POST', body: JSON.stringify({ email: c.email, product, name: c.name, note }),
        });
        if (r.ok) {
          o.querySelector('#g-msg').textContent = 'Gifted ✓ — detail refreshing…';
          setTimeout(async () => {
            o.remove();
            await loadDetail(c.email);
            await loadList();
          }, 900);
        } else {
          o.querySelector('#g-msg').textContent = `Error: ${r.error || 'unknown'}`;
        }
      } catch (e) {
        o.querySelector('#g-msg').textContent = `Error: ${e.message}`;
      }
    };
  }

  function actionDelete(c) {
    const o = document.createElement('div');
    o.className = 'modal-overlay';
    o.innerHTML = `
      <div class="modal-card" style="max-width:480px">
        <h3>Delete this contact?</h3>
        <div class="delete-preview">
          <div class="n">${escapeHtml(c.name || '—')}</div>
          <div class="e">${escapeHtml(c.email)}</div>
          <div class="facts">
            Sources: ${escapeHtml(c.sources.join(', ') || '—')}<br>
            ${c.purchases.length} purchases · ${c.tokens.length} tokens
          </div>
        </div>
        <p style="color:var(--c-ink-2);font-size:.85rem;line-height:1.5">
          This removes their row from the Subscribers sheet. Their purchase
          history, tokens, and access stay intact — they can still log in with
          existing access links. They simply stop receiving newsletters and
          won't appear in Contacts.
        </p>
        <p style="color:var(--c-ink-3);font-size:.78rem">
          To fully revoke access, edit the Tokens sheet directly.
        </p>
        <div class="modal-actions">
          <button class="btn-ghost" id="x-cancel">Cancel</button>
          <button class="btn-primary" id="x-go" style="background:var(--c-danger);color:#fff">Delete this contact</button>
        </div>
        <div class="modal-msg" id="x-msg"></div>
      </div>`;
    document.body.appendChild(o);
    o.addEventListener('mousedown', e => { if (e.target === o) o.remove(); });
    o.querySelector('#x-cancel').onclick = () => o.remove();
    o.querySelector('#x-go').onclick = async () => {
      o.querySelector('#x-msg').textContent = 'Deleting…';
      try {
        const r = await api('/api/writes/contact/delete', {
          method: 'POST', body: JSON.stringify({ email: c.email }),
        });
        if (r.ok) {
          o.remove();
          toast('Deleted ✓', 'success');
          state.selectedEmail = null; state.selectedDetail = null;
          await loadList();
          render();
        } else {
          o.querySelector('#x-msg').textContent = `Error: ${r.error || 'unknown'}`;
        }
      } catch (e) {
        o.querySelector('#x-msg').textContent = `Error: ${e.message}`;
      }
    };
  }

  render();
  await loadList();
}

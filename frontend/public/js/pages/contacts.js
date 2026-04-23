import { api } from '../api.js';
import { mountComposer } from '../composer/index.js';
import { icon } from '../ui/icons.js';

const SOURCE_LABELS = { buyer: 'buyer', waitlist: 'waitlist', website: 'website', lib: 'lib' };
const PRODUCT_LABELS = {
  'intro-to-creative-ai':   'T2',
  'creative-ai-workshop-t3': 'T3',
  'beyond-lighting':         'BL',
  'prompt-pack':             'PP',
};

// Source → tone mapping for the primitive tag component.
const SOURCE_TONE = {
  buyer:    'gold',
  waitlist: 'warning',
  website:  'default',
  lib:      'default',
};

// Status filter "tabs" — newsletter-style underline chips.
const STATUS_TABS = [
  { key: 'all',          label: 'All' },
  { key: 'active',       label: 'Active' },
  { key: 'unsubscribed', label: 'Unsubscribed' },
  { key: 'bounced',      label: 'Bounced' },
];

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

function renderSourceTag(key) {
  const tone = SOURCE_TONE[key] || 'default';
  const label = SOURCE_LABELS[key] || key;
  const toneAttr = tone === 'default' ? '' : ` data-tone="${tone}"`;
  return `<span data-ui="tag"${toneAttr}>${escapeHtml(label)}</span>`;
}

function renderProductTag(key) {
  const label = PRODUCT_LABELS[key] || key;
  return `<span data-ui="tag">${escapeHtml(label)}</span>`;
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
        <p class="sub">${state.rows.length} contacts · ${unsubCount} unsubscribed</p>
      </div>

      <nav class="contacts-tabs">
        ${STATUS_TABS.map(t => {
          const isActive = t.key === state.filters.status;
          const tabStyle = [
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
          return `<button class="c-tab" data-tab="${t.key}" style="${tabStyle}">${t.label}</button>`;
        }).join('')}
      </nav>

      <div class="contacts-search" data-ui="field">
        <label for="c-search">Search</label>
        <input id="c-search" data-ui="input" type="search" placeholder="Name or email…" value="${escapeHtml(state.filters.q)}" />
      </div>

      <div class="contacts-filters">
        <div data-ui="field">
          <label for="c-source">Source</label>
          <select id="c-source" data-ui="select">
            <option value="">All sources</option>
            <option value="buyer">Buyer</option>
            <option value="waitlist">Waitlist</option>
            <option value="website">Website</option>
            <option value="lib">Link-in-bio</option>
          </select>
        </div>
        <div data-ui="field">
          <label for="c-product">Product</label>
          <select id="c-product" data-ui="select">
            <option value="">All products</option>
            <option value="intro-to-creative-ai">T2</option>
            <option value="creative-ai-workshop-t3">T3</option>
            <option value="beyond-lighting">BL</option>
            <option value="prompt-pack">PP</option>
            <option value="__nonbuyer">Non-buyers</option>
          </select>
        </div>
        <div data-ui="field">
          <label for="c-language">Language</label>
          <select id="c-language" data-ui="select">
            <option value="all" ${state.filters.language==='all'?'selected':''}>AR + EN</option>
            <option value="AR" ${state.filters.language==='AR'?'selected':''}>AR</option>
            <option value="EN" ${state.filters.language==='EN'?'selected':''}>EN</option>
          </select>
        </div>
        <div data-ui="field">
          <label for="c-sort">Sort</label>
          <select id="c-sort" data-ui="select">
            <option value="activity" ${state.filters.sort==='activity'?'selected':''}>Last activity</option>
            <option value="added"    ${state.filters.sort==='added'   ?'selected':''}>Added date</option>
            <option value="name"     ${state.filters.sort==='name'    ?'selected':''}>Name A→Z</option>
          </select>
        </div>
      </div>

      <div class="contacts-rows">
        ${state.rows.length === 0
          ? '<p style="color:var(--c-fg-3);padding:var(--s-5) 0;text-align:center;font-size:var(--fs-body-sm)">No contacts match.</p>'
          : state.rows.map(r => `
            <div class="contact-row ${state.selectedEmail===r.email?'active':''} ${r.status==='unsubscribed'?'unsub':''}" data-email="${escapeHtml(r.email)}">
              <div data-ui="avatar">${escapeHtml(initials(r.name, r.email))}</div>
              <div class="contact-body">
                <div class="contact-name">${escapeHtml(r.name || '—')}</div>
                <div class="contact-email">${escapeHtml(r.email)}</div>
                <div class="contact-chips">
                  ${r.sources.map(s => renderSourceTag(s)).join('')}
                  ${r.productsBought.map(p => renderProductTag(p)).join('')}
                </div>
                <div class="contact-activity">${escapeHtml(relativeTime(r.lastActivityAt))}</div>
              </div>
            </div>`).join('')}
      </div>`;

    // Status tabs.
    el.querySelectorAll('.c-tab').forEach(btn => {
      btn.onclick = () => { state.filters.status = btn.dataset.tab; loadList(); };
    });
    // Filter/search handlers.
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
      el.innerHTML = '<p style="color:var(--c-fg-3)">Loading…</p>';
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

    // Build a combined timeline: purchases + tokens (gifted/assigned).
    const events = [];
    (c.purchases || []).forEach(p => events.push({
      ts: p.purchasedAt,
      kind: 'purchase',
      title: `Bought ${PRODUCT_LABELS[p.product] || p.product}`,
      meta: `${Number(p.amountSAR).toLocaleString()} SAR${p.coupon ? ' · coupon ' + p.coupon : ''}${p.paymentId ? ' · ' + p.paymentId : ''}`,
    }));
    (c.tokens || []).forEach(t => events.push({
      ts: t.assignedAt || t.createdAt || c.addedAt,
      kind: 'token',
      title: `Access granted · ${PRODUCT_LABELS[t.product] || t.product}`,
      meta: t.status ? t.status : '',
    }));
    events.sort((a, b) => new Date(b.ts || 0) - new Date(a.ts || 0));

    el.innerHTML = `
      <div class="detail-head">
        <div class="detail-head-main">
          <div data-ui="avatar" data-size="lg">${escapeHtml(initials(c.name, c.email))}</div>
          <div class="detail-head-text">
            <h1 class="detail-name">${escapeHtml(c.name || '—')}</h1>
            <div class="detail-email">
              <span class="detail-email-value">${escapeHtml(c.email)}</span>
            </div>
            <div class="detail-tags">
              ${(c.sources || []).map(s => renderSourceTag(s)).join('')}
              <span class="detail-meta-inline">${escapeHtml(c.status === 'active' ? 'Active' : c.status)} · ${escapeHtml(c.language)}${c.phone ? ' · ' + escapeHtml(c.phone) : ''}</span>
            </div>
          </div>
        </div>
        <button class="detail-close" data-ui="btn" data-variant="ghost" id="d-close" title="Close" aria-label="Close">${icon('x', { size: 18 })}</button>
      </div>

      <div class="action-bar" id="d-actions">
        <button class="btn-primary" data-ui="btn" data-variant="primary" data-act="email">${icon('mail', { size: 16 })}<span>Send email</span></button>
        <button class="btn-ghost" data-ui="btn" data-variant="ghost" data-act="resend" ${c.tokens.length===0?'disabled title="No active courses to resend"':''}>${icon('link', { size: 16 })}<span>Resend link</span></button>
        <button class="btn-ghost" data-ui="btn" data-variant="ghost" data-act="gift">${icon('gift', { size: 16 })}<span>Gift</span></button>
        <button class="btn-ghost" data-ui="btn" data-variant="ghost" data-act="copy" id="d-copy">${icon('copy', { size: 16 })}<span>Copy email</span></button>
        <button class="btn-ghost btn-danger" data-ui="btn" data-variant="ghost" data-act="delete">${icon('trash-2', { size: 16 })}<span>Delete</span></button>
      </div>

      <div class="detail-section">
        <h3>Activity</h3>
        ${events.length === 0
          ? '<p class="detail-empty">No activity yet.</p>'
          : `<div class="timeline">${events.map(ev => `
              <div class="timeline-row">
                <div class="timeline-row-main">
                  <div class="timeline-title">${escapeHtml(ev.title)}</div>
                  ${ev.meta ? `<div class="timeline-meta">${escapeHtml(ev.meta)}</div>` : ''}
                </div>
                <div class="timeline-when">${escapeHtml(relativeTime(ev.ts))}</div>
              </div>`).join('')}</div>`}
      </div>

      <div class="detail-section">
        <h3>Purchases (${c.purchases.length})</h3>
        ${c.purchases.length === 0
          ? '<p class="detail-empty">No purchases yet.</p>'
          : `<div class="timeline">${c.purchases.map(p => `
              <div class="timeline-row">
                <div class="timeline-row-main">
                  <div class="timeline-title">${escapeHtml(PRODUCT_LABELS[p.product] || p.product)}</div>
                  <div class="timeline-meta">
                    ${Number(p.amountSAR).toLocaleString()} SAR${p.coupon ? ' · coupon ' + escapeHtml(p.coupon) : ''} · ${escapeHtml(fmtDate(p.purchasedAt))}
                    ${p.paymentId ? '<br>Payment: <code>' + escapeHtml(p.paymentId) + '</code>' : ''}
                  </div>
                </div>
              </div>`).join('')}</div>`}
      </div>

      <div class="detail-section">
        <h3>Tokens (${c.tokens.length})</h3>
        ${c.tokens.length === 0
          ? '<p class="detail-empty">No tokens assigned.</p>'
          : c.tokens.map((t, i) => `
              <div class="token-row">
                <span data-ui="tag" data-tone="gold">${escapeHtml(PRODUCT_LABELS[t.product] || t.product)}</span>
                <code data-idx="${i}">${'█'.repeat(Math.min(16, t.token.length))}</code>
                <span data-ui="tag">${escapeHtml(t.status)}</span>
                <button class="reveal" data-ui="btn" data-variant="ghost" data-idx="${i}">reveal</button>
              </div>`).join('')}
      </div>

      <div class="detail-section">
        <h3>Metadata</h3>
        <div class="timeline">
          <div class="timeline-row">
            <div class="timeline-row-main">
              <div class="timeline-meta">
                Added: ${escapeHtml(fmtDate(c.addedAt))}<br>
                Last activity: ${escapeHtml(fmtDate(c.lastActivityAt))}
              </div>
            </div>
          </div>
        </div>
      </div>`;

    // Wire close + token reveal.
    document.getElementById('d-close').onclick = () => {
      state.selectedEmail = null; state.selectedDetail = null; render();
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
    if (act === 'copy')    return actionCopyEmail(c);
    if (act === 'delete')  return actionDelete(c);
  }

  async function actionCopyEmail(c) {
    try { await navigator.clipboard.writeText(c.email); toast('Email copied ✓', 'success'); }
    catch { toast('Copy failed', 'error'); }
  }

  function actionSendEmail(c) {
    const o = document.createElement('div');
    o.className = 'modal-overlay';
    o.innerHTML = `
      <div class="modal-card" style="max-width:1100px;max-height:92vh;overflow-y:auto">
        <h3>Send email to ${escapeHtml(c.name || c.email)}</h3>
        <p style="color:var(--c-fg-2);font-size:var(--fs-body-sm);margin-bottom:var(--s-3)">
          Recipient: <strong>${escapeHtml(c.email)}</strong>
        </p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s-3)">
          <div data-ui="field"><label>Subject</label><input data-ui="input" id="e-subj" value="" /></div>
          <div data-ui="field"><label>Language</label>
            <select data-ui="select" id="e-lang">
              <option value="${c.language}">${c.language==='AR'?'العربية':'English'}</option>
              <option value="${c.language==='AR'?'EN':'AR'}">${c.language==='AR'?'English':'العربية'}</option>
            </select></div>
        </div>
        <div id="e-composer"></div>
        <div class="modal-actions">
          <button class="btn-ghost" data-ui="btn" data-variant="ghost" id="e-cancel">Cancel</button>
          <button class="btn-primary" data-ui="btn" data-variant="primary" id="e-send">Send</button>
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
        <div data-ui="field">
          <label>Which course?</label>
          <select data-ui="select" id="g-product">
            <option value="">— Pick —</option>
            <option value="intro-to-creative-ai">T2 — Intro to Creative AI</option>
            <option value="creative-ai-workshop-t3">T3 — Creative AI Workshop</option>
            <option value="beyond-lighting">Beyond Lighting</option>
            <option value="prompt-pack">Prompt Pack</option>
          </select>
        </div>
        <div data-ui="field">
          <label>Optional note (included in the email)</label>
          <textarea data-ui="textarea" id="g-note" rows="3"></textarea>
        </div>
        <div class="modal-actions">
          <button class="btn-ghost" data-ui="btn" data-variant="ghost" id="g-cancel">Cancel</button>
          <button class="btn-primary" data-ui="btn" data-variant="primary" id="g-go">Gift it</button>
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
        <p style="color:var(--c-fg-2);font-size:var(--fs-body-sm);line-height:1.5">
          This removes their row from the Subscribers sheet. Their purchase
          history, tokens, and access stay intact — they can still log in with
          existing access links. They simply stop receiving newsletters and
          won't appear in Contacts.
        </p>
        <p style="color:var(--c-fg-3);font-size:var(--fs-label)">
          To fully revoke access, edit the Tokens sheet directly.
        </p>
        <div class="modal-actions">
          <button class="btn-ghost" data-ui="btn" data-variant="ghost" id="x-cancel">Cancel</button>
          <button class="btn-primary" data-ui="btn" data-variant="primary" id="x-go" style="background:var(--c-danger);color:#fff">Delete this contact</button>
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

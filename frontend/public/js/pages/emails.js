import { api } from '../api.js';
import { openApprovalModal, renderSendEmailPreview } from '../ui/approval-modal.js';
import { mountComposer } from '../composer/index.js';

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

const SEGMENTS = [
  { id: 'all_buyers', label: 'All buyers' },
  { id: 't3_buyers', label: 'T3 buyers' },
  { id: 't2_buyers', label: 'T2 buyers' },
  { id: 'prompt_pack_buyers', label: 'Prompt Pack buyers' },
  { id: 'beyond_lighting_buyers', label: 'Beyond Lighting buyers' },
];

export default async function mount(root) {
  root.innerHTML = '<section style="max-width:1080px; margin:0 auto; color:var(--c-fg-3); font-size:var(--fs-body-sm)">Loading…</section>';
  let templates = (await api('/api/data/templates')).templates;

  async function renderTemplateList() {
    templates = (await api('/api/data/templates')).templates;
    return templates;
  }

  function render() {
    const hasTemplates = templates.length > 0;
    const grid = hasTemplates ? templates.map(t => {
      const langs = [];
      if (t.bodyAR || t.subjectAR) langs.push('AR');
      if (t.bodyEN || t.subjectEN) langs.push('EN');
      const varCount = (t.variables || []).length;
      return `
        <div data-ui="card" class="template-card" data-id="${escapeHtml(t.templateId)}" style="cursor:pointer; display:grid; gap:var(--s-2); transition: border-color var(--dur-fast) var(--ease-out);">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:var(--s-2)">
            <div style="font-weight:500; font-size:var(--fs-body)">${escapeHtml(t.name)}</div>
            <div style="display:flex; gap:var(--s-1); flex-shrink:0">
              ${langs.map(l => `<span data-ui="tag" data-tone="gold">${l}</span>`).join('')}
            </div>
          </div>
          <div style="font-size:var(--fs-label); color:var(--c-fg-3); letter-spacing:0.04em; text-transform:uppercase">
            ${varCount} ${varCount === 1 ? 'var' : 'vars'}
          </div>
        </div>`;
    }).join('') : '';

    root.innerHTML = `
      <section style="max-width:1080px; margin:0 auto; display:grid; gap:var(--s-6)">

        <section style="display:flex; justify-content:space-between; align-items:center; gap:var(--s-3); flex-wrap:wrap">
          <div style="color:var(--c-fg-2); font-size:var(--fs-body-sm)">Compose and send to buyer segments. Templates save to the EmailTemplates sheet.</div>
          <div style="display:flex; gap:var(--s-2)">
            <button data-ui="btn" data-variant="secondary" id="noor-email-btn">Draft with Noor</button>
            <button data-ui="btn" data-variant="primary"   id="new-email-btn">New template</button>
          </div>
        </section>

        ${hasTemplates ? `
          <section>
            <div style="font-size:var(--fs-label); font-weight:500; letter-spacing:0.08em; text-transform:uppercase; color:var(--c-fg-3); margin-bottom:var(--s-3)">Templates</div>
            <div class="template-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:var(--s-3)">
              ${grid}
            </div>
          </section>

          <hr data-ui="hairline">

          <section>
            <div style="font-size:var(--fs-label); font-weight:500; letter-spacing:0.08em; text-transform:uppercase; color:var(--c-fg-3); margin-bottom:var(--s-3)">Send an existing template</div>
            <div style="display:grid; grid-template-columns:2fr 2fr 1fr; gap:var(--s-3); align-items:end">
              <div data-ui="field">
                <label>Template</label>
                <select data-ui="select" id="tpl">${templates.map(t => `<option value="${escapeHtml(t.templateId)}">${escapeHtml(t.name)}</option>`).join('')}</select>
              </div>
              <div data-ui="field">
                <label>Segment</label>
                <select data-ui="select" id="seg">${SEGMENTS.map(s => `<option value="${s.id}">${s.label}</option>`).join('')}</select>
              </div>
              <div data-ui="field">
                <label>Language</label>
                <select data-ui="select" id="lang"><option value="AR">العربية</option><option value="EN">English</option></select>
              </div>
            </div>
            <div style="display:flex; justify-content:flex-end; margin-top:var(--s-4)">
              <button data-ui="btn" data-variant="primary" id="preview-btn">Preview + send</button>
            </div>
            <div id="msg" style="text-align:right; margin-top:var(--s-2); font-size:var(--fs-body-sm); color:var(--c-fg-3)"></div>
          </section>
        ` : `
          <section style="text-align:center; padding:var(--s-7) 0; color:var(--c-fg-3); font-size:var(--fs-body-sm)">
            No templates yet. Click <strong style="color:var(--c-fg-2)">New template</strong> or <strong style="color:var(--c-fg-2)">Draft with Noor</strong> to create one.
          </section>
        `}
      </section>`;

    document.getElementById('new-email-btn').onclick = () => openManualForm();
    document.getElementById('noor-email-btn').onclick = openNoorForm;
    if (hasTemplates) {
      document.getElementById('preview-btn').onclick = sendTemplate;
      // Clicking a template card selects it in the dropdown
      for (const card of root.querySelectorAll('.template-card')) {
        card.onclick = () => {
          const select = document.getElementById('tpl');
          if (select) select.value = card.dataset.id;
          root.querySelectorAll('.template-card').forEach(c => { c.style.borderColor = ''; });
          card.style.borderColor = 'var(--c-gold)';
        };
      }
    }
  }

  // ───── Send existing template ─────
  async function sendTemplate() {
    const templateId = document.getElementById('tpl').value;
    const segment = document.getElementById('seg').value;
    const language = document.getElementById('lang').value;
    const msg = document.getElementById('msg');
    msg.textContent = 'Staging preview…';
    try {
      const stage = await api('/api/writes/send_email', {
        method: 'POST',
        body: JSON.stringify({ templateId, segment, language }),
      });
      msg.textContent = '';
      openApprovalModal({
        title: 'Confirm drip send',
        previewHtml: renderSendEmailPreview(stage.preview),
        pendingWriteId: stage.id,
        onApproved: (r) => { msg.textContent = `Sent to ${r.result?.sent ?? '?'} recipients.`; },
        onRejected: () => { msg.textContent = 'Rejected — no emails sent.'; },
      });
    } catch (e) {
      if (e.message === 'requires_extra_approval') {
        if (confirm('Segment exceeds 500 recipients. Send anyway?')) {
          const stage = await api('/api/writes/send_email', {
            method: 'POST',
            body: JSON.stringify({ templateId, segment, language, extraApproval: true }),
          });
          openApprovalModal({
            title: 'Confirm BULK drip send',
            previewHtml: renderSendEmailPreview(stage.preview),
            pendingWriteId: stage.id,
            onApproved: (r) => { msg.textContent = `Sent to ${r.result?.sent} recipients.`; },
          });
        }
      } else {
        msg.textContent = `Error: ${e.message}`;
      }
    }
  }

  // ───── Add new email template (manual, block composer) ─────
  function openManualForm(initial = {}) {
    const o = document.createElement('div');
    o.className = 'modal-overlay';
    o.innerHTML = `
      <div class="modal-card" style="max-width:1100px">
        <h3>${initial.templateId ? 'Edit' : 'New'} email template</h3>
        <div data-ui="field"><label>Template name</label><input data-ui="input" id="m-name" value="${escapeHtml(initial.name || '')}" placeholder="e.g. May Cohort Announcement" /></div>
        <div data-ui="field"><label>Template ID</label><input data-ui="input" id="m-id" value="${escapeHtml(initial.templateId || '')}" placeholder="auto if blank" /></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s-3)">
          <div data-ui="field"><label>Subject AR</label><input data-ui="input" id="m-subj-ar" dir="rtl" value="${escapeHtml(initial.subjectAR || '')}" /></div>
          <div data-ui="field"><label>Subject EN</label><input data-ui="input" id="m-subj-en" value="${escapeHtml(initial.subjectEN || '')}" /></div>
        </div>

        <div style="font-size:var(--fs-label); font-weight:500; letter-spacing:0.08em; text-transform:uppercase; color:var(--c-fg-3); margin:var(--s-4) 0 var(--s-2)">العربية</div>
        <div id="composer-ar"></div>

        <div style="font-size:var(--fs-label); font-weight:500; letter-spacing:0.08em; text-transform:uppercase; color:var(--c-fg-3); margin:var(--s-5) 0 var(--s-2)">English</div>
        <div id="composer-en"></div>

        <div class="modal-actions">
          <button data-ui="btn" data-variant="ghost" id="m-cancel">Cancel</button>
          <button data-ui="btn" data-variant="primary" id="m-save">Preview + save</button>
        </div>
        <div class="modal-msg" id="m-msg"></div>
      </div>`;
    document.body.appendChild(o);

    // Click on the dim overlay (outside the card) closes the modal.
    o.addEventListener('mousedown', (e) => { if (e.target === o) o.remove(); });

    let blocksAR = initial.blocksAR || [];
    let blocksEN = initial.blocksEN || [];
    const subjArEl = o.querySelector('#m-subj-ar');
    const subjEnEl = o.querySelector('#m-subj-en');
    const cAR = mountComposer({
      root: o.querySelector('#composer-ar'),
      initialBlocks: blocksAR, language: 'AR',
      onChange: (b) => { blocksAR = b; },
      getHeader: () => ({ subject: subjArEl.value, preheader: '' }),
    });
    const cEN = mountComposer({
      root: o.querySelector('#composer-en'),
      initialBlocks: blocksEN, language: 'EN',
      onChange: (b) => { blocksEN = b; },
      getHeader: () => ({ subject: subjEnEl.value, preheader: '' }),
    });
    subjArEl.addEventListener('input', () => cAR.refreshPreview());
    subjEnEl.addEventListener('input', () => cEN.refreshPreview());

    o.querySelector('#m-cancel').onclick = () => o.remove();
    o.querySelector('#m-save').onclick = async () => {
      const payload = {
        name: o.querySelector('#m-name').value.trim() || 'Untitled',
        templateId: o.querySelector('#m-id').value.trim() || undefined,
        subjectAR: o.querySelector('#m-subj-ar').value,
        subjectEN: o.querySelector('#m-subj-en').value,
        blocksAR, blocksEN,
      };
      try {
        const stage = await api('/api/writes/add_email_template', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        o.remove();
        openSaveApproval(stage);
      } catch (e) {
        o.querySelector('#m-msg').textContent = `Error: ${e.message}`;
      }
    };
  }

  // ───── Email by Noor ─────
  function openNoorForm() {
    const o = document.createElement('div');
    o.className = 'modal-overlay';
    o.innerHTML = `
      <div class="modal-card" style="max-width:640px">
        <h3>Draft with Noor</h3>
        <p style="color:var(--c-fg-2); font-size:var(--fs-body-sm); margin-bottom:var(--s-3)">
          Tell Noor the idea. She'll draft subject + body in your brand voice (AR + EN by default).
        </p>
        <div data-ui="field"><label>Product (optional)</label>
          <select data-ui="select" id="n-product">
            <option value="">None</option>
            <option value="T3">T3 — Creative AI Cohort</option>
            <option value="T2">T2 — Intro to Creative AI</option>
            <option value="T1">T1 — Prompt Pack</option>
            <option value="BL">Beyond Lighting</option>
          </select></div>
        <div data-ui="field"><label>Your idea</label>
          <textarea data-ui="input" id="n-idea" rows="6" placeholder="Announce that May cohort registration opens Monday. Early bird is 799 SAR until the 15th. Limited to 25 seats."></textarea></div>
        <div data-ui="field"><label>Language</label>
          <select data-ui="select" id="n-lang"><option value="BOTH">Both (AR + EN)</option><option value="AR">العربية only</option><option value="EN">English only</option></select></div>
        <div class="modal-actions">
          <button data-ui="btn" data-variant="ghost" id="n-cancel">Cancel</button>
          <button data-ui="btn" data-variant="primary" id="n-gen">Generate</button>
        </div>
        <div class="modal-msg" id="n-msg"></div>
      </div>`;
    document.body.appendChild(o);
    o.querySelector('#n-cancel').onclick = () => o.remove();
    o.querySelector('#n-gen').onclick = async () => {
      const idea = o.querySelector('#n-idea').value.trim();
      const language = o.querySelector('#n-lang').value;
      const product = o.querySelector('#n-product').value || null;
      if (idea.length < 5) { o.querySelector('#n-msg').textContent = 'Tell Noor a bit more.'; return; }
      o.querySelector('#n-gen').disabled = true;
      o.querySelector('#n-msg').innerHTML = '<span style="color:var(--c-fg-3)">Noor is drafting… this can take 10–30s.</span>';
      try {
        const { draft } = await api('/api/noor/draft_email', {
          method: 'POST',
          body: JSON.stringify({ idea, language, product }),
        });
        o.remove();
        openNoorReview(draft);
      } catch (e) {
        o.querySelector('#n-msg').textContent = `Error: ${e.message}`;
        o.querySelector('#n-gen').disabled = false;
      }
    };
  }

  // Route Noor drafts into the shared composer-based form.
  function openNoorReview(draft) {
    openManualForm({
      name: draft.name,
      templateId: draft.templateId,
      subjectAR: draft.subjectAR,
      subjectEN: draft.subjectEN,
      blocksAR: draft.blocksAR || [],
      blocksEN: draft.blocksEN || [],
    });
  }

  function openSaveApproval(stage) {
    const p = stage.preview;
    // Build HTML preview with both language samples if present.
    const arSample = p.bodyAR ? `
      <h5 style="color:var(--gold);margin:12px 0 6px">AR preview</h5>
      <div class="email-sample">
        <div class="subj">${escapeHtml(p.subjectAR)}</div>
        <iframe class="email-html-preview" sandbox srcdoc="${escapeHtml(`<!doctype html><html><head><meta charset='utf-8'></head><body style='margin:0;background:#0E0E0E;padding:12px'>${p.bodyAR}</body></html>`)}"></iframe>
      </div>` : '';
    const enSample = p.bodyEN ? `
      <h5 style="color:var(--gold);margin:12px 0 6px">EN preview</h5>
      <div class="email-sample">
        <div class="subj">${escapeHtml(p.subjectEN)}</div>
        <iframe class="email-html-preview" sandbox srcdoc="${escapeHtml(`<!doctype html><html><head><meta charset='utf-8'></head><body style='margin:0;background:#0E0E0E;padding:12px'>${p.bodyEN}</body></html>`)}"></iframe>
      </div>` : '';
    openApprovalModal({
      title: 'Confirm save to EmailTemplates',
      previewHtml: `
        <p>Name: <strong>${escapeHtml(p.name)}</strong></p>
        <p style="color:var(--silver);font-size:.85rem">TemplateID: <code>${escapeHtml(p.templateId)}</code></p>
        ${arSample}${enSample}`,
      pendingWriteId: stage.id,
      onApproved: async () => { await renderTemplateList(); render(); },
    });
  }

  render();
}

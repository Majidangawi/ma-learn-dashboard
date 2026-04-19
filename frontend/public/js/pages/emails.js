import { api } from '../api.js';
import { openApprovalModal, renderSendEmailPreview } from '../ui/approval-modal.js';

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
  root.innerHTML = '<h2 style="color:var(--gold)">Emails</h2><p style="color:var(--silver)">Loading…</p>';
  let templates = (await api('/api/data/templates')).templates;

  async function renderTemplateList() {
    templates = (await api('/api/data/templates')).templates;
    return templates;
  }

  function render() {
    const hasTemplates = templates.length > 0;
    root.innerHTML = `
      <h2 style="color:var(--gold)">Emails</h2>
      <p style="color:var(--silver);margin-bottom:16px">Compose & send. Every new template gets saved to the <code>EmailTemplates</code> sheet.</p>

      <div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap">
        <button class="btn-primary" id="new-email-btn">+ Add new template</button>
        <button class="btn-primary" id="noor-email-btn" style="background:#8e6fd6">✨ Email by Noor</button>
      </div>

      ${hasTemplates ? `
      <section style="background:var(--surface);padding:16px;border-radius:10px;margin-bottom:20px">
        <h3 style="color:var(--gold);margin-bottom:12px">Send an existing template</h3>
        <div class="form-field">
          <label>Template</label>
          <select id="tpl">${templates.map(t => `<option value="${escapeHtml(t.templateId)}">${escapeHtml(t.name)}</option>`).join('')}</select>
        </div>
        <div class="form-field">
          <label>Segment</label>
          <select id="seg">${SEGMENTS.map(s => `<option value="${s.id}">${s.label}</option>`).join('')}</select>
        </div>
        <div class="form-field">
          <label>Language</label>
          <select id="lang"><option value="AR">العربية</option><option value="EN">English</option></select>
        </div>
        <button class="btn-primary" id="preview-btn">Preview + send</button>
        <div id="msg" class="modal-msg"></div>
      </section>` : '<p style="color:var(--silver)">No templates yet — click <strong>Add new template</strong> or <strong>Email by Noor</strong> to create one.</p>'}`;

    document.getElementById('new-email-btn').onclick = openManualForm;
    document.getElementById('noor-email-btn').onclick = openNoorForm;
    if (hasTemplates) document.getElementById('preview-btn').onclick = sendTemplate;
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

  // ───── Add new email template (manual) ─────
  function openManualForm() {
    const o = document.createElement('div');
    o.className = 'modal-overlay';
    o.innerHTML = `
      <div class="modal-card" style="max-width:720px">
        <h3>Add new email template</h3>
        <p style="color:var(--silver);font-size:.85rem;margin-bottom:12px">
          Write plain text. We wrap it in the MA Learn brand style on save.
          Syntax hints: <code>## Heading</code> · <code>&gt; highlight box</code> · <code>- bullet</code> · <code>**bold**</code> · blank line = new paragraph.
        </p>
        <div class="form-field"><label>Template name (internal)</label><input id="m-name" placeholder="e.g. May Cohort Announcement" /></div>
        <div class="form-field"><label>Template ID (optional slug, auto if blank)</label><input id="m-id" placeholder="may-cohort-announcement" /></div>

        <h4 style="color:var(--gold);margin:16px 0 8px">العربية</h4>
        <div class="form-field"><label>Subject AR</label><input id="m-subj-ar" dir="rtl" /></div>
        <div class="form-field"><label>Body AR (plain text with markdown-lite)</label><textarea id="m-body-ar" dir="rtl" rows="8"></textarea></div>

        <h4 style="color:var(--gold);margin:16px 0 8px">English</h4>
        <div class="form-field"><label>Subject EN</label><input id="m-subj-en" /></div>
        <div class="form-field"><label>Body EN</label><textarea id="m-body-en" rows="8"></textarea></div>

        <div class="modal-actions">
          <button class="btn-ghost" id="m-cancel">Cancel</button>
          <button class="btn-primary" id="m-save">Preview + save</button>
        </div>
        <div class="modal-msg" id="m-msg"></div>
      </div>`;
    document.body.appendChild(o);
    o.querySelector('#m-cancel').onclick = () => o.remove();
    o.querySelector('#m-save').onclick = async () => {
      const payload = {
        name: o.querySelector('#m-name').value.trim() || 'Untitled',
        templateId: o.querySelector('#m-id').value.trim() || undefined,
        subjectAR: o.querySelector('#m-subj-ar').value,
        subjectEN: o.querySelector('#m-subj-en').value,
        rawBodyAR: o.querySelector('#m-body-ar').value,
        rawBodyEN: o.querySelector('#m-body-en').value,
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
        <h3>✨ Email by Noor</h3>
        <p style="color:var(--silver);font-size:.85rem;margin-bottom:12px">
          Tell Noor the idea. She'll draft subject + body in your brand voice (AR + EN by default).
        </p>
        <div class="form-field"><label>Your idea</label>
          <textarea id="n-idea" rows="6" placeholder="Announce that May cohort registration opens Monday. Early bird is 799 SAR until the 15th. Limited to 25 seats."></textarea></div>
        <div class="form-field"><label>Language</label>
          <select id="n-lang"><option value="BOTH">Both (AR + EN)</option><option value="AR">العربية only</option><option value="EN">English only</option></select></div>
        <div class="modal-actions">
          <button class="btn-ghost" id="n-cancel">Cancel</button>
          <button class="btn-primary" id="n-gen">Generate</button>
        </div>
        <div class="modal-msg" id="n-msg"></div>
      </div>`;
    document.body.appendChild(o);
    o.querySelector('#n-cancel').onclick = () => o.remove();
    o.querySelector('#n-gen').onclick = async () => {
      const idea = o.querySelector('#n-idea').value.trim();
      const language = o.querySelector('#n-lang').value;
      if (idea.length < 5) { o.querySelector('#n-msg').textContent = 'Tell Noor a bit more.'; return; }
      o.querySelector('#n-gen').disabled = true;
      o.querySelector('#n-msg').innerHTML = '<span style="color:var(--silver)">Noor is drafting… this can take 10–30s.</span>';
      try {
        const { draft } = await api('/api/noor/draft_email', {
          method: 'POST',
          body: JSON.stringify({ idea, language }),
        });
        o.remove();
        openNoorReview(draft);
      } catch (e) {
        o.querySelector('#n-msg').textContent = `Error: ${e.message}`;
        o.querySelector('#n-gen').disabled = false;
      }
    };
  }

  function openNoorReview(draft) {
    const o = document.createElement('div');
    o.className = 'modal-overlay';
    o.innerHTML = `
      <div class="modal-card" style="max-width:760px">
        <h3>✨ Noor's draft</h3>
        <p style="color:var(--silver);font-size:.85rem;margin-bottom:12px">
          Edit anything you want before saving. Body is plain text with markdown-lite; we wrap in brand HTML on save.
        </p>
        <div class="form-field"><label>Template name</label><input id="r-name" value="${escapeHtml(draft.name || '')}" /></div>
        <div class="form-field"><label>Template ID</label><input id="r-id" value="${escapeHtml(draft.templateId || '')}" /></div>
        ${draft.subjectAR || draft.bodyAR ? `
          <h4 style="color:var(--gold);margin:16px 0 8px">العربية</h4>
          <div class="form-field"><label>Subject AR</label><input id="r-subj-ar" dir="rtl" value="${escapeHtml(draft.subjectAR || '')}" /></div>
          <div class="form-field"><label>Body AR</label><textarea id="r-body-ar" dir="rtl" rows="10">${escapeHtml(draft.bodyAR || '')}</textarea></div>
        ` : ''}
        ${draft.subjectEN || draft.bodyEN ? `
          <h4 style="color:var(--gold);margin:16px 0 8px">English</h4>
          <div class="form-field"><label>Subject EN</label><input id="r-subj-en" value="${escapeHtml(draft.subjectEN || '')}" /></div>
          <div class="form-field"><label>Body EN</label><textarea id="r-body-en" rows="10">${escapeHtml(draft.bodyEN || '')}</textarea></div>
        ` : ''}
        <div class="modal-actions">
          <button class="btn-ghost" id="r-cancel">Discard</button>
          <button class="btn-primary" id="r-save">Preview + save</button>
        </div>
        <div class="modal-msg" id="r-msg"></div>
      </div>`;
    document.body.appendChild(o);
    o.querySelector('#r-cancel').onclick = () => o.remove();
    o.querySelector('#r-save').onclick = async () => {
      const payload = {
        name: o.querySelector('#r-name').value.trim() || 'Untitled',
        templateId: o.querySelector('#r-id').value.trim() || undefined,
        subjectAR: o.querySelector('#r-subj-ar')?.value ?? '',
        subjectEN: o.querySelector('#r-subj-en')?.value ?? '',
        rawBodyAR: o.querySelector('#r-body-ar')?.value ?? '',
        rawBodyEN: o.querySelector('#r-body-en')?.value ?? '',
      };
      try {
        const stage = await api('/api/writes/add_email_template', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        o.remove();
        openSaveApproval(stage);
      } catch (e) {
        o.querySelector('#r-msg').textContent = `Error: ${e.message}`;
      }
    };
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

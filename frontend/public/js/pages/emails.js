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
  const { templates } = await api('/api/data/templates');

  if (!templates.length) {
    root.innerHTML = `
      <h2 style="color:var(--gold)">Emails</h2>
      <p style="color:var(--silver)">No templates yet. Add rows to the <code>EmailTemplates</code> tab of the staging Sheet first.</p>`;
    return;
  }

  root.innerHTML = `
    <h2 style="color:var(--gold)">Emails</h2>
    <p style="color:var(--silver);margin-bottom:16px">Pick a template + segment. You see the first 3 personalized messages. Approve to send to the full segment.</p>
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
    <div id="msg" class="modal-msg"></div>`;

  document.getElementById('preview-btn').onclick = async () => {
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
  };
}

import { api } from '../api.js';

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

export default async function mount(root) {
  root.innerHTML = `
    <h2 style="color:var(--gold)">Noor — chat</h2>
    <div id="thread" style="background:var(--surface);padding:16px;border-radius:10px;min-height:300px;max-height:60vh;overflow-y:auto;margin:16px 0"></div>
    <div class="form-field" style="display:flex;gap:8px;margin:0">
      <input id="prompt" style="flex:1;background:var(--surface2);border:1px solid var(--border);color:var(--ivory);padding:10px;border-radius:6px;font:inherit" placeholder="Ask Noor…" />
      <button class="btn-primary" data-ui="btn" data-variant="primary" id="send-btn">Send</button>
    </div>
    <div id="cost" style="color:var(--silver);font-size:.8rem;margin-top:8px"></div>`;

  const thread = document.getElementById('thread');
  const input = document.getElementById('prompt');
  const btn = document.getElementById('send-btn');
  const costEl = document.getElementById('cost');

  function append(role, text) {
    const div = document.createElement('div');
    div.style.cssText = `margin-bottom:12px;padding:10px;border-radius:8px;background:${role === 'user' ? 'rgba(201,168,76,0.06)' : 'var(--surface2)'}`;
    div.innerHTML = `<div style="color:${role === 'user' ? 'var(--gold)' : 'var(--silver)'};font-size:.8rem;margin-bottom:4px">${role === 'user' ? 'You' : 'Noor'}</div><pre style="white-space:pre-wrap;font:inherit">${escapeHtml(text)}</pre>`;
    thread.appendChild(div);
    thread.scrollTop = thread.scrollHeight;
  }

  function renderPlan(data) {
    const card = document.createElement('div');
    card.style.cssText = 'background:var(--surface2);padding:12px;border-radius:8px;border:1px solid var(--border);margin-bottom:12px';
    card.innerHTML = `
      <div style="color:var(--silver);font-size:.8rem">Plan</div>
      <pre style="white-space:pre-wrap;font:inherit">${escapeHtml(data.text)}</pre>
      ${data.pendingWrites.length ? `
        <div style="margin-top:10px;color:var(--gold);font-size:.85rem">Write tools pending approval:</div>
        <ul style="font:inherit;color:var(--ivory);margin:6px 0 10px 20px">
          ${data.pendingWrites.map(w => `<li><code>${escapeHtml(w.name)}</code> ${escapeHtml(JSON.stringify(w.input))}</li>`).join('')}
        </ul>
        <div style="display:flex;gap:8px"><button class="btn-danger" data-ui="btn" data-variant="danger" data-a="reject">Reject</button><button class="btn-primary" data-ui="btn" data-variant="primary" data-a="approve">Approve + execute</button></div>`
        : '<p style="color:var(--silver);font-size:.85rem;margin-top:8px">Read-only plan — already executed.</p>'}
      ${data.autoResults?.length ? `<details style="margin-top:10px"><summary style="color:var(--silver);font-size:.8rem">Tool results</summary><pre style="white-space:pre-wrap;font:inherit;font-size:.8rem">${escapeHtml(JSON.stringify(data.autoResults, null, 2))}</pre></details>` : ''}`;
    thread.appendChild(card);
    thread.scrollTop = thread.scrollHeight;
    for (const b of card.querySelectorAll('button[data-a]')) {
      b.onclick = async () => {
        const decision = b.dataset.a;
        b.disabled = true;
        try {
          const r = await api('/api/noor/resolve', { method: 'POST', body: JSON.stringify({ planId: data.planId, decision }) });
          append('system', decision === 'approve' ? `Executed: ${JSON.stringify(r.results)}` : 'Rejected.');
        } catch (e) { append('system', 'Error: ' + e.message); }
      };
    }
  }

  async function send() {
    const text = input.value.trim();
    if (!text) return;
    input.value = ''; btn.disabled = true;
    append('user', text);
    try {
      const r = await api('/api/noor/plan', { method: 'POST', body: JSON.stringify({ prompt: text }) });
      renderPlan(r);
      costEl.textContent = `Noor spend MTD: $${r.monthToDateUSD.toFixed(2)}`;
    } catch (e) {
      append('system', 'Error: ' + e.message);
    } finally { btn.disabled = false; }
  }

  btn.onclick = send;
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
}

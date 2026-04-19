import { api } from '../api.js';

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

export function mountNoorWidget() {
  const btn = document.createElement('button');
  btn.textContent = 'Noor';
  btn.className = 'noor-fab';
  document.body.appendChild(btn);

  let panel = null;
  btn.onclick = () => {
    if (panel) { panel.remove(); panel = null; return; }
    panel = document.createElement('div');
    panel.className = 'noor-panel';
    panel.innerHTML = `
      <div class="noor-panel-head"><strong>Noor</strong><button class="btn-ghost" id="close">×</button></div>
      <div id="noor-thread"></div>
      <div class="form-field" style="display:flex;gap:6px;padding:10px;border-top:1px solid var(--border);margin:0">
        <input id="q" style="flex:1;background:var(--surface2);border:1px solid var(--border);color:var(--ivory);padding:6px;border-radius:4px;font:inherit" placeholder="Ask Noor about this page…" />
        <button class="btn-primary" id="go">Go</button>
      </div>`;
    document.body.appendChild(panel);
    panel.querySelector('#close').onclick = () => { panel.remove(); panel = null; };
    panel.querySelector('#go').onclick = send;
    panel.querySelector('#q').addEventListener('keydown', e => { if (e.key === 'Enter') send(); });

    async function send() {
      const input = panel.querySelector('#q');
      const q = input.value.trim();
      if (!q) return;
      input.value = '';
      const pageContext = `Current page: ${location.hash || '#home'}`;
      const thread = panel.querySelector('#noor-thread');
      thread.insertAdjacentHTML('beforeend', `<div class="noor-q">${escapeHtml(q)}</div>`);
      try {
        const r = await api('/api/noor/plan', { method: 'POST', body: JSON.stringify({ prompt: pageContext + '\n\n' + q }) });
        thread.insertAdjacentHTML('beforeend', `<div class="noor-a"><pre>${escapeHtml(r.text)}</pre></div>`);
        thread.scrollTop = thread.scrollHeight;
      } catch (e) {
        thread.insertAdjacentHTML('beforeend', `<div class="noor-a" style="color:var(--red)">Error: ${escapeHtml(e.message)}</div>`);
      }
    }
  };
}

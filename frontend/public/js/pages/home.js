import { api } from '../api.js';

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

export default async function mount(root) {
  root.innerHTML = '<p style="color:var(--silver)">Loading insights…</p>';
  const insights = await api('/api/insights');

  const sarFmt = n => `${Math.round(n).toLocaleString('en-US')} SAR`;
  const usdFmt = n => `$${n.toFixed(2)}`;

  root.innerHTML = `
    <h2 style="color:var(--gold);margin-bottom:20px">Home</h2>

    <div class="kpi-row">
      <div class="kpi-card"><div class="kpi-label">Revenue this month</div><div class="kpi-value">${sarFmt(insights.revenueMTDSAR)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Revenue today</div><div class="kpi-value">${sarFmt(insights.revenueTodaySAR)}</div></div>
      <div class="kpi-card"><div class="kpi-label">New registrations MTD</div><div class="kpi-value">${insights.newRegistrationsMTD}</div></div>
      <div class="kpi-card"><div class="kpi-label">Noor spend MTD</div><div class="kpi-value">${usdFmt(insights.anthropicSpendUSD)}</div></div>
    </div>

    <div class="kpi-row" style="grid-template-columns: 2fr 1fr;">
      <div class="kpi-card">
        <div class="kpi-label">Revenue last 30 days</div>
        <canvas id="rev-chart" style="margin-top:12px;max-height:220px"></canvas>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">T3 Cohort 1 seats</div>
        <div class="kpi-value">${insights.t3SeatsFilled} / ${insights.t3SeatsTotal}</div>
        <div class="progress"><div style="width:${Math.min(100, insights.t3SeatsFilled / insights.t3SeatsTotal * 100)}%"></div></div>
      </div>
    </div>

    <div class="kpi-row" style="grid-template-columns: 1fr 1fr 2fr;">
      <div class="kpi-card">
        <div class="kpi-label">Needs your action</div>
        <div style="margin-top:8px;color:var(--ivory)">${insights.pendingApprovals} pending approvals</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Upcoming actions</div>
        ${insights.scheduledActions.length
          ? `<ul style="margin-top:8px;color:var(--ivory);font-size:.9rem;list-style:none;padding:0">${insights.scheduledActions.map(a => `<li>${escapeHtml(a.label)} — ${escapeHtml(a.when)}</li>`).join('')}</ul>`
          : '<div style="margin-top:8px;color:var(--silver)">None scheduled</div>'}
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Recent buyers</div>
        <table class="data-table" style="margin-top:8px;font-size:.85rem">
          <tbody>
          ${insights.recentBuyers.map(b => `
            <tr><td>${escapeHtml(b.name || b.email)}</td><td>${escapeHtml(b.product)}</td><td>${sarFmt(b.amountSAR)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;

  await new Promise(r => (window.Chart ? r() : window.addEventListener('load', r, { once: true })));
  const ctx = document.getElementById('rev-chart');
  if (ctx && window.Chart) {
    new window.Chart(ctx, {
      type: 'line',
      data: {
        labels: insights.revenue30Days.map(d => d.date.slice(5)),
        datasets: [{
          label: 'SAR',
          data: insights.revenue30Days.map(d => d.sar),
          borderColor: '#C9A84C',
          backgroundColor: 'rgba(201,168,76,0.14)',
          tension: 0.3, fill: true, pointRadius: 2,
        }],
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#888' }, grid: { color: 'rgba(255,255,255,0.04)' } },
          y: { ticks: { color: '#888' }, grid: { color: 'rgba(255,255,255,0.04)' } },
        },
      },
    });
  }
}

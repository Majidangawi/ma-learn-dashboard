import { api } from '../api.js';

function formatSAR(n) { return new Intl.NumberFormat('en-US').format(Math.round(n)); }
function arabicDate(d) { return new Intl.DateTimeFormat('ar-SA', { weekday: 'long', day: 'numeric', month: 'long' }).format(d); }
function englishDate(d) { return new Intl.DateTimeFormat('en-US', { weekday: 'long', day: 'numeric', month: 'long' }).format(d); }

function sparklinePath(values, w = 180, h = 48) {
  if (!values?.length) return '';
  const min = Math.min(...values), max = Math.max(...values);
  const range = Math.max(1, max - min);
  const step = w / (values.length - 1);
  return values.map((v, i) => {
    const x = i * step;
    const y = h - ((v - min) / range) * h;
    return (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1);
  }).join(' ');
}

export default async function mount(root) {
  root.innerHTML = '<div style="color:var(--c-fg-3)">Loading today\'s briefing…</div>';
  let kpis;
  try { kpis = await api('/api/data/home-kpis'); }
  catch (e) {
    root.innerHTML = `<div style="color:var(--c-danger)">Could not load KPIs: ${e.message}</div>`;
    return;
  }

  const now = new Date();
  const revDelta = kpis.revenuePrevWeekSAR > 0
    ? ((kpis.revenueThisWeekSAR - kpis.revenuePrevWeekSAR) / kpis.revenuePrevWeekSAR * 100)
    : 0;
  const up = revDelta >= 0;

  root.innerHTML = `
    <section style="max-width:1080px; margin:0 auto; display:grid; gap:var(--s-7)">

      <header>
        <div style="font-size:var(--fs-body); color:var(--c-fg-2)">Good morning, Majid</div>
        <div style="font-size:var(--fs-label); color:var(--c-fg-3); letter-spacing:0.04em; text-transform:uppercase; margin-top:2px">${englishDate(now)} · ${arabicDate(now)}</div>
        <hr data-ui="hairline" style="width:120px; margin:var(--s-3) 0 0">
      </header>

      <section data-ui="card">
        <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:var(--s-3)">
          <h2 style="font-size:var(--fs-h2)">M1 — Deliver Cohort 1</h2>
          <span style="font-size:var(--fs-label); color:var(--c-fg-3); letter-spacing:0.04em; text-transform:uppercase">Apr 22 – May 2</span>
        </div>
        <div style="height:4px; background:var(--c-ink-3); border-radius:2px; overflow:hidden">
          <div style="width:40%; height:100%; background:var(--c-gold); border-radius:2px"></div>
        </div>
        <div style="margin-top:var(--s-3); font-size:var(--fs-body-sm); color:var(--c-fg-2)">9 days to M2 · T4 soft launch begins May 3.</div>
      </section>

      <section style="display:grid; grid-template-columns: 1fr 1fr; gap:var(--s-6); align-items:start">

        <div style="display:grid; gap:var(--s-2)">
          <div style="font-size:var(--fs-label); font-weight:500; letter-spacing:0.08em; text-transform:uppercase; color:var(--c-fg-3)">Revenue this week</div>
          <div style="font-size:var(--fs-display-xl); font-weight:200; line-height:1; letter-spacing:-0.02em">
            ${formatSAR(kpis.revenueThisWeekSAR)}<span style="font-size:.35em; color:var(--c-fg-3); margin-inline-start:.4em; font-weight:400"> SAR</span>
          </div>
          <div style="display:flex; align-items:center; gap:var(--s-2)">
            <svg width="180" height="48" viewBox="0 0 180 48" fill="none" style="flex-shrink:0">
              <path d="${sparklinePath(kpis.revenueSparkline)}" stroke="var(--c-gold)" stroke-width="1.5" fill="none"/>
            </svg>
            <span style="font-size:var(--fs-body-sm); color:${up ? 'var(--c-success)' : 'var(--c-danger)'}">
              ${up ? '↑' : '↓'} ${Math.abs(revDelta).toFixed(1)}%
              <span style="color:var(--c-fg-3)">vs last week</span>
            </span>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:var(--s-5); border-left:0.5px solid var(--c-gold-dim); padding-left:var(--s-6)">
          ${[
            { label: 'New customers this week', value: kpis.newCustomersThisWeek },
            { label: 'Active tokens',           value: kpis.activeTokensUnused },
            { label: 'T3 Cohort 2 seats',       value: `${kpis.t3c2SeatsSold}/${kpis.t3c2SeatsTotal}` },
            { label: 'Total units sold',        value: kpis.totalUnitsSold },
          ].map(k => `
            <div>
              <div style="font-size:var(--fs-label); font-weight:500; letter-spacing:0.08em; text-transform:uppercase; color:var(--c-fg-3); margin-bottom:var(--s-1)">${k.label}</div>
              <div style="font-size:var(--fs-display-l); font-weight:200; line-height:1; letter-spacing:-0.015em">${typeof k.value === 'number' ? formatSAR(k.value) : k.value}</div>
            </div>`).join('')}
        </div>
      </section>

      <section>
        <h2 style="font-size:var(--fs-h2); margin-bottom:var(--s-3)">What ships today</h2>
        <div style="color:var(--c-fg-3); font-size:var(--fs-body-sm); padding:var(--s-4) 0">Nothing scheduled today. Take a breath.</div>
      </section>

    </section>`;
}

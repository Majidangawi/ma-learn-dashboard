import { describe, it, expect } from 'vitest';
import { computeInsights } from '../../src/data/insights.js';
import type { Customer } from '../../src/data/sheets-read.js';

const mkC = (over: Partial<Customer>): Customer => ({
  email: '', name: '', product: '', amountSAR: 0,
  purchasedAt: '', token: '', source: 'real', ...over,
});

describe('computeInsights', () => {
  const now = new Date('2026-04-19T12:00:00+03:00');

  it('revenue month-to-date only counts purchases in current month', () => {
    const customers = [
      mkC({ amountSAR: 499, purchasedAt: '2026-04-01T09:00:00' }),
      mkC({ amountSAR: 799, purchasedAt: '2026-04-19T08:00:00' }),
      mkC({ amountSAR: 99, purchasedAt: '2026-03-30T12:00:00' }),
    ];
    const r = computeInsights({ customers, tokens: [], now });
    expect(r.revenueMTDSAR).toBe(499 + 799);
  });

  it('revenue today counts only today purchases', () => {
    const customers = [
      mkC({ amountSAR: 799, purchasedAt: '2026-04-19T08:00:00' }),
      mkC({ amountSAR: 499, purchasedAt: '2026-04-18T08:00:00' }),
    ];
    expect(computeInsights({ customers, tokens: [], now }).revenueTodaySAR).toBe(799);
  });

  it('new registrations this month counts unique emails', () => {
    const customers = [
      mkC({ email: 'a@x.com', purchasedAt: '2026-04-01T10:00:00' }),
      mkC({ email: 'a@x.com', purchasedAt: '2026-04-15T10:00:00' }),
      mkC({ email: 'b@x.com', purchasedAt: '2026-04-10T10:00:00' }),
      mkC({ email: 'c@x.com', purchasedAt: '2026-03-29T10:00:00' }),
    ];
    expect(computeInsights({ customers, tokens: [], now }).newRegistrationsMTD).toBe(2);
  });

  it('t3 seats filled counts customers with creative-ai-workshop-t3 product', () => {
    const customers = [
      mkC({ product: 'creative-ai-workshop-t3' }),
      mkC({ product: 'creative-ai-workshop-t3' }),
      mkC({ product: 'intro-to-creative-ai' }),
    ];
    const r = computeInsights({ customers, tokens: [], now });
    expect(r.t3SeatsFilled).toBe(2);
    expect(r.t3SeatsTotal).toBe(30);
  });

  it('revenue30Days returns 30 buckets ending today', () => {
    const customers = [mkC({ amountSAR: 100, purchasedAt: '2026-04-19T10:00:00' })];
    const r = computeInsights({ customers, tokens: [], now });
    expect(r.revenue30Days).toHaveLength(30);
    expect(r.revenue30Days[29].date).toBe('2026-04-19');
    expect(r.revenue30Days[29].sar).toBe(100);
  });

  it('recentBuyers returns last 5 by purchasedAt desc', () => {
    const customers = Array.from({ length: 8 }, (_, i) => mkC({
      email: `b${i}@x.com`,
      amountSAR: 100 + i,
      purchasedAt: `2026-04-${String(i + 10).padStart(2, '0')}T10:00:00`,
    }));
    const r = computeInsights({ customers, tokens: [], now });
    expect(r.recentBuyers).toHaveLength(5);
    expect(r.recentBuyers[0].email).toBe('b7@x.com');
  });
});

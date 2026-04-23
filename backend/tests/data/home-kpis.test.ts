import { describe, it, expect } from 'vitest';
import { computeHomeKpis, startOfISOWeek, PRODUCT_PRICE_SAR } from '../../src/data/home-kpis.js';
import type { Token } from '../../src/data/read-extra.js';

function token(p: Partial<Token> & { product: string; status: string; assignedAt?: string; email?: string }): Token {
  return { token: 't', product: p.product, email: p.email ?? '', status: p.status, assignedAt: p.assignedAt ?? '' };
}

describe('computeHomeKpis', () => {
  const now = new Date('2026-04-23T12:00:00Z'); // Thursday

  it('zeros on empty input', () => {
    const k = computeHomeKpis([], now);
    expect(k.revenueThisWeekSAR).toBe(0);
    expect(k.revenuePrevWeekSAR).toBe(0);
    expect(k.revenueSparkline).toHaveLength(14);
    expect(k.revenueSparkline.every(v => v === 0)).toBe(true);
    expect(k.t3c2SeatsTotal).toBe(30);
  });

  it('sums revenue for this week (Mon start)', () => {
    const tokens = [
      token({ product: 'intro-to-creative-ai',    status: 'used', email: 'a@x',  assignedAt: '2026-04-20T09:00:00Z' }), // Mon this week
      token({ product: 'creative-ai-workshop-t3', status: 'used', email: 'b@x',  assignedAt: '2026-04-21T09:00:00Z' }), // Tue this week
      token({ product: 'beyond-lighting',         status: 'used', email: 'c@x',  assignedAt: '2026-04-14T09:00:00Z' }), // prev week
    ];
    const k = computeHomeKpis(tokens, now);
    expect(k.revenueThisWeekSAR).toBe(PRODUCT_PRICE_SAR['intro-to-creative-ai']! + PRODUCT_PRICE_SAR['creative-ai-workshop-t3']!);
    expect(k.revenuePrevWeekSAR).toBe(PRODUCT_PRICE_SAR['beyond-lighting']!);
    expect(k.newCustomersThisWeek).toBe(2);
  });

  it('counts t3c2 and total units from status=used rows', () => {
    const tokens = [
      token({ product: 'intro-to-creative-ai',    status: 'used', email: 'a@x', assignedAt: '2026-01-01T00:00:00Z' }),
      token({ product: 'creative-ai-workshop-t3', status: 'used', email: 'b@x', assignedAt: '2026-02-01T00:00:00Z' }),
      token({ product: 'creative-ai-workshop-t3', status: 'used', email: 'c@x', assignedAt: '2026-03-01T00:00:00Z' }),
      token({ product: 'intro-to-creative-ai',    status: 'available' }),
    ];
    const k = computeHomeKpis(tokens, now);
    expect(k.totalUnitsSold).toBe(3);
    expect(k.t3c2SeatsSold).toBe(2);
    expect(k.activeTokensUnused).toBe(1);
  });

  it('sparkline has 14 entries, last = today, first = 13 days ago', () => {
    const tokens = [
      token({ product: 'intro-to-creative-ai', status: 'used', email: 'a', assignedAt: '2026-04-23T10:00:00Z' }), // today
      token({ product: 'intro-to-creative-ai', status: 'used', email: 'b', assignedAt: '2026-04-10T10:00:00Z' }), // 13 days ago
      token({ product: 'intro-to-creative-ai', status: 'used', email: 'c', assignedAt: '2026-04-09T10:00:00Z' }), // 14 days ago — out of range
    ];
    const k = computeHomeKpis(tokens, now);
    expect(k.revenueSparkline).toHaveLength(14);
    expect(k.revenueSparkline[13]).toBe(449);
    expect(k.revenueSparkline[0]).toBe(449);
    // the 14th-days-ago entry should NOT be included
    // (if it were, spark[0] would be 449+449=898)
  });

  it('startOfISOWeek puts Monday as start', () => {
    const thu = new Date('2026-04-23T12:00:00Z');
    const mon = startOfISOWeek(thu);
    expect(mon.getUTCDay()).toBe(1);       // Mon
    expect(mon.getUTCDate()).toBe(20);     // Apr 20
  });
});

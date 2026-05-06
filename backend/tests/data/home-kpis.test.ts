import { describe, it, expect } from 'vitest';
import { computeHomeKpis, countT3CohortSeats, startOfISOWeek, PRODUCT_PRICE_SAR } from '../../src/data/home-kpis.js';
import type { Token } from '../../src/data/read-extra.js';
import type { Customer } from '../../src/data/sheets-read.js';

function token(p: Partial<Token> & { product: string; status: string; assignedAt?: string; email?: string }): Token {
  return { token: 't', product: p.product, email: p.email ?? '', status: p.status, assignedAt: p.assignedAt ?? '' };
}

function customer(over: Partial<Customer>): Customer {
  return { email: '', name: '', product: '', amountSAR: 0, purchasedAt: '', token: '', source: 'real', cohort: '', status: '', ...over };
}

describe('computeHomeKpis', () => {
  const now = new Date('2026-04-23T12:00:00Z'); // Thursday

  it('zeros on empty input', () => {
    const k = computeHomeKpis([], [], now);
    expect(k.revenueThisWeekSAR).toBe(0);
    expect(k.revenuePrevWeekSAR).toBe(0);
    expect(k.revenueSparkline).toHaveLength(14);
    expect(k.revenueSparkline.every(v => v === 0)).toBe(true);
    expect(k.t3c2SeatsTotal).toBe(30);
    expect(k.t3c2SeatsSold).toBe(0);
  });

  it('sums revenue for this week (Mon start)', () => {
    const tokens = [
      token({ product: 'intro-to-creative-ai',    status: 'used', email: 'a@x',  assignedAt: '2026-04-20T09:00:00Z' }), // Mon this week
      token({ product: 'creative-ai-workshop-t3', status: 'used', email: 'b@x',  assignedAt: '2026-04-21T09:00:00Z' }), // Tue this week
      token({ product: 'beyond-lighting',         status: 'used', email: 'c@x',  assignedAt: '2026-04-14T09:00:00Z' }), // prev week
    ];
    const k = computeHomeKpis(tokens, [], now);
    expect(k.revenueThisWeekSAR).toBe(PRODUCT_PRICE_SAR['intro-to-creative-ai']! + PRODUCT_PRICE_SAR['creative-ai-workshop-t3']!);
    expect(k.revenuePrevWeekSAR).toBe(PRODUCT_PRICE_SAR['beyond-lighting']!);
    expect(k.newCustomersThisWeek).toBe(2);
  });

  it('counts total units from status=used tokens; t3c2 seats come from Customers (cohort filter)', () => {
    const tokens = [
      token({ product: 'intro-to-creative-ai',    status: 'used', email: 'a@x', assignedAt: '2026-01-01T00:00:00Z' }),
      token({ product: 'creative-ai-workshop-t3', status: 'used', email: 'b@x', assignedAt: '2026-02-01T00:00:00Z' }),
      token({ product: 'creative-ai-workshop-t3', status: 'used', email: 'c@x', assignedAt: '2026-03-01T00:00:00Z' }),
      token({ product: 'intro-to-creative-ai',    status: 'available' }),
    ];
    const customers: Customer[] = [
      customer({ email: 'b@x', product: 'creative-ai-workshop-t3', cohort: 'C1', status: 'active' }),
      customer({ email: 'c@x', product: 'creative-ai-workshop-t3', cohort: 'C2', status: 'active' }),
    ];
    const k = computeHomeKpis(tokens, customers, now);
    expect(k.totalUnitsSold).toBe(3);
    expect(k.t3c2SeatsSold).toBe(1); // only the C2 customer
    expect(k.activeTokensUnused).toBe(1);
  });

  it('sparkline has 14 entries, last = today, first = 13 days ago', () => {
    const tokens = [
      token({ product: 'intro-to-creative-ai', status: 'used', email: 'a', assignedAt: '2026-04-23T10:00:00Z' }), // today
      token({ product: 'intro-to-creative-ai', status: 'used', email: 'b', assignedAt: '2026-04-10T10:00:00Z' }), // 13 days ago
      token({ product: 'intro-to-creative-ai', status: 'used', email: 'c', assignedAt: '2026-04-09T10:00:00Z' }), // 14 days ago — out of range
    ];
    const k = computeHomeKpis(tokens, [], now);
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

describe('countT3CohortSeats', () => {
  it('counts only T3 + matching cohort + active status', () => {
    const customers: Customer[] = [
      customer({ email: 'c2-active@x', product: 'creative-ai-workshop-t3', cohort: 'C2', status: 'active' }),
      customer({ email: 'c2-cancelled@x', product: 'creative-ai-workshop-t3', cohort: 'C2', status: 'cancelled' }),
      customer({ email: 'c1@x', product: 'creative-ai-workshop-t3', cohort: 'C1', status: 'active' }),
      customer({ email: 'legacy-no-cohort@x', product: 'creative-ai-workshop-t3', cohort: '', status: '' }),
      customer({ email: 't2-buyer@x', product: 'intro-to-creative-ai', cohort: 'C2', status: 'active' }),
    ];
    expect(countT3CohortSeats(customers, 'C2')).toBe(1);
    expect(countT3CohortSeats(customers, 'C1')).toBe(1);
  });

  it('treats empty Status as active (legacy rows tagged with cohort)', () => {
    const customers: Customer[] = [
      customer({ product: 'creative-ai-workshop-t3', cohort: 'C2', status: '' }),
    ];
    expect(countT3CohortSeats(customers, 'C2')).toBe(1);
  });

  it('matches cohort case-insensitively and trims whitespace', () => {
    const customers: Customer[] = [
      customer({ product: 'creative-ai-workshop-t3', cohort: ' c2 ', status: 'active' }),
    ];
    expect(countT3CohortSeats(customers, 'C2')).toBe(1);
  });

  it('does NOT count rows with empty cohort (legacy pre-cohort rows)', () => {
    const customers: Customer[] = [
      customer({ product: 'creative-ai-workshop-t3', cohort: '', status: 'active' }),
    ];
    expect(countT3CohortSeats(customers, 'C2')).toBe(0);
  });
});

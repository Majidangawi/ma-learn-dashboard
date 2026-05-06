import { describe, it, expect } from 'vitest';
import { parseCustomers, rowsToObjects } from '../../src/data/sheets-read.js';

describe('parseCustomers', () => {
  it('maps header row + data rows into typed objects', () => {
    const rows = [
      ['Email', 'Name', 'Product', 'AmountSAR', 'PurchasedAt', 'Token', 'Source'],
      ['a@b.com', 'Alice', 'prompt-pack', '99', '2026-04-01T10:00:00', 'MAL-ABCD1234', 'real'],
    ];
    const result = parseCustomers(rows);
    expect(result).toEqual([
      {
        email: 'a@b.com',
        name: 'Alice',
        product: 'prompt-pack',
        amountSAR: 99,
        purchasedAt: '2026-04-01T10:00:00',
        token: 'MAL-ABCD1234',
        source: 'real',
        cohort: '',
        status: '',
      },
    ]);
  });

  it('reads Cohort and Status columns when present (live Customers schema cols M/N)', () => {
    const rows = [
      ['Date', 'Email', 'Name', 'Phone', 'Product', 'Amount', 'Coupon', 'PaymentID', 'PaymentMethod', 'R1', 'R2', 'R3', 'Cohort', 'Status'],
      ['2026-05-05', 'c2buyer@x.com', 'C2 Buyer', '+966500000000', 'creative-ai-workshop-t3', '1199', '', 'pay_1', 'moyasar', '', '', '', 'C2', 'active'],
      ['2026-04-15', 'c1buyer@x.com', 'C1 Buyer', '+966500000001', 'creative-ai-workshop-t3', '999', '', 'pay_2', 'moyasar', '', '', '', 'C1', 'active'],
      ['2026-05-04', 'cancelled@x.com', 'Cancelled', '+966500000002', 'creative-ai-workshop-t3', '1199', '', 'pay_3', 'moyasar', '', '', '', 'C2', 'cancelled'],
    ];
    const result = parseCustomers(rows);
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({ email: 'c2buyer@x.com', cohort: 'C2', status: 'active' });
    expect(result[1]).toMatchObject({ email: 'c1buyer@x.com', cohort: 'C1', status: 'active' });
    expect(result[2]).toMatchObject({ email: 'cancelled@x.com', cohort: 'C2', status: 'cancelled' });
  });

  it('returns empty array when only header present', () => {
    expect(parseCustomers([['Email', 'Name']])).toEqual([]);
  });

  it('returns empty array when rows undefined', () => {
    expect(parseCustomers(undefined)).toEqual([]);
  });

  it('skips rows with empty email', () => {
    const rows = [
      ['Email', 'Name', 'Product', 'AmountSAR', 'PurchasedAt', 'Token', 'Source'],
      ['', 'GhostRow', '', '', '', '', ''],
      ['x@y.com', 'Real', 'prompt-pack', '99', '2026-04-01T10:00', 'MAL-ZZZ', 'real'],
    ];
    expect(parseCustomers(rows)).toHaveLength(1);
    expect(parseCustomers(rows)[0].email).toBe('x@y.com');
  });
});

describe('rowsToObjects', () => {
  it('maps header + data rows to objects keyed by header', () => {
    const out = rowsToObjects([
      ['Email', 'Name', 'Sources'],
      ['a@b.com', 'Alice', 'buyer'],
      ['b@c.com', 'Bob', 'buyer,waitlist'],
    ]);
    expect(out).toEqual([
      { Email: 'a@b.com', Name: 'Alice', Sources: 'buyer' },
      { Email: 'b@c.com', Name: 'Bob', Sources: 'buyer,waitlist' },
    ]);
  });

  it('returns [] when only a header row present', () => {
    expect(rowsToObjects([['Email', 'Name']])).toEqual([]);
  });

  it('returns [] on undefined / empty input', () => {
    expect(rowsToObjects(undefined)).toEqual([]);
    expect(rowsToObjects([])).toEqual([]);
  });

  it('backfills missing trailing cells with empty strings', () => {
    const out = rowsToObjects([
      ['A', 'B', 'C'],
      ['1', '2'],
    ]);
    expect(out).toEqual([{ A: '1', B: '2', C: '' }]);
  });
});

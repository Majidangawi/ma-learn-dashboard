import { describe, it, expect } from 'vitest';
import { parseCustomers } from '../../src/data/sheets-read.js';

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
      },
    ]);
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

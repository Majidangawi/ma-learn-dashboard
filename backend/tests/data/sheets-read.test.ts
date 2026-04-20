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

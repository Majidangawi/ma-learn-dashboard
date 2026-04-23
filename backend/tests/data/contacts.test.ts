import { describe, it, expect } from 'vitest';
import { joinContactList, joinContactDetail } from '../../src/data/contacts.js';

const SUBS = [
  { Email: 'a@x.com', Name: 'Alice', Sources: 'buyer,waitlist', Language: 'AR', AddedAt: '2026-04-01T00:00:00', LastSourceAt: '2026-04-14T00:00:00', Status: 'active', UnsubscribeToken: 'tok1' },
  { Email: 'b@x.com', Name: 'Bob',   Sources: 'website',        Language: 'EN', AddedAt: '2026-04-10T00:00:00', LastSourceAt: '2026-04-10T00:00:00', Status: 'active', UnsubscribeToken: 'tok2' },
];
const CUSTS = [
  { Date: '2026-04-14 12:00:00', Email: 'a@x.com', Name: 'Alice', Phone: '+966501234567', Product: 'creative-ai-workshop-t3', Amount: '799', Coupon: 'EARLYBIRD', 'Payment ID': 'pay_1' },
  { Date: '2026-04-14 12:00:01', Email: 'a@x.com', Name: 'Alice', Phone: '+966501234567', Product: 'intro-to-creative-ai',    Amount: '0',   Coupon: '',           'Payment ID': 'pay_2' },
];
const TOKENS = [
  { Token: 'MAL-T3-AAAA', Course: 'creative-ai-workshop-t3', Status: 'used', 'Customer Email': 'a@x.com' },
  { Token: 'MAL-T2-BBBB', Course: 'intro-to-creative-ai',    Status: 'used', 'Customer Email': 'a@x.com' },
];

describe('joinContactList', () => {
  it('produces one row per Subscribers email with products computed from Customers', () => {
    const rows = joinContactList(SUBS, CUSTS, TOKENS);
    expect(rows).toHaveLength(2);
    const alice = rows.find(r => r.email === 'a@x.com')!;
    expect(alice.hasBought).toBe(true);
    expect(alice.productsBought).toEqual(expect.arrayContaining(['creative-ai-workshop-t3', 'intro-to-creative-ai']));
    expect(alice.sources).toEqual(['buyer', 'waitlist']);
    const bob = rows.find(r => r.email === 'b@x.com')!;
    expect(bob.hasBought).toBe(false);
    expect(bob.productsBought).toEqual([]);
  });

  it('lastActivityAt is the max of LastSourceAt and most-recent PurchasedAt', () => {
    const rows = joinContactList(SUBS, CUSTS, TOKENS);
    const alice = rows.find(r => r.email === 'a@x.com')!;
    expect(alice.lastActivityAt).toBe('2026-04-14T12:00:01');
  });

  it('lowercases emails for joining', () => {
    const mixed = [{ ...SUBS[0], Email: 'A@X.COM' }];
    const custs = [{ ...CUSTS[0], Email: 'a@x.com' }];
    const rows = joinContactList(mixed, custs, []);
    expect(rows[0].email).toBe('a@x.com');
    expect(rows[0].hasBought).toBe(true);
  });
});

describe('joinContactDetail', () => {
  it('returns joined detail for one email with purchases sorted newest first', () => {
    const detail = joinContactDetail('a@x.com', SUBS, CUSTS, TOKENS);
    expect(detail).not.toBeNull();
    expect(detail!.email).toBe('a@x.com');
    expect(detail!.phone).toBe('+966501234567');
    expect(detail!.purchases).toHaveLength(2);
    expect(detail!.purchases[0].paymentId).toBe('pay_2'); // newest first
    expect(detail!.tokens).toHaveLength(2);
    expect(detail!.tokens[0]).toMatchObject({ product: expect.any(String), status: 'used' });
  });

  it('returns null for unknown email', () => {
    expect(joinContactDetail('nope@x.com', SUBS, CUSTS, TOKENS)).toBeNull();
  });
});

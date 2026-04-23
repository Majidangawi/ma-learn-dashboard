import { readSheet } from './sheets-read.js';

export interface ContactListRow {
  email: string;
  name: string;
  language: 'AR' | 'EN';
  sources: string[];
  status: 'active' | 'unsubscribed' | 'bounced';
  hasBought: boolean;
  productsBought: string[];
  addedAt: string;
  lastActivityAt: string;
}

export interface ContactDetail extends ContactListRow {
  phone: string;
  purchases: Array<{
    product: string;
    amountSAR: number;
    coupon: string;
    paymentId: string;
    purchasedAt: string;
  }>;
  tokens: Array<{
    product: string;
    token: string;
    status: 'available' | 'used' | 'revoked';
  }>;
}

function lc(s: unknown): string {
  return String(s ?? '').trim().toLowerCase();
}

function parseSources(s: unknown): string[] {
  return String(s ?? '').split(',').map(x => x.trim()).filter(Boolean);
}

function maxIso(a: string, b: string): string {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

export function joinContactList(
  subs: Record<string, unknown>[],
  custs: Record<string, unknown>[],
  _tokens: Record<string, unknown>[],
): ContactListRow[] {
  // Index customer rows by email → list of purchases (order preserved for lastActivity).
  const custsByEmail = new Map<string, Record<string, unknown>[]>();
  for (const c of custs) {
    const email = lc(c.Email);
    if (!email) continue;
    const arr = custsByEmail.get(email) ?? [];
    arr.push(c);
    custsByEmail.set(email, arr);
  }

  return subs
    .map(s => {
      const email = lc(s.Email);
      if (!email) return null;
      const custRows = custsByEmail.get(email) ?? [];
      const productsBought = Array.from(new Set(custRows.map(c => String(c.Product ?? '')).filter(Boolean)));
      const lastPurchasedAt = custRows
        .map(c => String(c.Date ?? '').replace(' ', 'T'))
        .filter(Boolean)
        .sort()
        .pop() ?? '';
      const lastSourceAt = String(s.LastSourceAt ?? '');
      const statusRaw = String(s.Status ?? 'active') as 'active' | 'unsubscribed' | 'bounced';
      return {
        email,
        name: String(s.Name ?? ''),
        language: (String(s.Language ?? 'AR') === 'EN' ? 'EN' : 'AR') as 'AR' | 'EN',
        sources: parseSources(s.Sources),
        status: statusRaw,
        hasBought: productsBought.length > 0,
        productsBought,
        addedAt: String(s.AddedAt ?? ''),
        lastActivityAt: maxIso(lastSourceAt, lastPurchasedAt),
      };
    })
    .filter((r): r is ContactListRow => r !== null);
}

export function joinContactDetail(
  email: string,
  subs: Record<string, unknown>[],
  custs: Record<string, unknown>[],
  tokens: Record<string, unknown>[],
): ContactDetail | null {
  const target = lc(email);
  const sub = subs.find(s => lc(s.Email) === target);
  if (!sub) return null;
  const custRows = custs.filter(c => lc(c.Email) === target);
  const tokRows = tokens.filter(t => lc(t['Customer Email']) === target);

  const list = joinContactList([sub], custRows, tokRows)[0]!;
  const phone = String(custRows.find(c => String(c.Phone ?? '').trim())?.Phone ?? '');

  const purchases = custRows
    .map(c => ({
      product: String(c.Product ?? ''),
      amountSAR: Number(c.Amount ?? 0),
      coupon: String(c.Coupon ?? ''),
      paymentId: String(c['Payment ID'] ?? ''),
      purchasedAt: String(c.Date ?? '').replace(' ', 'T'),
    }))
    .sort((a, b) => (a.purchasedAt < b.purchasedAt ? 1 : -1));

  const tokenRows = tokRows.map(t => ({
    product: String(t.Course ?? ''),
    token: String(t.Token ?? ''),
    status: String(t.Status ?? 'available') as 'available' | 'used' | 'revoked',
  }));

  return { ...list, phone, purchases, tokens: tokenRows };
}

// ─── In-memory cache for list reads ────────────────────────────────────────
// Prevents hammering the Sheets API when Majid toggles filters in the UI.
let listCache: { at: number; rows: ContactListRow[] } | null = null;
const LIST_TTL_MS = 30_000;

export async function readContacts(): Promise<ContactListRow[]> {
  if (listCache && Date.now() - listCache.at < LIST_TTL_MS) return listCache.rows;
  const [subs, custs, tokens] = await Promise.all([
    readSheet({ tab: 'Subscribers' }),
    readSheet({ tab: 'Customers' }),
    readSheet({ tab: 'Tokens' }),
  ]);
  const rows = joinContactList(subs, custs, tokens);
  listCache = { at: Date.now(), rows };
  return rows;
}

export async function readContactDetail(email: string): Promise<ContactDetail | null> {
  const [subs, custs, tokens] = await Promise.all([
    readSheet({ tab: 'Subscribers' }),
    readSheet({ tab: 'Customers' }),
    readSheet({ tab: 'Tokens' }),
  ]);
  return joinContactDetail(email, subs, custs, tokens);
}

export function invalidateContactsCache(): void {
  listCache = null;
}

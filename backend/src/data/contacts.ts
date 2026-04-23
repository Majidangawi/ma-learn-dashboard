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

/**
 * Normalize a Waitlist row (Arabic headers) to a common email-keyed shape.
 * The waitlist sheet uses columns: التاريخ والوقت, الاسم, البريد الإلكتروني,
 * رقم الجوال, الدورة / الورشة, Sent Status, Purchase Status, ...
 */
function normalizeWaitlistRow(w: Record<string, unknown>): {
  email: string; name: string; phone: string; addedAt: string; course: string; purchaseStatus: string;
} {
  const email = lc(w['البريد الإلكتروني'] ?? w.Email);
  const name = String(w['الاسم'] ?? w.Name ?? '').trim();
  const phone = String(w['رقم الجوال'] ?? w.Phone ?? '').trim();
  const addedAt = String(w['التاريخ والوقت'] ?? w.Date ?? '').trim();
  const course = String(w['الدورة / الورشة'] ?? w.Course ?? '').trim();
  const purchaseStatus = String(w['Purchase Status'] ?? '').trim();
  return { email, name, phone, addedAt, course, purchaseStatus };
}

export function joinContactList(
  subs: Record<string, unknown>[],
  custs: Record<string, unknown>[],
  _tokens: Record<string, unknown>[],
  waitlist: Record<string, unknown>[] = [],
): ContactListRow[] {
  // Index each source by lower-cased email.
  const custsByEmail = new Map<string, Record<string, unknown>[]>();
  for (const c of custs) {
    const email = lc(c.Email);
    if (!email) continue;
    const arr = custsByEmail.get(email) ?? [];
    arr.push(c);
    custsByEmail.set(email, arr);
  }
  const subsByEmail = new Map<string, Record<string, unknown>>();
  for (const s of subs) {
    const email = lc(s.Email);
    if (email) subsByEmail.set(email, s);
  }
  const waitByEmail = new Map<string, ReturnType<typeof normalizeWaitlistRow>>();
  for (const w of waitlist) {
    const n = normalizeWaitlistRow(w);
    if (n.email) waitByEmail.set(n.email, n);
  }

  const allEmails = new Set<string>([
    ...custsByEmail.keys(),
    ...subsByEmail.keys(),
    ...waitByEmail.keys(),
  ]);

  return Array.from(allEmails).map(email => {
    const s = subsByEmail.get(email);
    const w = waitByEmail.get(email);
    const custRows = custsByEmail.get(email) ?? [];
    const productsBought = Array.from(new Set(custRows.map(c => String(c.Product ?? '')).filter(Boolean)));
    const lastPurchasedAt = custRows
      .map(c => String(c.Date ?? '').replace(' ', 'T'))
      .filter(Boolean)
      .sort()
      .pop() ?? '';

    // Name preference: subscriber > customer > waitlist
    const customerName = String(custRows.find(c => String(c.Name ?? '').trim())?.Name ?? '');
    const name = String(s?.Name ?? '').trim() || customerName || (w?.name ?? '');

    // Sources union: subscriber's listed sources + 'buyer' if has purchases +
    // 'waitlist' if present in the waitlist sheet.
    const subSources = s ? parseSources(s.Sources) : [];
    const sourcesSet = new Set<string>(subSources);
    if (productsBought.length) sourcesSet.add('buyer');
    if (w) sourcesSet.add('waitlist');
    const sources = Array.from(sourcesSet);

    const lastSourceAt = String(s?.LastSourceAt ?? '');
    const statusRaw = (String(s?.Status ?? 'active') as 'active' | 'unsubscribed' | 'bounced');
    return {
      email,
      name,
      language: (String(s?.Language ?? 'AR') === 'EN' ? 'EN' : 'AR') as 'AR' | 'EN',
      sources,
      status: statusRaw,
      hasBought: productsBought.length > 0,
      productsBought,
      addedAt: String(s?.AddedAt ?? w?.addedAt ?? lastPurchasedAt ?? ''),
      lastActivityAt: maxIso(lastSourceAt, lastPurchasedAt),
    };
  });
}

export function joinContactDetail(
  email: string,
  subs: Record<string, unknown>[],
  custs: Record<string, unknown>[],
  tokens: Record<string, unknown>[],
  waitlist: Record<string, unknown>[] = [],
): ContactDetail | null {
  const target = lc(email);
  const sub = subs.find(s => lc(s.Email) === target);
  const custRows = custs.filter(c => lc(c.Email) === target);
  const tokRows = tokens.filter(t => lc(t['Customer Email']) === target);
  const waitRow = waitlist.find(w => lc(w['البريد الإلكتروني'] ?? w.Email) === target);
  // Contact must exist on at least one side (subscriber OR customer OR waitlist).
  if (!sub && custRows.length === 0 && !waitRow) return null;

  const list = joinContactList(sub ? [sub] : [], custRows, tokRows, waitRow ? [waitRow] : [])[0]!;
  const phoneFromCust = String(custRows.find(c => String(c.Phone ?? '').trim())?.Phone ?? '');
  const phoneFromWait = waitRow ? String(waitRow['رقم الجوال'] ?? waitRow.Phone ?? '').trim() : '';
  const phone = phoneFromCust || phoneFromWait;

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

async function readWaitlistRows(): Promise<Record<string, unknown>[]> {
  const waitlistSheetId = process.env.SHEET_ID_WAITLIST;
  if (!waitlistSheetId) return [];
  try {
    return await readSheet({ tab: 'Waitlist', sheetId: waitlistSheetId });
  } catch {
    // If the waitlist sheet is misconfigured, don't blow up Contacts — just
    // fall back to buyers + subscribers.
    return [];
  }
}

export async function readContacts(): Promise<ContactListRow[]> {
  if (listCache && Date.now() - listCache.at < LIST_TTL_MS) return listCache.rows;
  const [subs, custs, tokens, waitlist] = await Promise.all([
    readSheet({ tab: 'Subscribers' }),
    readSheet({ tab: 'Customers' }),
    readSheet({ tab: 'Tokens' }),
    readWaitlistRows(),
  ]);
  const rows = joinContactList(subs, custs, tokens, waitlist);
  listCache = { at: Date.now(), rows };
  return rows;
}

export async function readContactDetail(email: string): Promise<ContactDetail | null> {
  const [subs, custs, tokens, waitlist] = await Promise.all([
    readSheet({ tab: 'Subscribers' }),
    readSheet({ tab: 'Customers' }),
    readSheet({ tab: 'Tokens' }),
    readWaitlistRows(),
  ]);
  return joinContactDetail(email, subs, custs, tokens, waitlist);
}

export function invalidateContactsCache(): void {
  listCache = null;
}

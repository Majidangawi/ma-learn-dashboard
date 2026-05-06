import type { Customer } from './sheets-read.js';
import type { Token } from './read-extra.js';
import { CURRENT_T3_COHORT, T3_SEATS_TOTAL, countT3CohortSeats } from './home-kpis.js';

export interface InsightsInput {
  customers: Customer[];
  tokens: Token[];
  now: Date;
  anthropicSpendUSD?: number;
  pendingApprovals?: number;
  scheduledActions?: { label: string; when: string }[];
}

export interface Insights {
  revenueMTDSAR: number;
  revenueTodaySAR: number;
  newRegistrationsMTD: number;
  anthropicSpendUSD: number;
  revenue30Days: { date: string; sar: number }[];
  t3SeatsFilled: number;
  t3SeatsTotal: number;
  pendingApprovals: number;
  scheduledActions: { label: string; when: string }[];
  recentBuyers: { email: string; name: string; product: string; amountSAR: number; purchasedAt: string }[];
}

function parseDate(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isFinite(d.valueOf()) ? d : null;
}
function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function computeInsights(input: InsightsInput): Insights {
  const { customers, now } = input;
  const year = now.getFullYear(), month = now.getMonth();
  const todayStr = isoDate(now);

  let revenueMTDSAR = 0, revenueTodaySAR = 0;
  const uniqueEmailsMTD = new Set<string>();
  const byDay = new Map<string, number>();

  for (const c of customers) {
    const d = parseDate(c.purchasedAt);
    if (!d) continue;
    if (d.getFullYear() === year && d.getMonth() === month) {
      revenueMTDSAR += c.amountSAR;
      if (c.email) uniqueEmailsMTD.add(c.email.toLowerCase());
    }
    if (isoDate(d) === todayStr) revenueTodaySAR += c.amountSAR;
  }

  const revenue30Days: { date: string; sar: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400_000);
    byDay.set(isoDate(d), 0);
  }
  for (const c of customers) {
    const d = parseDate(c.purchasedAt);
    if (!d) continue;
    const key = isoDate(d);
    if (byDay.has(key)) byDay.set(key, (byDay.get(key) ?? 0) + c.amountSAR);
  }
  for (const [date, sar] of byDay) revenue30Days.push({ date, sar });
  revenue30Days.sort((a, b) => a.date.localeCompare(b.date));

  const t3SeatsFilled = countT3CohortSeats(customers, CURRENT_T3_COHORT);

  const recentBuyers = [...customers]
    .filter(c => parseDate(c.purchasedAt))
    .sort((a, b) => (parseDate(b.purchasedAt)!.valueOf() - parseDate(a.purchasedAt)!.valueOf()))
    .slice(0, 5)
    .map(c => ({ email: c.email, name: c.name, product: c.product, amountSAR: c.amountSAR, purchasedAt: c.purchasedAt }));

  return {
    revenueMTDSAR, revenueTodaySAR,
    newRegistrationsMTD: uniqueEmailsMTD.size,
    anthropicSpendUSD: input.anthropicSpendUSD ?? 0,
    revenue30Days,
    t3SeatsFilled, t3SeatsTotal: T3_SEATS_TOTAL,
    pendingApprovals: input.pendingApprovals ?? 0,
    scheduledActions: input.scheduledActions ?? [],
    recentBuyers,
  };
}

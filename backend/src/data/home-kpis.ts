import type { Token } from './read-extra.js';
import type { Customer } from './sheets-read.js';

// TODO: move product prices to a Products sheet (or similar) so non-engineers
// can update them without a deploy. Hardcoded for v1 of the Home briefing.
export const PRODUCT_PRICE_SAR: Record<string, number> = {
  'intro-to-creative-ai':    449,
  'creative-ai-workshop-t3': 1199,
  'beyond-lighting':         700,
  'prompt-pack':             99,
};

// Currently selling T3 cohort. Source-of-truth for "T3 Cohort N seats" UI.
// Bump when C3 opens — Apps Script `getT3SeatsTaken('C2')` default in
// token-validator must move in lock-step (see Code.js cohort default at line ~412).
export const CURRENT_T3_COHORT = 'C2';
export const T3_PRODUCT = 'creative-ai-workshop-t3';
export const T3_SEATS_TOTAL = 30;

/** Mirrors token-validator getT3SeatsTaken(cohort): counts Customers rows
 *  where Product=T3 AND Cohort matches AND Status='active' (default 'active'
 *  if cell is empty so legacy rows tagged with the cohort still count). */
export function countT3CohortSeats(customers: Customer[], cohort: string): number {
  const want = cohort.trim().toUpperCase();
  let n = 0;
  for (const c of customers) {
    if (c.product !== T3_PRODUCT) continue;
    const rowCohort = (c.cohort || '').trim().toUpperCase();
    if (rowCohort !== want) continue;
    const rowStatus = (c.status || 'active').trim().toLowerCase();
    if (rowStatus !== 'active') continue;
    n++;
  }
  return n;
}

export interface HomeKpis {
  revenueThisWeekSAR: number;
  revenuePrevWeekSAR: number;
  revenueSparkline: number[];   // 14 daily values, oldest first
  newCustomersThisWeek: number; // distinct emails this week
  activeTokensUnused: number;   // status='available'
  t3c2SeatsSold: number;
  t3c2SeatsTotal: number;       // constant 30 for now
  totalUnitsSold: number;       // all-time status='used'
}

export function startOfISOWeek(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = x.getUTCDay();         // 0=Sun..6=Sat
  const diff = (day + 6) % 7;         // Mon=0, Sun=6
  x.setUTCDate(x.getUTCDate() - diff);
  return x;
}

export function dayKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

export function computeHomeKpis(tokens: Token[], customers: Customer[], now: Date = new Date()): HomeKpis {
  const weekStart     = startOfISOWeek(now);
  const prevWeekStart = new Date(weekStart); prevWeekStart.setUTCDate(prevWeekStart.getUTCDate() - 7);
  const weekEnd       = new Date(weekStart); weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  let revThis = 0, revPrev = 0, unitsAll = 0;
  const newEmails = new Set<string>();
  const bucket: Record<string, number> = {};

  for (const t of tokens) {
    if (t.status === 'used' && t.assignedAt) {
      const at = new Date(t.assignedAt);
      if (isNaN(at.getTime())) continue;
      const price = PRODUCT_PRICE_SAR[t.product] ?? 0;
      unitsAll++;
      if (at >= weekStart && at < weekEnd) {
        revThis += price;
        if (t.email) newEmails.add(t.email.toLowerCase());
      } else if (at >= prevWeekStart && at < weekStart) {
        revPrev += price;
      }
      // Sparkline: last 14 days including today
      const daysAgo = Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate())) / 86400000);
      if (daysAgo >= 0 && daysAgo < 14) {
        bucket[dayKey(at)] = (bucket[dayKey(at)] ?? 0) + price;
      }
    }
  }

  const spark: number[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    d.setUTCDate(d.getUTCDate() - i);
    spark.push(bucket[dayKey(d)] ?? 0);
  }

  return {
    revenueThisWeekSAR:   revThis,
    revenuePrevWeekSAR:   revPrev,
    revenueSparkline:     spark,
    newCustomersThisWeek: newEmails.size,
    activeTokensUnused:   tokens.filter(t => t.status === 'available').length,
    t3c2SeatsSold:        countT3CohortSeats(customers, CURRENT_T3_COHORT),
    t3c2SeatsTotal:       T3_SEATS_TOTAL,
    totalUnitsSold:       unitsAll,
  };
}

/**
 * One-time (idempotent) backfill: walks Customers + Waitlist tabs and upserts
 * each unique email into the Subscribers tab via `admin_upsert_subscriber`.
 *
 * Re-runnable — the Apps Script endpoint merges sources for existing rows.
 *
 * Usage:  npx tsx scripts/backfill-subscribers.ts
 * Required env: APPS_SCRIPT_URL, ADMIN_TOKEN (or APPS_SCRIPT_ADMIN_TOKEN),
 *               SHEET_ID, BACKEND_OAUTH_CLIENT_ID,
 *               BACKEND_OAUTH_CLIENT_SECRET, BACKEND_OAUTH_REFRESH_TOKEN.
 */
import { createAppsScriptClient } from '../src/apps-script/client.js';
import { readSheet } from '../src/data/sheets-read.js';

interface PlanEntry {
  email: string;
  name?: string;
  source: 'buyer' | 'waitlist';
  language: 'AR' | 'EN';
}

async function main(): Promise<void> {
  const adminToken = process.env.ADMIN_TOKEN ?? process.env.APPS_SCRIPT_ADMIN_TOKEN;
  if (!process.env.APPS_SCRIPT_URL || !adminToken) {
    throw new Error('Missing APPS_SCRIPT_URL or ADMIN_TOKEN');
  }
  const apps = createAppsScriptClient({
    url: process.env.APPS_SCRIPT_URL,
    adminToken,
  });

  const customers = await readSheet({ tab: 'Customers' });
  const waitlist = await readSheet({ tab: 'Waitlist' });

  const plan: PlanEntry[] = [];

  for (const r of customers) {
    const email = String(r.Email ?? '').toLowerCase().trim();
    if (!email) continue;
    plan.push({ email, name: r.Name, source: 'buyer', language: 'AR' });
  }
  for (const r of waitlist) {
    const email = String(r.Email ?? '').toLowerCase().trim();
    if (!email) continue;
    plan.push({ email, name: r.Name, source: 'waitlist', language: 'AR' });
  }

  console.log(`Backfill plan: ${plan.length} rows from Customers + Waitlist.`);
  const seen = new Set<string>();
  let done = 0;
  for (const entry of plan) {
    const dedupeKey = `${entry.email}|${entry.source}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    try {
      await apps.call('admin_upsert_subscriber', entry as unknown as Record<string, unknown>);
      done++;
      if (done % 25 === 0) console.log(`  ${done}/${plan.length}`);
    } catch (e) {
      console.error(`Failed: ${entry.email} (${entry.source})`, e);
    }
  }
  console.log(`Done. ${done} upserts.`);
}

main().catch(e => { console.error(e); process.exit(1); });

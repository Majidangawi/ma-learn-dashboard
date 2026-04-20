/**
 * Verifies Brevo-required DNS records for the newsletter sending subdomain.
 * Run after completing docs/brevo-setup-runbook.md Step 3.
 *
 * Usage:  npx tsx scripts/verify-brevo-dns.ts
 * Exits 0 if SPF + DKIM both PASS; DMARC is advisory.
 */

import { resolveTxt } from 'node:dns/promises';

const DOMAIN = process.env.BREVO_DNS_DOMAIN ?? 'newsletter.malearnsa.com';

async function txt(host: string): Promise<string[]> {
  try {
    const rows = await resolveTxt(host);
    return rows.map((r) => r.join(''));
  } catch {
    return [];
  }
}

async function main(): Promise<void> {
  console.log(`Verifying DNS for ${DOMAIN}\n`);

  const spf = await txt(DOMAIN);
  const hasSpf = spf.some((r) => r.includes('spf.brevo.com'));
  console.log(`SPF:   ${hasSpf ? 'PASS' : 'FAIL'}  (looked for "spf.brevo.com" at ${DOMAIN})`);
  if (!hasSpf && spf.length > 0) console.log(`       Got: ${JSON.stringify(spf)}`);

  const dkim = await txt(`brevo-code._domainkey.${DOMAIN}`);
  const hasDkim = dkim.some((r) => r.startsWith('v=DKIM1'));
  console.log(`DKIM:  ${hasDkim ? 'PASS' : 'FAIL'}  (looked for v=DKIM1 at brevo-code._domainkey.${DOMAIN})`);

  const dmarc = await txt(`_dmarc.${DOMAIN}`);
  const hasDmarc = dmarc.some((r) => r.startsWith('v=DMARC1'));
  console.log(`DMARC: ${hasDmarc ? 'PASS' : 'WARN'} (optional; looked for v=DMARC1 at _dmarc.${DOMAIN})`);

  process.exit(hasSpf && hasDkim ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

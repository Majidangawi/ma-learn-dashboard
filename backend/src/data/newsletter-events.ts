import { readSheet } from './sheets-read.js';

export interface TopClickedLink {
  url: string;
  count: number;
}

/**
 * Aggregate the `clicked` events for one newsletter and return the top-N URLs
 * by click count, highest first. Reads the `NewsletterEvents` sheet tab that
 * the Brevo webhook ingestor (Task 20) appends to.
 */
export async function topClickedLinks(
  newsletterId: string,
  limit = 10,
): Promise<TopClickedLink[]> {
  const rows = await readSheet({ tab: 'NewsletterEvents' });
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (String(r.NewsletterID ?? '') !== newsletterId) continue;
    if (String(r.Event ?? '') !== 'clicked') continue;
    const url = String(r.URL ?? '');
    if (!url) continue;
    counts.set(url, (counts.get(url) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([url, count]) => ({ url, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

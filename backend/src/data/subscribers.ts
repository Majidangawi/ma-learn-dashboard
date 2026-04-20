import { readSheet } from './sheets-read.js';

export interface Subscriber {
  email: string;
  name: string;
  sources: string[];
  language: 'AR' | 'EN';
  addedAt: string;
  lastSourceAt: string;
  status: 'active' | 'unsubscribed' | 'bounced';
  unsubscribeToken: string;
}

export async function readSubscribers(): Promise<Subscriber[]> {
  const rows = await readSheet({ tab: 'Subscribers' });
  return rows.map(r => ({
    email: String(r.Email ?? '').toLowerCase(),
    name: String(r.Name ?? ''),
    sources: String(r.Sources ?? '').split(',').map(s => s.trim()).filter(Boolean),
    language: (String(r.Language ?? 'AR') === 'EN' ? 'EN' : 'AR') as 'AR' | 'EN',
    addedAt: String(r.AddedAt ?? ''),
    lastSourceAt: String(r.LastSourceAt ?? ''),
    status: (['active', 'unsubscribed', 'bounced'].includes(String(r.Status ?? ''))
      ? (r.Status as Subscriber['status'])
      : 'active'),
    unsubscribeToken: String(r.UnsubscribeToken ?? ''),
  })).filter(r => r.email);
}

export async function countActive(): Promise<{ total: number; active: number; unsubscribed: number }> {
  const subs = await readSubscribers();
  return {
    total: subs.length,
    active: subs.filter(s => s.status === 'active').length,
    unsubscribed: subs.filter(s => s.status === 'unsubscribed').length,
  };
}

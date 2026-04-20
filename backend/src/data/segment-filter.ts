import type { Subscriber } from './subscribers.js';

export interface SegmentFilter {
  sources?: string[];        // e.g. ['buyer', 'waitlist']
  language?: 'AR' | 'EN';
  excludeUnsub?: boolean;    // default true
  excludeEmails?: string[];  // e.g. openers of a previous send (resend-to-non-openers)
}

export function applyFilter(subs: Subscriber[], f: SegmentFilter): Subscriber[] {
  const excludeUnsub = f.excludeUnsub !== false;
  const excludeSet = new Set((f.excludeEmails ?? []).map(e => e.toLowerCase()));
  return subs.filter(s => {
    if (excludeUnsub && s.status !== 'active') return false;
    if (excludeSet.has(s.email.toLowerCase())) return false;
    if (f.language && s.language !== f.language) return false;
    if (f.sources && f.sources.length > 0) {
      if (!f.sources.some(src => s.sources.includes(src))) return false;
    }
    return true;
  });
}

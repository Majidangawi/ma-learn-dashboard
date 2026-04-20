import type { Subscriber } from './subscribers.js';

export interface SegmentFilter {
  sources?: string[];        // e.g. ['buyer', 'waitlist']
  language?: 'AR' | 'EN';
  excludeUnsub?: boolean;    // default true
}

export function applyFilter(subs: Subscriber[], f: SegmentFilter): Subscriber[] {
  const excludeUnsub = f.excludeUnsub !== false;
  return subs.filter(s => {
    if (excludeUnsub && s.status !== 'active') return false;
    if (f.language && s.language !== f.language) return false;
    if (f.sources && f.sources.length > 0) {
      if (!f.sources.some(src => s.sources.includes(src))) return false;
    }
    return true;
  });
}

import type { Subscriber } from './subscribers.js';

export interface SegmentFilter {
  sources?: string[];
  language?: 'AR' | 'EN';
  excludeUnsub?: boolean;
  excludeEmails?: string[];
  onlyEmails?: string[];     // NEW — 1:1 or small-set targeting (Contacts page)
}

export function applyFilter(subs: Subscriber[], f: SegmentFilter): Subscriber[] {
  const excludeUnsub = f.excludeUnsub !== false;
  const excludeSet = new Set((f.excludeEmails ?? []).map(e => e.toLowerCase()));
  const onlySet = f.onlyEmails && f.onlyEmails.length > 0
    ? new Set(f.onlyEmails.map(e => e.toLowerCase()))
    : null;

  return subs.filter(s => {
    if (excludeUnsub && s.status !== 'active') return false;
    if (excludeSet.has(s.email.toLowerCase())) return false;
    // onlyEmails short-circuits source/language filters — targeted send.
    if (onlySet) return onlySet.has(s.email.toLowerCase());
    if (f.language && s.language !== f.language) return false;
    if (f.sources && f.sources.length > 0) {
      if (!f.sources.some(src => s.sources.includes(src))) return false;
    }
    return true;
  });
}

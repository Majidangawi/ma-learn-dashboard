import { describe, it, expect } from 'vitest';
import { applyFilter } from '../../src/data/segment-filter.js';
import type { Subscriber } from '../../src/data/subscribers.js';

function s(partial: Partial<Subscriber>): Subscriber {
  return {
    email: 'a@b.com', name: '', sources: [], language: 'AR',
    addedAt: '', lastSourceAt: '', status: 'active', unsubscribeToken: 'tok',
    ...partial,
  };
}

describe('applyFilter', () => {
  const subs: Subscriber[] = [
    s({ email: 'buyer@x.com', sources: ['buyer'], language: 'AR', status: 'active' }),
    s({ email: 'wait@x.com', sources: ['waitlist'], language: 'AR', status: 'active' }),
    s({ email: 'both@x.com', sources: ['buyer', 'waitlist'], language: 'EN', status: 'active' }),
    s({ email: 'gone@x.com', sources: ['buyer'], language: 'AR', status: 'unsubscribed' }),
    s({ email: 'bounced@x.com', sources: ['website'], language: 'AR', status: 'bounced' }),
  ];

  it('excludes non-active by default', () => {
    const out = applyFilter(subs, {});
    expect(out.map(x => x.email)).toEqual(['buyer@x.com', 'wait@x.com', 'both@x.com']);
  });

  it('includes non-active when excludeUnsub is explicitly false', () => {
    const out = applyFilter(subs, { excludeUnsub: false });
    expect(out.length).toBe(5);
  });

  it('filters by single source', () => {
    const out = applyFilter(subs, { sources: ['waitlist'] });
    expect(out.map(x => x.email)).toEqual(['wait@x.com', 'both@x.com']);
  });

  it('treats multiple sources as OR', () => {
    const out = applyFilter(subs, { sources: ['website', 'waitlist'] });
    // bounced is excluded by status=active filter, so only wait@ and both@ match
    expect(out.map(x => x.email).sort()).toEqual(['both@x.com', 'wait@x.com']);
  });

  it('filters by language', () => {
    const out = applyFilter(subs, { language: 'EN' });
    expect(out.map(x => x.email)).toEqual(['both@x.com']);
  });

  it('combines source + language as AND', () => {
    const out = applyFilter(subs, { sources: ['buyer'], language: 'AR' });
    expect(out.map(x => x.email)).toEqual(['buyer@x.com']);
  });

  it('empty sources array is ignored (treated as no source filter)', () => {
    const out = applyFilter(subs, { sources: [] });
    expect(out.length).toBe(3);
  });
});

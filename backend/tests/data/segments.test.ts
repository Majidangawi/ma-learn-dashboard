import { describe, it, expect } from 'vitest';
import { resolveSegment, substituteVariables } from '../../src/data/segments.js';

const customers = [
  { email:'a@x.com', name:'A', product:'creative-ai-workshop-t3', amountSAR:799, purchasedAt:'2026-04-15', token:'MAL-A', source:'real' },
  { email:'b@x.com', name:'B', product:'creative-ai-workshop-t3', amountSAR:799, purchasedAt:'2026-04-16', token:'MAL-B', source:'real' },
  { email:'c@x.com', name:'C', product:'prompt-pack', amountSAR:99, purchasedAt:'2026-04-10', token:'MAL-C', source:'real' },
];

describe('resolveSegment', () => {
  it('t3_buyers returns only T3 purchases', () => {
    const r = resolveSegment('t3_buyers', customers);
    expect(r.map(c => c.email)).toEqual(['a@x.com', 'b@x.com']);
  });
  it('all_buyers returns everyone', () => {
    expect(resolveSegment('all_buyers', customers)).toHaveLength(3);
  });
  it('t2_buyers returns intro-to-creative-ai purchases', () => {
    const c2 = [...customers, { ...customers[0], product: 'intro-to-creative-ai', email: 'd@x.com' }];
    expect(resolveSegment('t2_buyers', c2).map(c => c.email)).toEqual(['d@x.com']);
  });
  it('unknown segment returns empty + throws in strict mode', () => {
    expect(() => resolveSegment('nope', customers, { strict: true })).toThrow();
    expect(resolveSegment('nope', customers)).toEqual([]);
  });
  it('dedupes by email within segment', () => {
    const dupes = [...customers, { ...customers[0] }];
    expect(resolveSegment('t3_buyers', dupes)).toHaveLength(2);
  });
});

describe('substituteVariables', () => {
  it('replaces {name} from vars map', () => {
    expect(substituteVariables('Hi {name}', { name: 'Alice' })).toBe('Hi Alice');
  });
  it('leaves unknown vars as-is', () => {
    expect(substituteVariables('Hi {missing}', { name: 'A' })).toBe('Hi {missing}');
  });
});

// backend/tests/noor/cost-cap.test.ts
import { describe, it, expect } from 'vitest';
import { InMemoryCostTracker, usdCost } from '../../src/noor/cost-cap.js';

describe('InMemoryCostTracker', () => {
  it('accumulates usage and reports within cap', () => {
    const t = new InMemoryCostTracker(10);
    t.record(3.5);
    t.record(2.0);
    expect(t.monthToDateUSD()).toBeCloseTo(5.5);
    expect(t.isOverCap()).toBe(false);
  });

  it('flags over cap', () => {
    const t = new InMemoryCostTracker(10);
    t.record(11);
    expect(t.isOverCap()).toBe(true);
  });

  it('reset clears accumulated spend', () => {
    const t = new InMemoryCostTracker(10);
    t.record(5);
    t.reset();
    expect(t.monthToDateUSD()).toBe(0);
  });
});

describe('usdCost', () => {
  it('computes cost from input/output tokens', () => {
    // Claude Opus 5 pricing: 1M input + 1M output = $5 + $25 = $30
    expect(usdCost({ input_tokens: 1_000_000, output_tokens: 1_000_000 })).toBe(30);
  });

  it('cache reads are cheap', () => {
    // 1M cache read = $0.50 (0.1x input rate)
    expect(usdCost({ cache_read_input_tokens: 1_000_000 })).toBe(0.5);
  });

  it('handles missing fields', () => {
    expect(usdCost({})).toBe(0);
  });
});

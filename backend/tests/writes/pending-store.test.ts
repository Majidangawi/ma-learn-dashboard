import { describe, it, expect } from 'vitest';
import { PendingWriteStore } from '../../src/writes/pending-store.js';

describe('PendingWriteStore', () => {
  it('stage + retrieve by id', () => {
    const s = new PendingWriteStore();
    const id = s.stage({ kind: 'toggle_lesson', inputs: { lessonId: 'L1', active: true }, preview: { cell: 'Lessons!E2', from: 'FALSE', to: 'TRUE' }, idempotencyKey: 'k1' });
    expect(s.get(id)?.kind).toBe('toggle_lesson');
    expect(s.get(id)?.status).toBe('pending');
  });
  it('approve marks approved', () => {
    const s = new PendingWriteStore();
    const id = s.stage({ kind: 'toggle_lesson', inputs: {}, preview: {}, idempotencyKey: 'k2' });
    s.approve(id);
    expect(s.get(id)?.status).toBe('approved');
  });
  it('cannot approve twice', () => {
    const s = new PendingWriteStore();
    const id = s.stage({ kind: 'toggle_lesson', inputs: {}, preview: {}, idempotencyKey: 'k3' });
    s.approve(id);
    expect(() => s.approve(id)).toThrow();
  });
  it('reject sets rejected', () => {
    const s = new PendingWriteStore();
    const id = s.stage({ kind: 'toggle_lesson', inputs: {}, preview: {}, idempotencyKey: 'k4' });
    s.reject(id);
    expect(s.get(id)?.status).toBe('rejected');
  });
  it('expires stale pending entries after TTL', () => {
    const s = new PendingWriteStore({ ttlMs: 10 });
    const id = s.stage({ kind: 'toggle_lesson', inputs: {}, preview: {}, idempotencyKey: 'k5' });
    const real = Date.now;
    Date.now = () => real() + 1000;
    try { expect(s.get(id)).toBeUndefined(); } finally { Date.now = real; }
  });
});

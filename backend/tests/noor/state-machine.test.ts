// backend/tests/noor/state-machine.test.ts
import { describe, it, expect } from 'vitest';
import {
  createPlan, approvePlan, rejectPlan, markExecuted,
} from '../../src/noor/state-machine.js';

describe('plan state machine', () => {
  it('new plan is pending', () => {
    const p = createPlan({ prompt: 'test', toolCalls: [] });
    expect(p.status).toBe('pending');
    expect(p.id).toBeTruthy();
    expect(p.createdAt).toBeTruthy();
  });

  it('approve flips to approved', () => {
    const p = approvePlan(createPlan({ prompt: 'test', toolCalls: [] }));
    expect(p.status).toBe('approved');
    expect(p.resolvedAt).toBeTruthy();
  });

  it('reject flips to rejected and cannot then be approved', () => {
    const p = rejectPlan(createPlan({ prompt: 'test', toolCalls: [] }));
    expect(p.status).toBe('rejected');
    expect(() => approvePlan(p)).toThrow();
  });

  it('markExecuted requires approved plan', () => {
    const pending = createPlan({ prompt: 'test', toolCalls: [] });
    expect(() => markExecuted(pending, {})).toThrow();
    const approved = approvePlan(pending);
    const executed = markExecuted(approved, { ok: true });
    expect(executed.status).toBe('executed');
    expect(executed.result).toEqual({ ok: true });
  });
});

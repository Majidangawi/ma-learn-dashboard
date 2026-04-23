// backend/tests/data/audit-log.test.ts
import { describe, it, expect } from 'vitest';
import { buildAuditRow, buildActivityEvent } from '../../src/data/audit-log.js';

describe('buildAuditRow', () => {
  it('serializes entry into the 7-column row expected by the AuditLog sheet', () => {
    const row = buildAuditRow({
      timestamp: '2026-04-18T12:00:00Z',
      actor: 'majid',
      tool: 'toggle_lesson',
      inputs: { lessonId: 'L1', active: true },
      output: { success: true },
      approval: 'auto',
      idempotencyKey: 'abc123',
    });
    expect(row).toEqual([
      '2026-04-18T12:00:00Z',
      'majid',
      'toggle_lesson',
      '{"lessonId":"L1","active":true}',
      '{"success":true}',
      'auto',
      'abc123',
    ]);
  });

  it('handles noor actor and approved state', () => {
    const row = buildAuditRow({
      timestamp: '2026-04-18T13:00:00Z',
      actor: 'noor',
      tool: 'send_email',
      inputs: { templateId: 't1' },
      output: { messageId: 'm-42' },
      approval: 'approved',
      idempotencyKey: 'key-42',
    });
    expect(row[1]).toBe('noor');
    expect(row[5]).toBe('approved');
  });

  it('handles rejected approval state', () => {
    const row = buildAuditRow({
      timestamp: '2026-04-18T14:00:00Z',
      actor: 'noor',
      tool: 'send_email',
      inputs: {},
      output: { reason: 'cancelled' },
      approval: 'rejected',
      idempotencyKey: 'k-99',
    });
    expect(row[5]).toBe('rejected');
  });

  it('serializes nested objects', () => {
    const row = buildAuditRow({
      timestamp: 'ts',
      actor: 'noor',
      tool: 'create_coupon',
      inputs: { code: 'EB', params: { pct: 20, max: 30 } },
      output: null,
      approval: 'auto',
      idempotencyKey: 'ik',
    });
    expect(JSON.parse(row[3])).toEqual({ code: 'EB', params: { pct: 20, max: 30 } });
  });
});

describe('buildActivityEvent', () => {
  it('maps save_lesson_media tool to lesson_save type', () => {
    const r = ['2026-04-23T10:00:00Z', 'majid', 'save_lesson_media', '{}', '{}', 'auto', 'k1'];
    const e = buildActivityEvent(r);
    expect(e.type).toBe('lesson_save');
    expect(e.summary).toBe('Save lesson media');
    expect(e.actor).toBe('majid');
    expect(e.at).toBe('2026-04-23T10:00:00Z');
  });
  it('strips admin_ prefix and humanizes', () => {
    const r = ['2026-04-23T10:00:00Z', 'noor', 'admin_gift_token', '{}', '{}', 'auto', 'k2'];
    const e = buildActivityEvent(r);
    expect(e.type).toBe('token_gift');
    expect(e.summary).toBe('Gift token');
  });
  it('falls back to default type + capitalized summary for unknown tool', () => {
    const r = ['2026-04-23T10:00:00Z', 'majid', 'some_new_tool', '{}', '{}', 'auto', 'k3'];
    const e = buildActivityEvent(r);
    expect(e.type).toBe('default');
    expect(e.summary).toBe('Some new tool');
  });
});

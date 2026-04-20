import { describe, it, expect, vi } from 'vitest';
import { runSchedulerTick } from '../../src/workers/scheduler.js';
import type { Newsletter } from '../../src/data/newsletters.js';

function nl(partial: Partial<Newsletter>): Newsletter {
  return {
    newsletterId: 'nl_x',
    subject: '',
    preheader: '',
    language: 'AR',
    blocks: [],
    segmentFilter: {},
    status: 'draft',
    createdAt: '',
    updatedAt: '',
    scheduledAt: '',
    sentAt: '',
    recipientCount: 0,
    deliveredCount: 0,
    openCount: 0,
    clickCount: 0,
    bounceCount: 0,
    unsubCount: 0,
    brevoCampaignId: '',
    idempotencyKey: '',
    createdBy: 'majid',
    cloneOf: '',
    ...partial,
  };
}

describe('scheduler tick', () => {
  it('sends any newsletter with status=scheduled and sendAt <= now', async () => {
    const readNL = vi.fn().mockResolvedValue([
      nl({ newsletterId: 'nl_1', status: 'scheduled', scheduledAt: '2026-01-01 00:00:00' }),
      nl({ newsletterId: 'nl_2', status: 'draft', scheduledAt: '' }),
      nl({ newsletterId: 'nl_3', status: 'scheduled', scheduledAt: '2099-01-01 00:00:00' }),
    ]);
    const send = vi.fn().mockResolvedValue({ ok: true });
    await runSchedulerTick({
      now: new Date('2026-06-01T00:00:00Z'),
      readNewsletters: readNL,
      sendNewsletter: send,
    });
    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith({ newsletterId: 'nl_1' });
  });

  it('skips when scheduledAt is in the future (KSA)', async () => {
    // 09:00 KSA == 06:00 UTC. now = 05:59 UTC → not yet due.
    const readNL = vi.fn().mockResolvedValue([
      nl({ newsletterId: 'nl_future', status: 'scheduled', scheduledAt: '2026-05-01 09:00:00' }),
    ]);
    const send = vi.fn().mockResolvedValue({ ok: true });
    await runSchedulerTick({
      now: new Date('2026-05-01T05:59:00Z'),
      readNewsletters: readNL,
      sendNewsletter: send,
    });
    expect(send).not.toHaveBeenCalled();
  });

  it('sends when scheduledAt is now-or-past in KSA', async () => {
    // 09:00 KSA == 06:00 UTC.
    const readNL = vi.fn().mockResolvedValue([
      nl({ newsletterId: 'nl_due', status: 'scheduled', scheduledAt: '2026-05-01 09:00:00' }),
    ]);
    const send = vi.fn().mockResolvedValue({ ok: true });
    await runSchedulerTick({
      now: new Date('2026-05-01T06:00:00Z'),
      readNewsletters: readNL,
      sendNewsletter: send,
    });
    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith({ newsletterId: 'nl_due' });
  });

  it('swallows sendNewsletter errors so one bad row does not stop the tick', async () => {
    const readNL = vi.fn().mockResolvedValue([
      nl({ newsletterId: 'nl_a', status: 'scheduled', scheduledAt: '2026-01-01 00:00:00' }),
      nl({ newsletterId: 'nl_b', status: 'scheduled', scheduledAt: '2026-01-01 00:00:00' }),
    ]);
    const send = vi.fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ ok: true });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await runSchedulerTick({
      now: new Date('2026-06-01T00:00:00Z'),
      readNewsletters: readNL,
      sendNewsletter: send,
    });
    expect(send).toHaveBeenCalledTimes(2);
    errSpy.mockRestore();
  });

  it('ignores invalid scheduledAt values', async () => {
    const readNL = vi.fn().mockResolvedValue([
      nl({ newsletterId: 'nl_bad', status: 'scheduled', scheduledAt: 'not-a-date' }),
    ]);
    const send = vi.fn().mockResolvedValue({ ok: true });
    await runSchedulerTick({
      now: new Date('2099-01-01T00:00:00Z'),
      readNewsletters: readNL,
      sendNewsletter: send,
    });
    expect(send).not.toHaveBeenCalled();
  });
});

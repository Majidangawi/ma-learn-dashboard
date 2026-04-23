import { describe, it, expect, vi } from 'vitest';
import Fastify from 'fastify';
import activityRoute from '../../src/routes/activity.js';
import type { ActivityEvent } from '../../src/data/audit-log.js';

async function setup(entries: ActivityEvent[]) {
  const readLog = vi.fn().mockResolvedValue(entries);
  const app = Fastify();
  await app.register(activityRoute, { readLog, requireAuth: () => 'majid' });
  return { app, readLog };
}

describe('GET /api/data/activity', () => {
  it('returns events newest-first', async () => {
    const { app } = await setup([
      { at: '2026-04-23T10:00:00Z', actor: 'majid', type: 'lesson_save',      summary: 'Save lesson media' },
      { at: '2026-04-23T09:00:00Z', actor: 'noor',  type: 'newsletter_send',  summary: 'Send newsletter' },
    ]);
    const res = await app.inject({ method: 'GET', url: '/api/data/activity?limit=20' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.events).toHaveLength(2);
    expect(body.events[0].type).toBe('lesson_save');
  });

  it('honors limit query param', async () => {
    const big = Array.from({ length: 50 }, (_, i) => ({
      at: new Date(Date.now() - i * 1000).toISOString(), actor: 'majid', type: 'default', summary: 'x',
    }));
    const { app } = await setup(big);
    const res = await app.inject({ method: 'GET', url: '/api/data/activity?limit=5' });
    expect(res.json().events).toHaveLength(5);
  });

  it('default limit = 20', async () => {
    const big = Array.from({ length: 50 }, (_, i) => ({
      at: new Date(Date.now() - i * 1000).toISOString(), actor: 'majid', type: 'default', summary: 'x',
    }));
    const { app } = await setup(big);
    const res = await app.inject({ method: 'GET', url: '/api/data/activity' });
    expect(res.json().events).toHaveLength(20);
  });

  it('401 when unauthed', async () => {
    const app = Fastify();
    await app.register(activityRoute, { readLog: vi.fn(), requireAuth: () => null });
    const res = await app.inject({ method: 'GET', url: '/api/data/activity' });
    expect(res.statusCode).toBe(401);
  });
});

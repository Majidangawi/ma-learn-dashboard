import { describe, it, expect, vi } from 'vitest';
import Fastify from 'fastify';
import publicRoute from '../../src/routes/public.js';

describe('POST /api/public/subscribe', () => {
  function setup(appsScript: any = { call: vi.fn().mockResolvedValue({ ok: true }) }) {
    const app = Fastify();
    return app.register(publicRoute, { appsScript, rateLimit: { max: 5, windowMs: 10 * 60_000 } }).then(() => app);
  }

  it('accepts a valid subscribe', async () => {
    const app = await setup();
    const res = await app.inject({
      method: 'POST', url: '/api/public/subscribe',
      payload: { name: 'A', email: 'a@b.com', source: 'website', language: 'EN' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it('rejects invalid email', async () => {
    const app = await setup();
    const res = await app.inject({
      method: 'POST', url: '/api/public/subscribe',
      payload: { name: 'A', email: 'notanemail', source: 'website' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('silently drops honeypot-triggered submission', async () => {
    const apps = { call: vi.fn() };
    const app = await setup(apps);
    const res = await app.inject({
      method: 'POST', url: '/api/public/subscribe',
      payload: { name: 'A', email: 'a@b.com', source: 'website', website_url: 'spam' },
    });
    expect(res.statusCode).toBe(200); // look successful to bot
    expect(apps.call).not.toHaveBeenCalled();
  });

  it('rate-limits by IP', async () => {
    const app = await setup();
    for (let i = 0; i < 5; i++) {
      await app.inject({ method: 'POST', url: '/api/public/subscribe', headers: { 'x-forwarded-for': '1.2.3.4' }, payload: { name: 'A', email: `a${i}@b.com`, source: 'website' } });
    }
    const res = await app.inject({ method: 'POST', url: '/api/public/subscribe', headers: { 'x-forwarded-for': '1.2.3.4' }, payload: { name: 'A', email: 'over@b.com', source: 'website' } });
    expect(res.statusCode).toBe(429);
  });
});

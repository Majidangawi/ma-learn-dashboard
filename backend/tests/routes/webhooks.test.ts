import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import webhooksRoute from '../../src/routes/webhooks.js';

type Call = { action: string; params: Record<string, unknown> };

interface AppsScriptLike {
  call<T>(action: string, params: Record<string, unknown>): Promise<T>;
}

interface FakeAppsScript extends AppsScriptLike {
  calls: Call[];
  callCount: number;
}

function makeAppsScript(): FakeAppsScript {
  const calls: Call[] = [];
  const fake: FakeAppsScript = {
    calls,
    callCount: 0,
    async call<T>(action: string, params: Record<string, unknown>): Promise<T> {
      fake.callCount += 1;
      calls.push({ action, params });
      return { ok: true } as T;
    },
  };
  return fake;
}

async function buildApp(appsScript: AppsScriptLike) {
  const app = Fastify();
  await app.register(webhooksRoute, { brevoSecret: 'secret123', appsScript });
  return app;
}

describe('POST /api/webhooks/brevo', () => {
  it('rejects missing/bad secret without dispatching', async () => {
    const as = makeAppsScript();
    const app = await buildApp(as);
    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/brevo',
      headers: { authorization: 'wrong' },
      payload: { event: 'delivered', email: 'a@b.com' },
    });
    expect(res.statusCode).toBe(401);
    expect(as.callCount).toBe(0);
  });

  it('accepts a single event and dispatches admin_append_newsletter_event', async () => {
    const as = makeAppsScript();
    const app = await buildApp(as);
    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/brevo',
      headers: { authorization: 'secret123' },
      payload: {
        event: 'delivered',
        email: 'a@b.com',
        tags: ['nl:nl_123'],
      },
    });
    expect(res.statusCode).toBe(200);
    expect(as.calls).toEqual([
      {
        action: 'admin_append_newsletter_event',
        params: {
          newsletterId: 'nl_123',
          email: 'a@b.com',
          event: 'delivered',
          url: '',
          userAgent: '',
        },
      },
    ]);
  });

  it('accepts an array batch and dispatches one event each', async () => {
    const as = makeAppsScript();
    const app = await buildApp(as);
    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/brevo',
      headers: { authorization: 'secret123' },
      payload: [
        { event: 'delivered', email: 'a@b.com', tags: ['nl:x'] },
        { event: 'opened', email: 'a@b.com', tags: ['nl:x'], user_agent: 'UA/1' },
        {
          event: 'clicked',
          email: 'a@b.com',
          tags: ['nl:x'],
          link: 'https://example.com/a',
        },
      ],
    });
    expect(res.statusCode).toBe(200);
    expect(as.calls.map((c) => c.action)).toEqual([
      'admin_append_newsletter_event',
      'admin_append_newsletter_event',
      'admin_append_newsletter_event',
    ]);
    expect(as.calls[1].params.userAgent).toBe('UA/1');
    expect(as.calls[2].params.url).toBe('https://example.com/a');
  });

  it('falls back to X-Newsletter-Id header field when no nl: tag is present', async () => {
    const as = makeAppsScript();
    const app = await buildApp(as);
    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/brevo',
      headers: { authorization: 'secret123' },
      payload: {
        event: 'opened',
        email: 'a@b.com',
        'X-Newsletter-Id': 'nl_header',
      },
    });
    expect(res.statusCode).toBe(200);
    expect(as.calls[0].params.newsletterId).toBe('nl_header');
  });

  it('uses url field when link is absent (clicked events)', async () => {
    const as = makeAppsScript();
    const app = await buildApp(as);
    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/brevo',
      headers: { authorization: 'secret123' },
      payload: {
        event: 'clicked',
        email: 'a@b.com',
        url: 'https://example.com/b',
      },
    });
    expect(res.statusCode).toBe(200);
    expect(as.calls[0].params.url).toBe('https://example.com/b');
  });

  it('ignores unknown events entirely', async () => {
    const as = makeAppsScript();
    const app = await buildApp(as);
    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/brevo',
      headers: { authorization: 'secret123' },
      payload: { event: 'spam', email: 'a@b.com' },
    });
    expect(res.statusCode).toBe(200);
    expect(as.callCount).toBe(0);
  });

  it('also calls admin_mark_unsubscribed on unsubscribed event', async () => {
    const as = makeAppsScript();
    const app = await buildApp(as);
    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/brevo',
      headers: { authorization: 'secret123' },
      payload: { event: 'unsubscribed', email: 'a@b.com', tags: ['nl:x'] },
    });
    expect(res.statusCode).toBe(200);
    expect(as.calls.map((c) => c.action)).toEqual([
      'admin_append_newsletter_event',
      'admin_mark_unsubscribed',
    ]);
    expect(as.calls[1].params).toEqual({ email: 'a@b.com' });
  });

  it('logs and swallows Apps Script failures (does not 500 or break batch)', async () => {
    let n = 0;
    const stub: AppsScriptLike & { callCount: number } = {
      callCount: 0,
      async call<T>(): Promise<T> {
        stub.callCount += 1;
        n += 1;
        if (n === 1) throw new Error('boom');
        return { ok: true } as T;
      },
    };
    const app = await buildApp(stub);
    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/brevo',
      headers: { authorization: 'secret123' },
      payload: [
        { event: 'delivered', email: 'a@b.com', tags: ['nl:x'] },
        { event: 'opened', email: 'a@b.com', tags: ['nl:x'] },
      ],
    });
    expect(res.statusCode).toBe(200);
    // One failed (error), then second event dispatched successfully.
    expect(stub.callCount).toBe(2);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import newslettersRoute from '../../src/routes/newsletters.js';

// Mock the data readers so the route never hits Google Sheets.
vi.mock('../../src/data/newsletters.js', () => ({
  readNewsletters: vi.fn(async () => [
    {
      newsletterId: 'NL-1', subject: 'Hello', preheader: '', language: 'AR',
      blocks: [], segmentFilter: {}, status: 'draft',
      createdAt: '', updatedAt: '', scheduledAt: '', sentAt: '',
      recipientCount: 0, deliveredCount: 0, openCount: 0, clickCount: 0,
      bounceCount: 0, unsubCount: 0, brevoCampaignId: '', idempotencyKey: '',
      createdBy: 'majid', cloneOf: '',
    },
    {
      newsletterId: 'NL-SENT', subject: 'Weekly', preheader: 'pre', language: 'EN',
      blocks: [{ type: 'text', content: 'hi' }], segmentFilter: { sources: ['buyer'] },
      status: 'sent',
      createdAt: '', updatedAt: '', scheduledAt: '', sentAt: '2026-04-15T10:00:00Z',
      recipientCount: 100, deliveredCount: 98, openCount: 40, clickCount: 12,
      bounceCount: 2, unsubCount: 1, brevoCampaignId: '', idempotencyKey: '',
      createdBy: 'majid', cloneOf: '',
    },
  ]),
}));

vi.mock('../../src/data/subscribers.js', () => ({
  readSubscribers: vi.fn(async () => [
    { email: 'a@x.com', name: 'A', sources: ['buyer'], language: 'AR',
      addedAt: '', lastSourceAt: '', status: 'active', unsubscribeToken: 't1' },
    { email: 'b@x.com', name: 'B', sources: ['waitlist'], language: 'AR',
      addedAt: '', lastSourceAt: '', status: 'active', unsubscribeToken: 't2' },
    { email: 'c@x.com', name: 'C', sources: ['waitlist'], language: 'AR',
      addedAt: '', lastSourceAt: '', status: 'unsubscribed', unsubscribeToken: 't3' },
  ]),
  countActive: vi.fn(async () => ({ total: 3, active: 2, unsubscribed: 1 })),
}));

// Don't actually send — short-circuit.
vi.mock('../../src/services/send-newsletter.js', () => ({
  sendNewsletter: vi.fn(async (_args: unknown) => ({ ok: true, sent: 2 })),
}));

vi.mock('../../src/data/newsletter-events.js', () => ({
  topClickedLinks: vi.fn(async (_id: string) => [
    { url: 'https://a.com', count: 5 },
    { url: 'https://b.com', count: 2 },
  ]),
}));

vi.mock('../../src/data/sheets-read.js', () => ({
  readSheet: vi.fn(async ({ tab }: { tab: string }) => {
    if (tab === 'NewsletterEvents') {
      return [
        { NewsletterID: 'NL-SENT', Event: 'opened', Email: 'a@x.com', URL: '' },
        { NewsletterID: 'NL-SENT', Event: 'opened', Email: 'B@x.com', URL: '' },
        { NewsletterID: 'NL-SENT', Event: 'clicked', Email: 'a@x.com', URL: 'https://a.com' },
        { NewsletterID: 'NL-OTHER', Event: 'opened', Email: 'zz@x.com', URL: '' },
      ];
    }
    return [];
  }),
  rowsToObjects: vi.fn(),
}));

function makeAppsScript() {
  const calls: { action: string; params: Record<string, unknown> }[] = [];
  async function call<T>(action: string, params: Record<string, unknown>): Promise<T> {
    calls.push({ action, params });
    if (action === 'admin_create_newsletter') return { newsletterId: 'NL-NEW' } as T;
    return { ok: true } as T;
  }
  return { calls, call };
}

async function buildApp(authedEmail: string | null) {
  const as = makeAppsScript();
  const app = Fastify();
  await app.register(newslettersRoute, {
    appsScript: as,
    requireAuth: () => authedEmail,
  });
  return { app, as };
}

describe('newsletters route — auth', () => {
  it('401s every endpoint when unauthenticated', async () => {
    const { app } = await buildApp(null);
    const endpoints: [string, string][] = [
      ['GET', '/api/data/newsletters'],
      ['GET', '/api/data/subscribers/count'],
      ['POST', '/api/data/newsletters/preview_segment'],
      ['POST', '/api/writes/newsletter/save'],
      ['POST', '/api/writes/newsletter/send_now'],
      ['POST', '/api/writes/newsletter/schedule'],
      ['POST', '/api/writes/newsletter/delete'],
      ['GET', '/api/data/newsletters/NL-1/top_clicks'],
      ['POST', '/api/writes/newsletter/clone'],
      ['POST', '/api/writes/newsletter/resend_non_openers'],
    ];
    for (const [method, url] of endpoints) {
      const res = await app.inject({ method: method as 'GET' | 'POST', url, payload: {} });
      expect(res.statusCode, `${method} ${url}`).toBe(401);
    }
  });
});

describe('GET /api/data/newsletters', () => {
  it('returns the newsletters list', async () => {
    const { app } = await buildApp('majid@x');
    const res = await app.inject({ method: 'GET', url: '/api/data/newsletters' });
    expect(res.statusCode).toBe(200);
    expect(res.json().newsletters[0].newsletterId).toBe('NL-1');
  });
});

describe('GET /api/data/subscribers/count', () => {
  it('returns total/active/unsubscribed', async () => {
    const { app } = await buildApp('majid@x');
    const res = await app.inject({ method: 'GET', url: '/api/data/subscribers/count' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ total: 3, active: 2, unsubscribed: 1 });
  });
});

describe('POST /api/data/newsletters/preview_segment', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('filters subscribers by segment', async () => {
    const { app } = await buildApp('majid@x');
    const res = await app.inject({
      method: 'POST', url: '/api/data/newsletters/preview_segment',
      payload: { sources: ['buyer'] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().count).toBe(1);
  });

  it('returns full active count on empty filter', async () => {
    const { app } = await buildApp('majid@x');
    const res = await app.inject({
      method: 'POST', url: '/api/data/newsletters/preview_segment',
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().count).toBe(2);
  });
});

describe('POST /api/writes/newsletter/save', () => {
  it('creates a new newsletter when newsletterId missing', async () => {
    const { app, as } = await buildApp('majid@x');
    const res = await app.inject({
      method: 'POST', url: '/api/writes/newsletter/save',
      payload: { subject: 'Hi', language: 'AR', blocks: [{ type: 'text', content: 'x' }] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, newsletterId: 'NL-NEW' });
    expect(as.calls[0].action).toBe('admin_create_newsletter');
    expect(as.calls[0].params.blocks).toBe(JSON.stringify([{ type: 'text', content: 'x' }]));
  });

  it('updates an existing newsletter when newsletterId provided', async () => {
    const { app, as } = await buildApp('majid@x');
    const res = await app.inject({
      method: 'POST', url: '/api/writes/newsletter/save',
      payload: { newsletterId: 'NL-7', subject: 'Edit', language: 'EN', blocks: [] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, newsletterId: 'NL-7' });
    expect(as.calls[0].action).toBe('admin_update_newsletter');
    expect(as.calls[0].params.newsletterId).toBe('NL-7');
  });

  it('400s on invalid body', async () => {
    const { app } = await buildApp('majid@x');
    const res = await app.inject({
      method: 'POST', url: '/api/writes/newsletter/save',
      payload: { subject: 'no language' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/writes/newsletter/send_now', () => {
  it('400s when newsletterId missing', async () => {
    const { app } = await buildApp('majid@x');
    const res = await app.inject({
      method: 'POST', url: '/api/writes/newsletter/send_now', payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('delegates to sendNewsletter service and returns its result', async () => {
    const { app } = await buildApp('majid@x');
    const res = await app.inject({
      method: 'POST', url: '/api/writes/newsletter/send_now',
      payload: { newsletterId: 'NL-1' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, sent: 2 });
  });
});

describe('POST /api/writes/newsletter/schedule', () => {
  it('updates + transitions status to scheduled', async () => {
    const { app, as } = await buildApp('majid@x');
    const res = await app.inject({
      method: 'POST', url: '/api/writes/newsletter/schedule',
      payload: { newsletterId: 'NL-1', sendAt: '2026-05-01T09:00:00+03:00' },
    });
    expect(res.statusCode).toBe(200);
    expect(as.calls.map(c => c.action)).toEqual(['admin_update_newsletter', 'admin_mark_newsletter_status']);
    expect(as.calls[1].params).toMatchObject({ fromStatus: 'draft', toStatus: 'scheduled' });
  });

  it('400s when fields missing', async () => {
    const { app } = await buildApp('majid@x');
    const res = await app.inject({
      method: 'POST', url: '/api/writes/newsletter/schedule',
      payload: { newsletterId: 'NL-1' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/writes/newsletter/delete', () => {
  it('marks the newsletter deleted via Apps Script', async () => {
    const { app, as } = await buildApp('majid@x');
    const res = await app.inject({
      method: 'POST', url: '/api/writes/newsletter/delete',
      payload: { newsletterId: 'NL-1' },
    });
    expect(res.statusCode).toBe(200);
    expect(as.calls[0].action).toBe('admin_mark_newsletter_status');
    expect(as.calls[0].params).toMatchObject({ newsletterId: 'NL-1', toStatus: 'deleted' });
  });
});

describe('GET /api/data/newsletters/:id/top_clicks', () => {
  it('returns the aggregator result', async () => {
    const { app } = await buildApp('majid@x');
    const res = await app.inject({
      method: 'GET', url: '/api/data/newsletters/NL-SENT/top_clicks',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      links: [
        { url: 'https://a.com', count: 5 },
        { url: 'https://b.com', count: 2 },
      ],
    });
  });
});

describe('POST /api/writes/newsletter/clone', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('400s when newsletterId missing', async () => {
    const { app } = await buildApp('majid@x');
    const res = await app.inject({
      method: 'POST', url: '/api/writes/newsletter/clone', payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('404s when source newsletter does not exist', async () => {
    const { app } = await buildApp('majid@x');
    const res = await app.inject({
      method: 'POST', url: '/api/writes/newsletter/clone',
      payload: { newsletterId: 'NL-NOPE' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('creates a new newsletter with "(Clone)" suffix and cloneOf set', async () => {
    const { app, as } = await buildApp('majid@x');
    const res = await app.inject({
      method: 'POST', url: '/api/writes/newsletter/clone',
      payload: { newsletterId: 'NL-SENT' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, newsletterId: 'NL-NEW' });
    expect(as.calls[0].action).toBe('admin_create_newsletter');
    expect(as.calls[0].params).toMatchObject({
      subject: 'Weekly (Clone)',
      preheader: 'pre',
      language: 'EN',
      cloneOf: 'NL-SENT',
    });
    // Blocks + segmentFilter are serialized
    expect(as.calls[0].params.blocks).toBe(JSON.stringify([{ type: 'text', content: 'hi' }]));
    expect(as.calls[0].params.segmentFilter).toBe(JSON.stringify({ sources: ['buyer'] }));
  });
});

describe('POST /api/writes/newsletter/resend_non_openers', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('400s when newsletterId missing', async () => {
    const { app } = await buildApp('majid@x');
    const res = await app.inject({
      method: 'POST', url: '/api/writes/newsletter/resend_non_openers', payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('404s when source newsletter does not exist', async () => {
    const { app } = await buildApp('majid@x');
    const res = await app.inject({
      method: 'POST', url: '/api/writes/newsletter/resend_non_openers',
      payload: { newsletterId: 'NL-NOPE' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('400s when the source newsletter is not in sent status', async () => {
    const { app } = await buildApp('majid@x');
    const res = await app.inject({
      method: 'POST', url: '/api/writes/newsletter/resend_non_openers',
      payload: { newsletterId: 'NL-1' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'must_be_sent' });
  });

  it('creates a draft with "(Resend)" prefix and openers folded into excludeEmails', async () => {
    const { app, as } = await buildApp('majid@x');
    const res = await app.inject({
      method: 'POST', url: '/api/writes/newsletter/resend_non_openers',
      payload: { newsletterId: 'NL-SENT' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, newsletterId: 'NL-NEW' });
    expect(as.calls[0].action).toBe('admin_create_newsletter');
    expect(as.calls[0].params).toMatchObject({
      subject: '(Resend) Weekly',
      language: 'EN',
      cloneOf: 'NL-SENT',
    });
    const filter = JSON.parse(as.calls[0].params.segmentFilter as string);
    expect(filter.sources).toEqual(['buyer']);
    // Openers mocked: a@x.com and B@x.com — both lowercased into excludeEmails.
    expect(new Set(filter.excludeEmails)).toEqual(new Set(['a@x.com', 'b@x.com']));
  });
});

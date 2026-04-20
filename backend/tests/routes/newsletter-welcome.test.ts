import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify from 'fastify';
import newsletterWelcomeRoute from '../../src/routes/newsletter-welcome.js';
import type { EmailTemplate } from '../../src/data/read-extra.js';
import type { MailProvider, SendCampaignArgs } from '../../src/mail/provider.js';

function fakeConfig(): any {
  // Only SHEET_ID is read inside the default loader path, but our tests inject
  // a templateLoader so we don't actually use it. Still, keep the shape honest.
  return { SHEET_ID: 'sheet123' };
}

function welcomeTemplate(overrides: Partial<EmailTemplate> = {}): EmailTemplate {
  return {
    templateId: 'newsletter_welcome',
    name: 'Welcome',
    subjectAR: 'أهلاً',
    subjectEN: 'Welcome to MA Learn',
    bodyAR: '',
    bodyEN: '',
    variables: ['name'],
    blocksAR: [{ type: 'heading', text: 'أهلاً {name}' }],
    blocksEN: [{ type: 'heading', text: 'Hi {name}' }],
    ...overrides,
  };
}

function fakeProvider(): MailProvider & { sent: SendCampaignArgs[] } {
  const sent: SendCampaignArgs[] = [];
  return {
    sent,
    async sendCampaign(args) {
      sent.push(args);
      return { ok: true, messageId: 'm-123' };
    },
    async upsertContact() { return { ok: true }; },
    async unsubscribeContact() { return { ok: true }; },
    async getQuota() { return { remaining: 300, dailyLimit: 300 }; },
  };
}

async function buildApp(opts: {
  templates?: EmailTemplate[];
  provider?: MailProvider;
}) {
  const app = Fastify();
  const templates = opts.templates ?? [welcomeTemplate()];
  await app.register(newsletterWelcomeRoute, {
    config: fakeConfig(),
    templateLoader: async () => templates,
    makeProvider: () => opts.provider ?? fakeProvider(),
  });
  return app;
}

describe('POST /api/writes/newsletter/send_welcome', () => {
  const origEnv = { ...process.env };
  beforeEach(() => {
    process.env.ADMIN_TOKEN = 'admin-secret';
    process.env.BREVO_API_KEY = 'brevo-key';
    process.env.BREVO_SENDER_EMAIL = 'hello@malearnsa.com';
  });
  afterEach(() => {
    process.env = { ...origEnv };
    vi.restoreAllMocks();
  });

  it('rejects missing x-admin-token', async () => {
    const app = await buildApp({});
    const res = await app.inject({
      method: 'POST',
      url: '/api/writes/newsletter/send_welcome',
      payload: { email: 'a@b.com', name: 'A', language: 'AR' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects wrong x-admin-token', async () => {
    const app = await buildApp({});
    const res = await app.inject({
      method: 'POST',
      url: '/api/writes/newsletter/send_welcome',
      headers: { 'x-admin-token': 'nope' },
      payload: { email: 'a@b.com', name: 'A', language: 'AR' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects when ADMIN_TOKEN env is unset (even if request omits header)', async () => {
    delete process.env.ADMIN_TOKEN;
    const app = await buildApp({});
    const res = await app.inject({
      method: 'POST',
      url: '/api/writes/newsletter/send_welcome',
      payload: { email: 'a@b.com' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects invalid body (bad email)', async () => {
    const app = await buildApp({});
    const res = await app.inject({
      method: 'POST',
      url: '/api/writes/newsletter/send_welcome',
      headers: { 'x-admin-token': 'admin-secret' },
      payload: { email: 'not-an-email' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('500s when newsletter_welcome template is missing', async () => {
    const app = await buildApp({ templates: [] });
    const res = await app.inject({
      method: 'POST',
      url: '/api/writes/newsletter/send_welcome',
      headers: { 'x-admin-token': 'admin-secret' },
      payload: { email: 'a@b.com', name: 'A', language: 'AR' },
    });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({ error: 'welcome_template_missing' });
  });

  it('500s when BREVO_API_KEY is unset', async () => {
    delete process.env.BREVO_API_KEY;
    const app = await buildApp({});
    const res = await app.inject({
      method: 'POST',
      url: '/api/writes/newsletter/send_welcome',
      headers: { 'x-admin-token': 'admin-secret' },
      payload: { email: 'a@b.com', name: 'A', language: 'AR' },
    });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({ error: 'brevo_not_configured' });
  });

  it('sends the AR welcome and returns messageId (language=AR)', async () => {
    const provider = fakeProvider();
    const app = await buildApp({ provider });
    const res = await app.inject({
      method: 'POST',
      url: '/api/writes/newsletter/send_welcome',
      headers: { 'x-admin-token': 'admin-secret' },
      payload: { email: 'ali@b.com', name: 'Ali', language: 'AR' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, messageId: 'm-123' });
    expect(provider.sent).toHaveLength(1);
    const s = provider.sent[0];
    expect(s.to).toEqual([{ email: 'ali@b.com', name: 'Ali' }]);
    expect(s.subject).toBe('أهلاً');
    expect(s.tags).toEqual(['welcome']);
    // Heading substitution proves blocksAR was used + {name} interpolation ran
    expect(s.htmlContent).toContain('أهلاً Ali');
  });

  it('sends the EN welcome when language=EN', async () => {
    const provider = fakeProvider();
    const app = await buildApp({ provider });
    const res = await app.inject({
      method: 'POST',
      url: '/api/writes/newsletter/send_welcome',
      headers: { 'x-admin-token': 'admin-secret' },
      payload: { email: 'b@b.com', name: 'Bob', language: 'EN' },
    });
    expect(res.statusCode).toBe(200);
    const s = provider.sent[0];
    expect(s.subject).toBe('Welcome to MA Learn');
    expect(s.htmlContent).toContain('Hi Bob');
  });

  it('defaults language to AR and name to empty when omitted', async () => {
    const provider = fakeProvider();
    const app = await buildApp({ provider });
    const res = await app.inject({
      method: 'POST',
      url: '/api/writes/newsletter/send_welcome',
      headers: { 'x-admin-token': 'admin-secret' },
      payload: { email: 'c@b.com' },
    });
    expect(res.statusCode).toBe(200);
    expect(provider.sent[0].subject).toBe('أهلاً');
    expect(provider.sent[0].to).toEqual([{ email: 'c@b.com', name: undefined }]);
  });

  it('502s when provider.sendCampaign returns ok:false', async () => {
    const provider: MailProvider = {
      async sendCampaign() { return { ok: false, error: 'brevo_429' }; },
      async upsertContact() { return { ok: true }; },
      async unsubscribeContact() { return { ok: true }; },
      async getQuota() { return { remaining: 0, dailyLimit: 300 }; },
    };
    const app = await buildApp({ provider });
    const res = await app.inject({
      method: 'POST',
      url: '/api/writes/newsletter/send_welcome',
      headers: { 'x-admin-token': 'admin-secret' },
      payload: { email: 'd@b.com', name: 'D', language: 'AR' },
    });
    expect(res.statusCode).toBe(502);
    expect(res.json()).toMatchObject({ error: 'brevo_429' });
  });

  it('falls back to default subject when template has no SubjectAR/EN', async () => {
    const provider = fakeProvider();
    const app = await buildApp({
      provider,
      templates: [welcomeTemplate({ subjectAR: '', subjectEN: '' })],
    });
    const ar = await app.inject({
      method: 'POST',
      url: '/api/writes/newsletter/send_welcome',
      headers: { 'x-admin-token': 'admin-secret' },
      payload: { email: 'e@b.com', language: 'AR' },
    });
    expect(ar.statusCode).toBe(200);
    expect(provider.sent[0].subject).toBe('أهلاً بك');

    const en = await app.inject({
      method: 'POST',
      url: '/api/writes/newsletter/send_welcome',
      headers: { 'x-admin-token': 'admin-secret' },
      payload: { email: 'f@b.com', language: 'EN' },
    });
    expect(en.statusCode).toBe(200);
    expect(provider.sent[1].subject).toBe('Welcome');
  });
});

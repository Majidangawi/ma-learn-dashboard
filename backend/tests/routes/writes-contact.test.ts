import { describe, it, expect, vi } from 'vitest';
import Fastify from 'fastify';
import writesContactRoute from '../../src/routes/writes-contact.js';

async function setup(appsScriptOverride?: any) {
  const appsScript = appsScriptOverride ?? { call: vi.fn().mockResolvedValue({ ok: true }) };
  const invalidate = vi.fn();
  const app = Fastify();
  await app.register(writesContactRoute, {
    appsScript,
    requireAuth: () => 'majid',
    invalidateCache: invalidate,
  });
  return { app, appsScript, invalidate };
}

describe('writes-contact routes', () => {
  it('POST /resend_link calls admin_resend_access_link', async () => {
    const { app, appsScript } = await setup();
    const res = await app.inject({
      method: 'POST', url: '/api/writes/contact/resend_link',
      payload: { email: 'a@x.com', product: 'creative-ai-workshop-t3' },
    });
    expect(res.statusCode).toBe(200);
    expect(appsScript.call).toHaveBeenCalledWith('admin_resend_access_link',
      expect.objectContaining({ email: 'a@x.com', product: 'creative-ai-workshop-t3' }));
  });

  it('POST /gift calls admin_gift_token + invalidates cache', async () => {
    const { app, appsScript, invalidate } = await setup();
    const res = await app.inject({
      method: 'POST', url: '/api/writes/contact/gift',
      payload: { email: 'a@x.com', product: 'intro-to-creative-ai', name: 'Alice' },
    });
    expect(res.statusCode).toBe(200);
    expect(appsScript.call).toHaveBeenCalledWith('admin_gift_token',
      expect.objectContaining({ email: 'a@x.com', product: 'intro-to-creative-ai', name: 'Alice' }));
    expect(invalidate).toHaveBeenCalled();
  });

  it('POST /delete calls admin_remove_subscriber + invalidates cache', async () => {
    const { app, appsScript, invalidate } = await setup();
    const res = await app.inject({
      method: 'POST', url: '/api/writes/contact/delete',
      payload: { email: 'a@x.com' },
    });
    expect(res.statusCode).toBe(200);
    expect(appsScript.call).toHaveBeenCalledWith('admin_remove_subscriber',
      expect.objectContaining({ email: 'a@x.com' }));
    expect(invalidate).toHaveBeenCalled();
  });

  it('surfaces apps-script errors as 400', async () => {
    const appsScript = { call: vi.fn().mockRejectedValue(new Error('apps_script_no_tokens_available')) };
    const { app } = await setup(appsScript);
    const res = await app.inject({
      method: 'POST', url: '/api/writes/contact/gift',
      payload: { email: 'a@x.com', product: 'intro-to-creative-ai' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain('no_tokens_available');
  });

  it('401 when not authed', async () => {
    const app = Fastify();
    await app.register(writesContactRoute, {
      appsScript: { call: vi.fn() },
      requireAuth: () => null,
      invalidateCache: vi.fn(),
    });
    const res = await app.inject({
      method: 'POST', url: '/api/writes/contact/delete',
      payload: { email: 'a@x.com' },
    });
    expect(res.statusCode).toBe(401);
  });
});

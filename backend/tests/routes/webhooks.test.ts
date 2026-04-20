import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import webhooksRoute from '../../src/routes/webhooks.js';

describe('POST /api/webhooks/brevo', () => {
  it('accepts a valid webhook with secret header', async () => {
    const app = Fastify();
    await app.register(webhooksRoute, { brevoSecret: 'secret123' });
    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/brevo',
      headers: { authorization: 'secret123' },
      payload: { event: 'delivered', email: 'a@b.com', 'message-id': 'm1' },
    });
    expect(res.statusCode).toBe(200);
  });

  it('rejects missing/bad secret', async () => {
    const app = Fastify();
    await app.register(webhooksRoute, { brevoSecret: 'secret123' });
    const res = await app.inject({
      method: 'POST', url: '/api/webhooks/brevo',
      headers: { authorization: 'wrong' }, payload: {}
    });
    expect(res.statusCode).toBe(401);
  });
});

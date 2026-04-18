import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../src/server.js';

let app: Awaited<ReturnType<typeof buildServer>>;

beforeAll(async () => {
  process.env.NODE_ENV = 'staging';
  process.env.ALLOWED_ADMIN_EMAIL = 'majed.engawi@gmail.com';
  process.env.JWT_SECRET = 'a'.repeat(64);
  process.env.GOOGLE_OAUTH_CLIENT_ID = 'test-client-id';
  process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'test-secret';
  process.env.BACKEND_OAUTH_CLIENT_ID = 'test';
  process.env.BACKEND_OAUTH_CLIENT_SECRET = 'test';
  process.env.BACKEND_OAUTH_REFRESH_TOKEN = 'test';
  process.env.GMAIL_SENDER = 'majid@malearnsa.com';
  app = await buildServer();
});
afterAll(async () => { await app.close(); });

describe('GET /health', () => {
  it('returns status ok and environment badge', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.environment).toBe('staging');
    expect(res.headers['x-environment']).toBe('staging');
  });
});

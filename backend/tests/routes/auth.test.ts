import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { hashPassword } from '../../src/auth/password.js';

// Mock the Google verifier BEFORE importing buildServer, so routes/auth.ts
// picks up the mock when it imports ./auth/google.js.
vi.mock('../../src/auth/google.js', () => ({
  verifyGoogleIdToken: vi.fn().mockResolvedValue({
    email: 'majed.engawi@gmail.com',
    emailVerified: true,
  }),
}));

// Dynamically import AFTER mock is set up
let buildServer: typeof import('../../src/server.js').buildServer;
let app: Awaited<ReturnType<typeof import('../../src/server.js').buildServer>>;

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
  process.env.PASSWORD_HASH = await hashPassword('hunter2');
  ({ buildServer } = await import('../../src/server.js'));
  app = await buildServer();
});
afterAll(async () => { await app.close(); });

describe('POST /auth/login', () => {
  it('issues session cookie for correct password + admin google email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { googleIdToken: 'fake-but-long-enough-to-pass-schema', password: 'hunter2' },
    });
    expect(res.statusCode).toBe(200);
    const sessionCookie = res.cookies.find((c) => c.name === 'session');
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie?.value).toBeTruthy();
  });

  it('rejects wrong password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { googleIdToken: 'fake-but-long-enough-to-pass-schema', password: 'wrong' },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/me', () => {
  it('returns 401 without session', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/me' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 200 with email when session cookie present', async () => {
    // First login to get a cookie
    const loginRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { googleIdToken: 'fake-but-long-enough-to-pass-schema', password: 'hunter2' },
    });
    const session = loginRes.cookies.find((c) => c.name === 'session')!.value;
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/me',
      cookies: { session },
    });
    expect(meRes.statusCode).toBe(200);
    expect(meRes.json().email).toBe('majed.engawi@gmail.com');
  });
});

import { describe, it, expect } from 'vitest';
import { issueSession, verifySession } from '../../src/auth/session.js';

const secret = 'a'.repeat(64);

describe('session', () => {
  it('issues a JWT that verifies with the same secret', async () => {
    const token = await issueSession(secret, { email: 'majed.engawi@gmail.com' });
    const payload = await verifySession(secret, token);
    expect(payload.email).toBe('majed.engawi@gmail.com');
  });

  it('rejects tokens with wrong secret', async () => {
    const token = await issueSession(secret, { email: 'x@y.com' });
    await expect(verifySession('b'.repeat(64), token)).rejects.toThrow();
  });
});

import { describe, it, expect } from 'vitest';
import { buildResetToken, verifyResetToken } from '../../src/auth/forgot-password.js';

const secret = 'a'.repeat(64);

describe('reset token', () => {
  it('issue and verify round-trip', async () => {
    const token = await buildResetToken(secret, 'majed.engawi@gmail.com');
    const email = await verifyResetToken(secret, token);
    expect(email).toBe('majed.engawi@gmail.com');
  });

  it('rejects expired token', async () => {
    const token = await buildResetToken(secret, 'x@y.com', 0);
    await new Promise((r) => setTimeout(r, 1100));
    await expect(verifyResetToken(secret, token)).rejects.toThrow();
  });

  it('rejects token with wrong purpose', async () => {
    // Build a token with a different purpose to test isolation
    const { SignJWT } = await import('jose');
    const wrongPurpose = await new SignJWT({ email: 'x@y.com', purpose: 'session' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(new TextEncoder().encode(secret));
    await expect(verifyResetToken(secret, wrongPurpose)).rejects.toThrow();
  });
});

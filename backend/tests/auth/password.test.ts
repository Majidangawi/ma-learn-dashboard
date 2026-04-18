import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/auth/password.js';

describe('password', () => {
  it('hash + verify round-trips', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    expect(await verifyPassword('correct-horse-battery-staple', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { createBrevoProvider } from '../../src/mail/provider.js';

describe('BrevoProvider', () => {
  it('sends a transactional email via Brevo API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ messageId: 'msg_123' }),
    });
    const p = createBrevoProvider({ apiKey: 'xkeysib-test', fetchImpl: fetchMock });
    const res = await p.sendCampaign({
      from: { name: 'Majid', email: 'hello@newsletter.malearnsa.com' },
      to: [{ email: 'a@b.com', name: 'A' }, { email: 'c@d.com', name: 'C' }],
      subject: 'Test',
      htmlContent: '<p>Hi</p>',
      headers: { 'List-Unsubscribe': '<https://x/u/abc>' },
    });
    expect(res.ok).toBe(true);
    expect(res.messageId).toBe('msg_123');
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opts] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect((opts as any).headers['api-key']).toBe('xkeysib-test');
  });

  it('returns error object on non-2xx', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false, status: 400,
      json: async () => ({ code: 'invalid_parameter', message: 'bad' }),
    });
    const p = createBrevoProvider({ apiKey: 'k', fetchImpl: fetchMock });
    const res = await p.sendCampaign({
      from: { name: 'x', email: 'x@x.com' }, to: [{ email: 'a@b.com' }], subject: 's', htmlContent: 'h'
    });
    expect(res.ok).toBe(false);
    expect(res.error).toContain('invalid_parameter');
  });
});

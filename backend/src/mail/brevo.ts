export interface BrevoRecipient { email: string; name?: string }
export interface BrevoSendArgs {
  from: { name: string; email: string };
  to: BrevoRecipient[];
  subject: string;
  htmlContent: string;
  headers?: Record<string, string>;
  tags?: string[];
}

export interface BrevoClient {
  postJson<T>(path: string, body: unknown): Promise<{ ok: boolean; status: number; data: T }>;
}

export function createBrevoClient(opts: { apiKey: string; fetchImpl?: typeof fetch }): BrevoClient {
  const f = opts.fetchImpl ?? fetch;
  return {
    async postJson<T>(path: string, body: unknown) {
      const res = await f(`https://api.brevo.com/v3${path}`, {
        method: 'POST',
        headers: {
          'api-key': opts.apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as T;
      return { ok: res.ok, status: res.status, data };
    },
  };
}

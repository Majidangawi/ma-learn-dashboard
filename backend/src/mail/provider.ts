import { createBrevoClient, BrevoRecipient } from './brevo.js';

export interface MailProvider {
  sendCampaign(args: SendCampaignArgs): Promise<SendResult>;
  upsertContact(args: { email: string; name?: string; attributes?: Record<string, string> }): Promise<UpsertResult>;
  unsubscribeContact(email: string): Promise<{ ok: boolean; error?: string }>;
  getQuota(): Promise<{ remaining: number; dailyLimit: number }>;
}

export interface SendCampaignArgs {
  from: { name: string; email: string };
  to: BrevoRecipient[];
  subject: string;
  htmlContent: string;
  headers?: Record<string, string>;
  tags?: string[];
}

export interface SendResult {
  ok: boolean;
  messageId?: string;
  brevoCampaignId?: string;
  error?: string;
}

export interface UpsertResult {
  ok: boolean;
  contactId?: number;
  error?: string;
}

export function createBrevoProvider(opts: { apiKey: string; fetchImpl?: typeof fetch }): MailProvider {
  const client = createBrevoClient(opts);
  return {
    async sendCampaign(args: SendCampaignArgs): Promise<SendResult> {
      const r = await client.postJson<{ messageId?: string; code?: string; message?: string }>(
        '/smtp/email',
        {
          sender: args.from,
          to: args.to,
          subject: args.subject,
          htmlContent: args.htmlContent,
          headers: args.headers,
          tags: args.tags,
        }
      );
      if (!r.ok) return { ok: false, error: `${r.data.code ?? r.status}: ${r.data.message ?? 'brevo_error'}` };
      return { ok: true, messageId: r.data.messageId };
    },

    async upsertContact(args): Promise<UpsertResult> {
      const r = await client.postJson<{ id?: number; code?: string; message?: string }>(
        '/contacts',
        { email: args.email, attributes: { NAME: args.name, ...(args.attributes ?? {}) }, updateEnabled: true }
      );
      if (!r.ok && r.status !== 400 /* already exists is fine */) {
        return { ok: false, error: `${r.data.code}: ${r.data.message}` };
      }
      return { ok: true, contactId: r.data.id };
    },

    async unsubscribeContact(email: string) {
      const r = await client.postJson<{ code?: string; message?: string }>(
        `/contacts/${encodeURIComponent(email)}/unsubscribe`,
        {}
      );
      if (!r.ok) return { ok: false, error: `${r.data.code}: ${r.data.message}` };
      return { ok: true };
    },

    async getQuota() {
      const r = await client.postJson<{ dailyLimit?: number; remaining?: number }>(
        '/account/quota' as any, {}
      );
      return { remaining: r.data.remaining ?? 0, dailyLimit: r.data.dailyLimit ?? 300 };
    },
  };
}

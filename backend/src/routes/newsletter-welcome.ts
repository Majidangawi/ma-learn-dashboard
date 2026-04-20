import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { Config } from '../config.js';
import { createSheetsClient } from '../data/sheets-client.js';
import { readEmailTemplates, type EmailTemplate } from '../data/read-extra.js';
import { renderBlocks, type Block } from '../mail/blocks.js';
import { createBrevoProvider, type MailProvider } from '../mail/provider.js';

/**
 * Task 25 Step 1 — backend welcome endpoint.
 *
 * Called internally by Apps Script when `_admin_upsert_subscriber` inserts a
 * new Subscribers row. Finds the `newsletter_welcome` EmailTemplate, renders
 * the blocks for the subscriber's language, and sends a one-off via Brevo.
 *
 * Auth: `x-admin-token` header must match `process.env.ADMIN_TOKEN`. This is a
 * public endpoint (no dashboard session), so the shared secret is the only gate.
 */

interface Opts {
  config: Config;
  // Override hooks used by tests — keep the real env-driven path as default.
  makeProvider?: (apiKey: string) => MailProvider;
  templateLoader?: () => Promise<EmailTemplate[]>;
}

const Body = z.object({
  email: z.string().email(),
  name: z.string().optional().default(''),
  language: z.enum(['AR', 'EN']).optional().default('AR'),
});

const newsletterWelcomeRoute: FastifyPluginAsync<Opts> = async (app, opts) => {
  app.post('/api/writes/newsletter/send_welcome', async (req, reply) => {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken || req.headers['x-admin-token'] !== adminToken) {
      return reply.code(401).send({ error: 'unauthorized' });
    }

    const parsed = Body.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
    const { email, name, language } = parsed.data;

    // Load EmailTemplates. Loader is overridable for tests so we don't need to
    // spin up a real Sheets client in unit tests.
    const templates = opts.templateLoader
      ? await opts.templateLoader()
      : await (async () => {
          if (!opts.config.SHEET_ID) throw new Error('sheet_id_missing');
          const sheets = await createSheetsClient(opts.config);
          return readEmailTemplates(sheets, opts.config.SHEET_ID);
        })();

    const welcome = templates.find((t) => t.templateId === 'newsletter_welcome');
    if (!welcome) return reply.code(500).send({ error: 'welcome_template_missing' });

    const blocks: Block[] = language === 'AR' ? welcome.blocksAR : welcome.blocksEN;
    const html = renderBlocks(blocks, language, { name: name || '' });

    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) return reply.code(500).send({ error: 'brevo_not_configured' });
    const provider = opts.makeProvider
      ? opts.makeProvider(apiKey)
      : createBrevoProvider({ apiKey });

    const subject = language === 'AR'
      ? (welcome.subjectAR || 'أهلاً بك')
      : (welcome.subjectEN || 'Welcome');

    const result = await provider.sendCampaign({
      from: {
        name: process.env.BREVO_SENDER_NAME ?? 'Majid Angawi',
        email: process.env.BREVO_SENDER_EMAIL ?? '',
      },
      to: [{ email, name: name || undefined }],
      subject,
      htmlContent: html,
      tags: ['welcome'],
    });

    if (!result.ok) return reply.code(502).send({ error: result.error ?? 'send_failed' });
    return { ok: true, messageId: result.messageId };
  });
};

export default newsletterWelcomeRoute;

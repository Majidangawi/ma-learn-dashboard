import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { readNewsletters } from '../data/newsletters.js';
import { readSubscribers, countActive } from '../data/subscribers.js';
import { applyFilter, type SegmentFilter } from '../data/segment-filter.js';
import { sendNewsletter } from '../services/send-newsletter.js';
import { topClickedLinks } from '../data/newsletter-events.js';
import { readSheet } from '../data/sheets-read.js';

interface AppsScriptLike {
  call<T>(action: string, params: Record<string, unknown>): Promise<T>;
}

export interface NewslettersOpts {
  appsScript: AppsScriptLike;
  requireAuth: (req: FastifyRequest) => string | null;
}

const UpsertBody = z.object({
  newsletterId: z.string().optional(),
  subject: z.string(),
  preheader: z.string().optional().default(''),
  language: z.enum(['AR', 'EN']),
  blocks: z.array(z.any()),
  segmentFilter: z.record(z.any()).default({}),
});

const plugin: FastifyPluginAsync<NewslettersOpts> = async (app, opts) => {
  // LIST
  app.get('/api/data/newsletters', async (req, reply) => {
    if (!opts.requireAuth(req)) return reply.code(401).send({ error: 'unauthorized' });
    return { newsletters: await readNewsletters() };
  });

  // COUNT SUBSCRIBERS
  app.get('/api/data/subscribers/count', async (req, reply) => {
    if (!opts.requireAuth(req)) return reply.code(401).send({ error: 'unauthorized' });
    return countActive();
  });

  // RECIPIENT PREVIEW
  app.post('/api/data/newsletters/preview_segment', async (req, reply) => {
    if (!opts.requireAuth(req)) return reply.code(401).send({ error: 'unauthorized' });
    const subs = await readSubscribers();
    const filtered = applyFilter(subs, (req.body ?? {}) as SegmentFilter);
    return { count: filtered.length };
  });

  // CREATE OR UPDATE draft
  app.post('/api/writes/newsletter/save', async (req, reply) => {
    if (!opts.requireAuth(req)) return reply.code(401).send({ error: 'unauthorized' });
    const parsed = UpsertBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
    const b = parsed.data;
    if (b.newsletterId) {
      await opts.appsScript.call('admin_update_newsletter', {
        newsletterId: b.newsletterId,
        subject: b.subject,
        preheader: b.preheader,
        language: b.language,
        blocks: JSON.stringify(b.blocks),
        segmentFilter: JSON.stringify(b.segmentFilter),
      });
      return { ok: true, newsletterId: b.newsletterId };
    }
    const r = await opts.appsScript.call<{ newsletterId: string }>('admin_create_newsletter', {
      subject: b.subject,
      preheader: b.preheader,
      language: b.language,
      blocks: JSON.stringify(b.blocks),
      segmentFilter: JSON.stringify(b.segmentFilter),
    });
    return { ok: true, newsletterId: r.newsletterId };
  });

  // SEND NOW
  app.post('/api/writes/newsletter/send_now', async (req, reply) => {
    if (!opts.requireAuth(req)) return reply.code(401).send({ error: 'unauthorized' });
    const { newsletterId } = (req.body ?? {}) as { newsletterId?: string };
    if (!newsletterId) return reply.code(400).send({ error: 'missing_newsletterId' });
    const result = await sendNewsletter({ newsletterId, appsScript: opts.appsScript });
    return result;
  });

  // SCHEDULE
  app.post('/api/writes/newsletter/schedule', async (req, reply) => {
    if (!opts.requireAuth(req)) return reply.code(401).send({ error: 'unauthorized' });
    const { newsletterId, sendAt } = (req.body ?? {}) as { newsletterId?: string; sendAt?: string };
    if (!newsletterId || !sendAt) return reply.code(400).send({ error: 'missing_fields' });
    await opts.appsScript.call('admin_update_newsletter', { newsletterId, scheduledAt: sendAt });
    await opts.appsScript.call('admin_mark_newsletter_status', {
      newsletterId,
      fromStatus: 'draft',
      toStatus: 'scheduled',
    });
    return { ok: true };
  });

  // DELETE
  app.post('/api/writes/newsletter/delete', async (req, reply) => {
    if (!opts.requireAuth(req)) return reply.code(401).send({ error: 'unauthorized' });
    const { newsletterId } = (req.body ?? {}) as { newsletterId?: string };
    if (!newsletterId) return reply.code(400).send({ error: 'missing_newsletterId' });
    await opts.appsScript.call('admin_mark_newsletter_status', { newsletterId, toStatus: 'deleted' });
    return { ok: true };
  });

  // TOP CLICKED LINKS — stats view aggregation
  app.get('/api/data/newsletters/:id/top_clicks', async (req, reply) => {
    if (!opts.requireAuth(req)) return reply.code(401).send({ error: 'unauthorized' });
    const id = (req.params as { id: string }).id;
    return { links: await topClickedLinks(id) };
  });

  // CLONE — copy a newsletter into a fresh draft, preserving blocks + segment.
  app.post('/api/writes/newsletter/clone', async (req, reply) => {
    if (!opts.requireAuth(req)) return reply.code(401).send({ error: 'unauthorized' });
    const { newsletterId } = (req.body ?? {}) as { newsletterId?: string };
    if (!newsletterId) return reply.code(400).send({ error: 'missing_newsletterId' });
    const nls = await readNewsletters();
    const src = nls.find(n => n.newsletterId === newsletterId);
    if (!src) return reply.code(404).send({ error: 'not_found' });
    const r = await opts.appsScript.call<{ newsletterId: string }>('admin_create_newsletter', {
      subject: `${src.subject} (Clone)`,
      preheader: src.preheader,
      language: src.language,
      blocks: JSON.stringify(src.blocks),
      segmentFilter: JSON.stringify(src.segmentFilter),
      cloneOf: src.newsletterId,
    });
    return { ok: true, newsletterId: r.newsletterId };
  });

  // RESEND TO NON-OPENERS — clone but set excludeEmails to everyone who opened.
  app.post('/api/writes/newsletter/resend_non_openers', async (req, reply) => {
    if (!opts.requireAuth(req)) return reply.code(401).send({ error: 'unauthorized' });
    const { newsletterId } = (req.body ?? {}) as { newsletterId?: string };
    if (!newsletterId) return reply.code(400).send({ error: 'missing_newsletterId' });
    const nls = await readNewsletters();
    const src = nls.find(n => n.newsletterId === newsletterId);
    if (!src) return reply.code(404).send({ error: 'not_found' });
    if (src.status !== 'sent') return reply.code(400).send({ error: 'must_be_sent' });

    const events = await readSheet({ tab: 'NewsletterEvents' });
    const openers = new Set(
      events
        .filter(e => String(e.NewsletterID ?? '') === newsletterId && String(e.Event ?? '') === 'opened')
        .map(e => String(e.Email ?? '').toLowerCase())
        .filter(Boolean),
    );
    const newFilter: SegmentFilter = { ...src.segmentFilter, excludeEmails: Array.from(openers) };

    const r = await opts.appsScript.call<{ newsletterId: string }>('admin_create_newsletter', {
      subject: `(Resend) ${src.subject}`,
      preheader: src.preheader,
      language: src.language,
      blocks: JSON.stringify(src.blocks),
      segmentFilter: JSON.stringify(newFilter),
      cloneOf: src.newsletterId,
    });
    return { ok: true, newsletterId: r.newsletterId };
  });
};

export default plugin;

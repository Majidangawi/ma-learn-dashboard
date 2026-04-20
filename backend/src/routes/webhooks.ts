import { FastifyPluginAsync } from 'fastify';

interface Opts {
  brevoSecret: string;
  appsScript: { call<T>(action: string, params: Record<string, unknown>): Promise<T> };
}

/**
 * Brevo event names we care about. Anything outside this set is ignored.
 * Reference: https://developers.brevo.com/docs/transactional-webhooks
 */
const BrevoEvents = new Set([
  'delivered',
  'opened',
  'clicked',
  'unsubscribed',
  'hard_bounce',
  'soft_bounce',
]);

const webhooksRoute: FastifyPluginAsync<Opts> = async (app, opts) => {
  app.post('/api/webhooks/brevo', async (req, reply) => {
    const auth = req.headers.authorization;
    if (auth !== opts.brevoSecret) return reply.code(401).send({ error: 'unauthorized' });

    const body = req.body as unknown;
    const events = Array.isArray(body) ? body : [body];

    for (const raw of events) {
      const ev = (raw ?? {}) as Record<string, unknown>;
      const eventName = String(ev.event ?? '');
      if (!BrevoEvents.has(eventName)) continue;

      // Newsletter ID is carried either as a tag "nl:<id>" or as a custom header.
      // Send paths tag outgoing campaigns with nl:<id> so ingestion is trivial.
      const tags = Array.isArray(ev.tags) ? (ev.tags as unknown[]) : [];
      const newsletterTag = tags.find(
        (t): t is string => typeof t === 'string' && t.startsWith('nl:'),
      );
      const headerNl = ev['X-Newsletter-Id'];
      const newsletterId =
        (newsletterTag ? newsletterTag.slice(3) : '') ||
        (typeof headerNl === 'string' ? headerNl : '') ||
        '';

      const email = typeof ev.email === 'string' ? ev.email : '';
      const url =
        (typeof ev.link === 'string' && ev.link) ||
        (typeof ev.url === 'string' && ev.url) ||
        '';
      const userAgent = typeof ev.user_agent === 'string' ? ev.user_agent : '';

      try {
        await opts.appsScript.call('admin_append_newsletter_event', {
          newsletterId,
          email,
          event: eventName,
          url,
          userAgent,
        });

        if (eventName === 'unsubscribed') {
          await opts.appsScript.call('admin_mark_unsubscribed', { email });
        }
      } catch (e) {
        // Don't 500 on a single bad event — Brevo retries the whole batch otherwise
        // and we'd double-count. Log and move on.
        app.log.error({ err: e, event: eventName, email }, 'brevo_event_dispatch_failed');
      }
    }
    return { ok: true };
  });
};

export default webhooksRoute;

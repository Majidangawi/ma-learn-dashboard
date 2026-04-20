import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

interface Opts {
  appsScript: { call<T>(action: string, params: Record<string, unknown>): Promise<T> };
  rateLimit: { max: number; windowMs: number };
}

const Body = z.object({
  name: z.string().max(120).optional(),
  email: z.string().email(),
  source: z.enum(['website', 'lib', 'buyer', 'waitlist']),
  language: z.enum(['AR', 'EN']).optional().default('AR'),
  website_url: z.string().optional(),  // honeypot
});

const publicRoute: FastifyPluginAsync<Opts> = async (app, opts) => {
  const hits = new Map<string, number[]>();

  function rateLimited(ip: string): boolean {
    const now = Date.now();
    const arr = (hits.get(ip) ?? []).filter(t => now - t < opts.rateLimit.windowMs);
    arr.push(now);
    hits.set(ip, arr);
    return arr.length > opts.rateLimit.max;
  }

  app.post('/api/public/subscribe', async (req, reply) => {
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
    const { name, email, source, language, website_url } = parsed.data;

    // Honeypot — silently drop
    if (website_url && website_url.length > 0) return { ok: true };

    const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0] ?? req.ip;
    if (rateLimited(ip)) return reply.code(429).send({ error: 'rate_limited' });

    try {
      await opts.appsScript.call('admin_upsert_subscriber', { email, name, source, language });
    } catch (e) {
      req.log.error({ e }, 'subscribe_apps_script_failed');
      // Still return ok to avoid probing; log for debugging
    }
    return { ok: true };
  });

  app.get('/api/public/unsubscribe', async (req, reply) => {
    const token = String((req.query as Record<string, unknown>).token ?? '');
    if (!token) return reply.code(400).send({ error: 'missing_token' });
    try {
      await opts.appsScript.call('admin_mark_unsubscribed', { token });
    } catch (e) {
      req.log.error({ e }, 'unsub_apps_script_failed');
    }
    return reply.type('text/html').send(renderUnsubPage());
  });
};

function renderUnsubPage(): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Unsubscribed</title>
<style>body{background:#0E0E0E;color:#eee;font-family:sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center}h1{color:#C9A84C}</style>
</head><body><div><h1>You've been unsubscribed</h1><p>We won't email you again from the MA Learn newsletter.</p></div></body></html>`;
}

export default publicRoute;

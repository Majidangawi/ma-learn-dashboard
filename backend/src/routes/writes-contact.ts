import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';

interface AppsScriptClient {
  call<T = unknown>(action: string, params: Record<string, unknown>): Promise<T>;
}

interface Opts {
  appsScript: AppsScriptClient;
  requireAuth: (req: FastifyRequest) => string | null;
  invalidateCache: () => void;
}

const ResendBody = z.object({ email: z.string().email(), product: z.string().min(1) });
const GiftBody   = z.object({ email: z.string().email(), product: z.string().min(1), name: z.string().optional(), note: z.string().optional() });
const DeleteBody = z.object({ email: z.string().email() });

const plugin: FastifyPluginAsync<Opts> = async (app, opts) => {
  app.post('/api/writes/contact/resend_link', async (req, reply) => {
    if (!opts.requireAuth(req)) return reply.code(401).send({ error: 'unauthorized' });
    const parsed = ResendBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
    try {
      const r = await opts.appsScript.call('admin_resend_access_link', parsed.data);
      return r;
    } catch (e: any) {
      return reply.code(400).send({ ok: false, error: e.message });
    }
  });

  app.post('/api/writes/contact/gift', async (req, reply) => {
    if (!opts.requireAuth(req)) return reply.code(401).send({ error: 'unauthorized' });
    const parsed = GiftBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
    try {
      const r = await opts.appsScript.call('admin_gift_token', parsed.data);
      opts.invalidateCache();
      return r;
    } catch (e: any) {
      return reply.code(400).send({ ok: false, error: e.message });
    }
  });

  app.post('/api/writes/contact/delete', async (req, reply) => {
    if (!opts.requireAuth(req)) return reply.code(401).send({ error: 'unauthorized' });
    const parsed = DeleteBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
    try {
      const r = await opts.appsScript.call('admin_remove_subscriber', parsed.data);
      opts.invalidateCache();
      return r;
    } catch (e: any) {
      return reply.code(400).send({ ok: false, error: e.message });
    }
  });
};

export default plugin;

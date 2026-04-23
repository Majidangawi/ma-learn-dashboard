import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { ActivityEvent } from '../data/audit-log.js';

interface Opts {
  readLog: () => Promise<ActivityEvent[]>;
  requireAuth: (req: FastifyRequest) => string | null;
}

const plugin: FastifyPluginAsync<Opts> = async (app, opts) => {
  app.get('/api/data/activity', async (req, reply) => {
    if (!opts.requireAuth(req)) return reply.code(401).send({ error: 'unauthorized' });
    const limit = Math.max(1, Math.min(100, Number((req.query as { limit?: string }).limit ?? 20)));
    const all = await opts.readLog();
    return { events: all.slice(0, limit) };
  });
};

export default plugin;

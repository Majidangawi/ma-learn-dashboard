import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { verifySession } from './session.js';
import type { Config } from '../config.js';

export function registerAuthGuard(app: FastifyInstance, config: Config): void {
  app.addHook('preHandler', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.url.startsWith('/api/') || req.url.startsWith('/api/public/')) return;
    const token = req.cookies['session'];
    if (!token) return reply.code(401).send({ error: 'no_session' });
    try {
      const payload = await verifySession(config.JWT_SECRET, token);
      if (payload.email !== config.ALLOWED_ADMIN_EMAIL) {
        return reply.code(403).send({ error: 'not_admin' });
      }
      (req as any).user = payload;
    } catch {
      return reply.code(401).send({ error: 'invalid_session' });
    }
  });
}

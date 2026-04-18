import type { FastifyInstance } from 'fastify';
import type { Config } from './config.js';

export function registerEnvBadge(app: FastifyInstance, config: Config): void {
  app.addHook('onSend', async (_req, reply, payload) => {
    reply.header('X-Environment', config.NODE_ENV);
    return payload;
  });
}

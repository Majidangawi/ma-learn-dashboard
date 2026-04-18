import type { FastifyInstance } from 'fastify';
import type { Config } from '../config.js';

export async function healthRoutes(app: FastifyInstance, config: Config): Promise<void> {
  app.get('/health', async () => ({ status: 'ok', environment: config.NODE_ENV }));
}

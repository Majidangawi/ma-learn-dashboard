import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import { loadConfig } from './config.js';
import { registerEnvBadge } from './env-badge.js';
import { healthRoutes } from './routes/health.js';

export async function buildServer() {
  const config = loadConfig();
  const app = Fastify({ logger: { level: 'info' } });

  await app.register(cookie, { secret: config.JWT_SECRET });
  await app.register(cors, { origin: config.FRONTEND_ORIGIN, credentials: true });

  registerEnvBadge(app, config);
  await healthRoutes(app, config);

  return app;
}

const isDirectRun = import.meta.url === `file://${process.argv[1]}`;
if (isDirectRun) {
  const app = await buildServer();
  const port = Number(process.env.PORT ?? 3400);
  await app.listen({ port, host: '0.0.0.0' });
  app.log.info(`listening on ${port} in ${process.env.NODE_ENV} mode`);
}

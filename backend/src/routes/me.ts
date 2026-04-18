import type { FastifyInstance } from 'fastify';

export async function meRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/me', async (req) => {
    const user = (req as any).user as { email: string };
    return { email: user.email };
  });
}

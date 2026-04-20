import { FastifyPluginAsync } from 'fastify';

interface Opts { brevoSecret: string }

const webhooksRoute: FastifyPluginAsync<Opts> = async (app, opts) => {
  app.post('/api/webhooks/brevo', async (req, reply) => {
    const auth = req.headers.authorization;
    if (auth !== opts.brevoSecret) return reply.code(401).send({ error: 'unauthorized' });
    // Full event ingestion wired in Task 22.
    app.log.info({ body: req.body }, 'brevo_webhook_received');
    return { ok: true };
  });
};

export default webhooksRoute;

import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { computeHomeKpis } from '../data/home-kpis.js';
import type { Token } from '../data/read-extra.js';
import type { Customer } from '../data/sheets-read.js';

interface Opts {
  readTokens: () => Promise<Token[]>;
  readCustomers: () => Promise<Customer[]>;
  requireAuth: (req: FastifyRequest) => string | null;
}

const plugin: FastifyPluginAsync<Opts> = async (app, opts) => {
  app.get('/api/data/home-kpis', async (req, reply) => {
    if (!opts.requireAuth(req)) return reply.code(401).send({ error: 'unauthorized' });
    const [tokens, customers] = await Promise.all([opts.readTokens(), opts.readCustomers()]);
    return computeHomeKpis(tokens, customers);
  });
};

export default plugin;

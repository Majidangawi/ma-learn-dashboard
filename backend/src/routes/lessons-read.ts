import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { readCourses, readLessonContentById } from '../data/lessons.js';

interface Opts {
  requireAuth: (req: FastifyRequest) => string | null;
}

const plugin: FastifyPluginAsync<Opts> = async (app, opts) => {
  app.get('/api/data/lessons/courses', async (req, reply) => {
    if (!opts.requireAuth(req)) return reply.code(401).send({ error: 'unauthorized' });
    return { courses: await readCourses() };
  });

  app.get('/api/data/lessons/:id/content', async (req, reply) => {
    if (!opts.requireAuth(req)) return reply.code(401).send({ error: 'unauthorized' });
    const id = (req.params as { id: string }).id;
    return await readLessonContentById(id);
  });
};

export default plugin;

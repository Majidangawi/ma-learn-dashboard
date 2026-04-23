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

const SaveMediaBody = z.object({
  lessonId: z.string().min(1),
  videoId:  z.string().optional(),
  pdfUrl:   z.string().optional(),
  active:   z.boolean().optional(),
});
const SaveContentBody = z.object({
  lessonId: z.string().min(1),
  blocks:   z.array(z.any()),
  html:     z.string(),
});
const AddBody = z.object({
  course:       z.string().min(1),
  module:       z.string().min(1),
  module_order: z.number().int().min(1),
  lesson_order: z.number().int().min(1),
  title:        z.string().min(1),
  desc:         z.string().optional(),
});
const DeleteBody   = z.object({ lessonId: z.string().min(1) });
const ReorderBody  = z.object({
  lessonId:    z.string().min(1),
  moduleOrder: z.number().int().min(1),
  lessonOrder: z.number().int().min(1),
});

const plugin: FastifyPluginAsync<Opts> = async (app, opts) => {
  function authed(req: FastifyRequest, reply: any): boolean {
    if (!opts.requireAuth(req)) { reply.code(401).send({ error: 'unauthorized' }); return false; }
    return true;
  }
  async function forward<T>(action: string, params: Record<string, unknown>, reply: any, invalidate: boolean) {
    try {
      const r = await opts.appsScript.call(action, params);
      if (invalidate) opts.invalidateCache();
      return r as T;
    } catch (e: any) {
      return reply.code(400).send({ ok: false, error: e.message });
    }
  }

  app.post('/api/writes/lesson/save_media', async (req, reply) => {
    if (!authed(req, reply)) return;
    const parsed = SaveMediaBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
    const p = parsed.data;
    const params: Record<string, unknown> = { lesson_id: p.lessonId };
    if (p.videoId !== undefined) params.video_id = p.videoId;
    if (p.pdfUrl  !== undefined) params.pdf_url  = p.pdfUrl;
    if (p.active  !== undefined) params.active   = p.active ? 'true' : 'false';
    return forward('save_lesson_media', params, reply, true);
  });

  app.post('/api/writes/lesson/save_content', async (req, reply) => {
    if (!authed(req, reply)) return;
    const parsed = SaveContentBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
    const p = parsed.data;
    return forward('save_content', {
      lesson_id: p.lessonId,
      content: p.html,
      blocks: JSON.stringify(p.blocks),
    }, reply, true);
  });

  app.post('/api/writes/lesson/add', async (req, reply) => {
    if (!authed(req, reply)) return;
    const parsed = AddBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
    return forward('add_lesson', parsed.data, reply, true);
  });

  app.post('/api/writes/lesson/delete', async (req, reply) => {
    if (!authed(req, reply)) return;
    const parsed = DeleteBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
    return forward('delete_lesson', { lesson_id: parsed.data.lessonId }, reply, true);
  });

  app.post('/api/writes/lesson/reorder', async (req, reply) => {
    if (!authed(req, reply)) return;
    const parsed = ReorderBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
    return forward('admin_reorder_lessons', parsed.data, reply, true);
  });
};

export default plugin;

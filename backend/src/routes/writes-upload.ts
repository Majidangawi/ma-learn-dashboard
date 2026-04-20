import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';

export interface DriveClient {
  upload(args: { filename: string; contentType: string; data: Buffer }): Promise<{ url: string }>;
}

export interface WritesUploadOpts {
  drive: DriveClient;
  /** Returns an identifier (e.g. userId/email) when authenticated, else null. */
  requireAuth: (req: FastifyRequest) => string | null;
}

const Body = z.object({
  filename: z.string().min(1).max(200),
  contentType: z.string().min(1),
  dataBase64: z.string().min(1),
});

const MAX_BYTES = 5_000_000;

const plugin: FastifyPluginAsync<WritesUploadOpts> = async (app, opts) => {
  app.post('/api/writes/upload_email_image', async (req, reply) => {
    const user = opts.requireAuth(req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });

    const parsed = Body.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_body' });
    const { filename, contentType, dataBase64 } = parsed.data;

    const buf = Buffer.from(dataBase64, 'base64');
    if (buf.length === 0) return reply.code(400).send({ error: 'invalid_body' });
    if (buf.length > MAX_BYTES) return reply.code(413).send({ error: 'file_too_large' });

    const r = await opts.drive.upload({ filename, contentType, data: buf });
    return { url: r.url };
  });
};

export default plugin;

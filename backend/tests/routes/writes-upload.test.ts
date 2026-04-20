import { describe, it, expect, vi } from 'vitest';
import Fastify from 'fastify';
import writesUpload from '../../src/routes/writes-upload.js';

describe('POST /api/writes/upload_email_image', () => {
  it('returns a URL on success', async () => {
    const driveMock = { upload: vi.fn().mockResolvedValue({ url: 'https://drive/pub/x.jpg' }) };
    const app = Fastify();
    await app.register(writesUpload, { drive: driveMock, requireAuth: () => 'majid' });
    const res = await app.inject({
      method: 'POST', url: '/api/writes/upload_email_image',
      payload: { filename: 'x.jpg', contentType: 'image/jpeg', dataBase64: 'AAA=' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().url).toContain('drive');
    expect(driveMock.upload).toHaveBeenCalledOnce();
  });

  it('returns 401 when unauthenticated', async () => {
    const driveMock = { upload: vi.fn() };
    const app = Fastify();
    await app.register(writesUpload, { drive: driveMock, requireAuth: () => null });
    const res = await app.inject({
      method: 'POST', url: '/api/writes/upload_email_image',
      payload: { filename: 'x.jpg', contentType: 'image/jpeg', dataBase64: 'AAA=' },
    });
    expect(res.statusCode).toBe(401);
    expect(driveMock.upload).not.toHaveBeenCalled();
  });

  it('returns 400 on invalid body', async () => {
    const driveMock = { upload: vi.fn() };
    const app = Fastify();
    await app.register(writesUpload, { drive: driveMock, requireAuth: () => 'majid' });
    const res = await app.inject({
      method: 'POST', url: '/api/writes/upload_email_image',
      payload: { filename: '' },
    });
    expect(res.statusCode).toBe(400);
    expect(driveMock.upload).not.toHaveBeenCalled();
  });

  it('returns 413 when decoded file is larger than 8 MB', async () => {
    const driveMock = { upload: vi.fn() };
    const app = Fastify({ bodyLimit: 20_000_000 });
    await app.register(writesUpload, { drive: driveMock, requireAuth: () => 'majid' });
    // Allocate a buffer > 8MB then encode to base64.
    const big = Buffer.alloc(8_000_001, 0x41).toString('base64');
    const res = await app.inject({
      method: 'POST', url: '/api/writes/upload_email_image',
      payload: { filename: 'big.jpg', contentType: 'image/jpeg', dataBase64: big },
    });
    expect(res.statusCode).toBe(413);
    expect(driveMock.upload).not.toHaveBeenCalled();
  });
});

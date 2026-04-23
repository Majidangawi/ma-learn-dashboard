import { describe, it, expect, vi } from 'vitest';
import Fastify from 'fastify';
import writesLessonRoute from '../../src/routes/writes-lesson.js';

async function setup(appsScriptOverride?: any) {
  const appsScript = appsScriptOverride ?? { call: vi.fn().mockResolvedValue({ ok: true, success: true }) };
  const invalidate = vi.fn();
  const app = Fastify();
  await app.register(writesLessonRoute, {
    appsScript,
    requireAuth: () => 'majid',
    invalidateCache: invalidate,
  });
  return { app, appsScript, invalidate };
}

describe('writes-lesson routes', () => {
  it('POST /save_media passes through to save_lesson_media', async () => {
    const { app, appsScript } = await setup();
    const res = await app.inject({
      method: 'POST', url: '/api/writes/lesson/save_media',
      payload: { lessonId: 't2-01', videoId: 'abc123', pdfUrl: 'https://x', active: true },
    });
    expect(res.statusCode).toBe(200);
    expect(appsScript.call).toHaveBeenCalledWith('save_lesson_media',
      expect.objectContaining({ lesson_id: 't2-01', video_id: 'abc123', pdf_url: 'https://x', active: 'true' }));
  });

  it('POST /save_content passes through to save_content + invalidates cache', async () => {
    const { app, appsScript, invalidate } = await setup();
    const res = await app.inject({
      method: 'POST', url: '/api/writes/lesson/save_content',
      payload: { lessonId: 't2-01', blocks: [{ type: 'text', content: 'hi' }], html: '<p>hi</p>' },
    });
    expect(res.statusCode).toBe(200);
    expect(appsScript.call).toHaveBeenCalledWith('save_content',
      expect.objectContaining({ lesson_id: 't2-01', content: '<p>hi</p>', blocks: '[{"type":"text","content":"hi"}]' }));
    expect(invalidate).toHaveBeenCalled();
  });

  it('POST /add invokes add_lesson', async () => {
    const { app, appsScript } = await setup({ call: vi.fn().mockResolvedValue({ success: true, id: 'lesson-xyz' }) });
    const res = await app.inject({
      method: 'POST', url: '/api/writes/lesson/add',
      payload: { course: 'intro-to-creative-ai', module: 'Module 1', module_order: 1, lesson_order: 10, title: 'New' },
    });
    expect(res.statusCode).toBe(200);
    expect(appsScript.call).toHaveBeenCalledWith('add_lesson', expect.objectContaining({ course: 'intro-to-creative-ai', title: 'New' }));
  });

  it('POST /delete invokes delete_lesson + invalidates', async () => {
    const { app, appsScript, invalidate } = await setup();
    const res = await app.inject({
      method: 'POST', url: '/api/writes/lesson/delete',
      payload: { lessonId: 't2-01' },
    });
    expect(res.statusCode).toBe(200);
    expect(appsScript.call).toHaveBeenCalledWith('delete_lesson', expect.objectContaining({ lesson_id: 't2-01' }));
    expect(invalidate).toHaveBeenCalled();
  });

  it('POST /reorder invokes admin_reorder_lessons + invalidates', async () => {
    const { app, appsScript, invalidate } = await setup();
    const res = await app.inject({
      method: 'POST', url: '/api/writes/lesson/reorder',
      payload: { lessonId: 't2-01', moduleOrder: 2, lessonOrder: 3 },
    });
    expect(res.statusCode).toBe(200);
    expect(appsScript.call).toHaveBeenCalledWith('admin_reorder_lessons',
      expect.objectContaining({ lessonId: 't2-01', moduleOrder: 2, lessonOrder: 3 }));
    expect(invalidate).toHaveBeenCalled();
  });

  it('surfaces Apps Script errors as 400', async () => {
    const { app } = await setup({ call: vi.fn().mockRejectedValue(new Error('apps_script_lesson_not_found')) });
    const res = await app.inject({
      method: 'POST', url: '/api/writes/lesson/delete', payload: { lessonId: 'nope' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('401 when not authed', async () => {
    const app = Fastify();
    await app.register(writesLessonRoute, {
      appsScript: { call: vi.fn() },
      requireAuth: () => null,
      invalidateCache: vi.fn(),
    });
    const res = await app.inject({
      method: 'POST', url: '/api/writes/lesson/save_media', payload: { lessonId: 't2-01' },
    });
    expect(res.statusCode).toBe(401);
  });
});

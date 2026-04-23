import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import lessonsReadRoute from '../../src/routes/lessons-read.js';
import * as lessonsData from '../../src/data/lessons.js';

describe('lessons-read routes', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  async function setup(authOk = true) {
    vi.spyOn(lessonsData, 'readCourses').mockResolvedValue([
      { id: 'intro-to-creative-ai', label: 'T2', lessonCount: 19 },
    ] as any);
    vi.spyOn(lessonsData, 'readLessonContentById').mockImplementation(async (id) =>
      id === 't2-01'
        ? { blocks: [{ type: 'text', content: 'hi' }], html: '<p>hi</p>' } as any
        : { blocks: [], html: '' } as any
    );
    const app = Fastify();
    await app.register(lessonsReadRoute, { requireAuth: () => (authOk ? 'majid' : null) });
    return app;
  }

  it('GET /api/data/lessons/courses returns course list', async () => {
    const app = await setup();
    const res = await app.inject({ method: 'GET', url: '/api/data/lessons/courses' });
    expect(res.statusCode).toBe(200);
    expect(res.json().courses).toHaveLength(1);
    expect(res.json().courses[0].label).toBe('T2');
  });

  it('GET /api/data/lessons/:id/content returns blocks + html', async () => {
    const app = await setup();
    const res = await app.inject({ method: 'GET', url: '/api/data/lessons/t2-01/content' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ blocks: expect.any(Array), html: '<p>hi</p>' });
  });

  it('401 without auth', async () => {
    const app = await setup(false);
    const res = await app.inject({ method: 'GET', url: '/api/data/lessons/courses' });
    expect(res.statusCode).toBe(401);
  });
});

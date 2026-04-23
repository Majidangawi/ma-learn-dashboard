import { describe, it, expect } from 'vitest';
import { deriveCourses, parseLessonContent } from '../../src/data/lessons.js';

describe('deriveCourses', () => {
  it('produces one course entry per distinct course with lesson counts', () => {
    const rows = [
      { Course: 'intro-to-creative-ai',  Active: 'TRUE' },
      { Course: 'intro-to-creative-ai',  Active: 'TRUE' },
      { Course: 'beyond-lighting',       Active: 'FALSE' },
    ];
    const courses = deriveCourses(rows);
    expect(courses).toHaveLength(2);
    const t2 = courses.find(c => c.id === 'intro-to-creative-ai')!;
    expect(t2.lessonCount).toBe(2);
    const bl = courses.find(c => c.id === 'beyond-lighting')!;
    expect(bl.lessonCount).toBe(1);
  });

  it('ignores rows with empty Course', () => {
    const rows = [{ Course: '', Active: 'TRUE' }, { Course: '  ', Active: 'TRUE' }];
    expect(deriveCourses(rows)).toEqual([]);
  });

  it('labels known courses; falls back to the id otherwise', () => {
    const rows = [
      { Course: 'intro-to-creative-ai', Active: 'TRUE' },
      { Course: 'unknown-future', Active: 'TRUE' },
    ];
    const courses = deriveCourses(rows);
    expect(courses.find(c => c.id === 'intro-to-creative-ai')!.label).toBe('T2');
    expect(courses.find(c => c.id === 'unknown-future')!.label).toBe('unknown-future');
  });
});

describe('parseLessonContent', () => {
  it('prefers Blocks JSON when present', () => {
    const result = parseLessonContent({
      'Lesson ID': 't2-01',
      Content: '<p>old html</p>',
      Blocks: '[{"type":"text","content":"rich"}]',
    });
    expect(result.blocks).toEqual([{ type: 'text', content: 'rich' }]);
    expect(result.html).toBe('<p>old html</p>');
  });

  it('falls back to a single Text block wrapping raw HTML when Blocks is absent', () => {
    const result = parseLessonContent({
      'Lesson ID': 't2-01', Content: '<p>legacy content</p>', Blocks: '',
    });
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].type).toBe('text');
    expect(result.html).toBe('<p>legacy content</p>');
  });

  it('returns empty blocks + empty html for a missing lesson', () => {
    const result = parseLessonContent(undefined);
    expect(result.blocks).toEqual([]);
    expect(result.html).toBe('');
  });
});

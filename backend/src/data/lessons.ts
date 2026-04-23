import { readSheet } from './sheets-read.js';

export interface Course {
  id: string;
  label: string;
  lessonCount: number;
}

export interface LessonContent {
  blocks: any[];
  html: string;
}

const COURSE_LABELS: Record<string, string> = {
  'intro-to-creative-ai':    'ITCAI',
  'creative-ai-workshop-t3': 'Creative AI Workshop',
  'beyond-lighting':         'BL',
  'prompt-pack':             'Prompt Pack',
};

export function deriveCourses(rows: Record<string, unknown>[]): Course[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const c = String(r.Course ?? '').trim();
    if (!c) continue;
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([id, lessonCount]) => ({
    id,
    label: COURSE_LABELS[id] ?? id,
    lessonCount,
  }));
}

export function parseLessonContent(row: Record<string, unknown> | undefined): LessonContent {
  if (!row) return { blocks: [], html: '' };
  const html = String(row.Content ?? '');
  const blocksRaw = String(row.Blocks ?? '').trim();
  if (blocksRaw) {
    try {
      const parsed = JSON.parse(blocksRaw);
      if (Array.isArray(parsed)) return { blocks: parsed, html };
    } catch { /* fall through */ }
  }
  // Legacy fallback: one Text block with the raw HTML.
  return { blocks: [{ type: 'text', content: html }], html };
}

let listCache: { at: number; rows: Record<string, unknown>[] } | null = null;
const TTL_MS = 30_000;

async function readLessonsRaw(): Promise<Record<string, unknown>[]> {
  if (listCache && Date.now() - listCache.at < TTL_MS) return listCache.rows;
  const rows = await readSheet({ tab: 'Lessons' });
  listCache = { at: Date.now(), rows };
  return rows;
}

export async function readCourses(): Promise<Course[]> {
  const rows = await readLessonsRaw();
  return deriveCourses(rows);
}

export async function readLessonContentById(lessonId: string): Promise<LessonContent> {
  const rows = await readSheet({ tab: 'LessonContent' });
  const row = rows.find(r => String(r['Lesson ID']).trim() === lessonId);
  return parseLessonContent(row);
}

export function invalidateLessonsCache(): void {
  listCache = null;
}

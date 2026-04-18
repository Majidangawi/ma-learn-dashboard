import type { SheetsClient } from './sheets-client.js';

export interface ToggleUpdate {
  range: string;
  value: string;
}

/**
 * Given the full 2D rows array of the Lessons tab, compute the A1 range
 * and value needed to toggle a single lesson's Active cell. Pure function —
 * no side effects, easy to unit test.
 */
export function buildToggleLessonUpdate(
  rows: string[][],
  lessonId: string,
  active: boolean,
): ToggleUpdate {
  if (rows.length < 1) throw new Error('Lessons sheet is empty');
  const header = rows[0];
  const idCol = header.indexOf('LessonID');
  const activeCol = header.indexOf('Active');
  if (idCol === -1) throw new Error('LessonID column missing');
  if (activeCol === -1) throw new Error('Active column missing');

  for (let r = 1; r < rows.length; r++) {
    if (rows[r][idCol] === lessonId) {
      const colLetter = String.fromCharCode(65 + activeCol);
      return { range: `Lessons!${colLetter}${r + 1}`, value: active ? 'TRUE' : 'FALSE' };
    }
  }
  throw new Error(`Lesson ${lessonId} not found`);
}

/**
 * Async wrapper that reads the Lessons tab, computes the update via
 * buildToggleLessonUpdate, and writes it back. Returns the update that
 * was applied so the caller can log it in the audit trail.
 */
export async function toggleLessonActive(
  sheets: SheetsClient,
  sheetId: string,
  lessonId: string,
  active: boolean,
): Promise<ToggleUpdate> {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Lessons' });
  const rows = (res.data.values ?? []) as string[][];
  const update = buildToggleLessonUpdate(rows, lessonId, active);
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: update.range,
    valueInputOption: 'RAW',
    requestBody: { values: [[update.value]] },
  });
  return update;
}

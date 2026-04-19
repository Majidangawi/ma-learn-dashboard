import { describe, it, expect } from 'vitest';
import { buildToggleLessonUpdate } from '../../src/data/sheets-write.js';

describe('buildToggleLessonUpdate', () => {
  it('produces an A1 range and the new value for the Active column (active=true)', () => {
    const header = ['LessonID', 'Course', 'Module', 'Title', 'Active', 'Order'];
    const rows = [header, ['L1', 't3', 'M3', 'Intro', 'FALSE', '1']];
    const result = buildToggleLessonUpdate(rows, 'L1', true);
    expect(result).toEqual({ range: 'Lessons!E2', value: 'TRUE' });
  });

  it('produces FALSE when active=false', () => {
    const rows = [
      ['LessonID', 'Active'],
      ['L1', 'TRUE'],
    ];
    expect(buildToggleLessonUpdate(rows, 'L1', false)).toEqual({ range: 'Lessons!B2', value: 'FALSE' });
  });

  it('finds the correct row when lesson is not first', () => {
    const rows = [
      ['LessonID', 'Active'],
      ['L1', 'FALSE'],
      ['L2', 'FALSE'],
      ['L3', 'FALSE'],
    ];
    expect(buildToggleLessonUpdate(rows, 'L3', true)).toEqual({ range: 'Lessons!B4', value: 'TRUE' });
  });

  it('throws if lesson not found', () => {
    const header = ['LessonID', 'Active'];
    expect(() => buildToggleLessonUpdate([header], 'MISSING', true)).toThrow(/not found/);
  });

  it('throws if Active column missing', () => {
    const rows = [['LessonID'], ['L1']];
    expect(() => buildToggleLessonUpdate(rows, 'L1', true)).toThrow(/Active column/);
  });

  it('throws if LessonID column missing', () => {
    const rows = [['Active'], ['TRUE']];
    expect(() => buildToggleLessonUpdate(rows, 'L1', true)).toThrow(/LessonID\/ID column/);
  });

  it('throws if sheet is empty', () => {
    expect(() => buildToggleLessonUpdate([], 'L1', true)).toThrow(/empty/);
  });
});

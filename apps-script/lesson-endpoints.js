/**
 * Lesson admin endpoints — REFERENCE COPY.
 *
 * Source of truth: MA EA repo at
 *   projects/ma-learn-launch/apps-script/token-validator/Code.js
 *
 * The live Apps Script (deploy id AKfycbznjcsYu8gLDZqFJG...) is maintained
 * from that file — this file is only for code review / documentation.
 * Do NOT edit here and expect production to change; push via clasp from
 * the MA EA repo instead.
 *
 * Endpoints covered:
 *   - admin_reorder_lessons  (new, 2026-04-23)
 *   - saveLessonContent      (upgraded 2026-04-23 to also write Blocks col)
 */

// ═════════════════════════════════════════════════════════════════════
// LESSONS — reorder endpoint (2026-04-23 rollout)
// ═════════════════════════════════════════════════════════════════════

function _admin_reorder_lessons(p) {
  if (p.admin_token !== ADMIN_TOKEN) return { ok: false, error: 'unauthorized' };
  var lessonId = String(p.lessonId || '').trim();
  var moduleOrder = Number(p.moduleOrder);
  var lessonOrder = Number(p.lessonOrder);
  if (!lessonId || !Number.isFinite(moduleOrder) || !Number.isFinite(lessonOrder)) {
    return { ok: false, error: 'missing_params' };
  }
  var ss = SpreadsheetApp.openById(MAIN_SHEET_ID);
  var sh = ss.getSheetByName(LESSONS_SHEET);
  if (!sh) return { ok: false, error: 'no_lessons_sheet' };
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === lessonId) {
      sh.getRange(i + 1, 4).setValue(moduleOrder); // D = Module Order
      sh.getRange(i + 1, 5).setValue(lessonOrder); // E = Lesson Order
      return { ok: true, lessonId: lessonId, moduleOrder: moduleOrder, lessonOrder: lessonOrder };
    }
  }
  return { ok: false, error: 'lesson_not_found' };
}

// ═════════════════════════════════════════════════════════════════════
// LESSONS — saveLessonContent (now writes Blocks col alongside Content)
// ═════════════════════════════════════════════════════════════════════

function saveLessonContent(params) {
  if ((params.admin_token || '') !== ADMIN_TOKEN) return { success: false, reason: 'unauthorized' };
  const lessonId = String(params.lesson_id || '').trim();
  const content  = String(params.content  || '');
  const blocks   = String(params.blocks   || '');
  if (!lessonId) return { success: false, reason: 'no_lesson_id' };

  const ss    = SpreadsheetApp.openById(MAIN_SHEET_ID);
  const sheet = ss.getSheetByName(LESSON_CONTENT_SHEET);
  if (!sheet) return { success: false, reason: 'no_content_sheet' };

  // Header-map lookup so Blocks col position is tolerant.
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const headerIdx = {};
  header.forEach(function (h, i) { headerIdx[String(h).trim()] = i + 1; });
  const contentCol = headerIdx['Content'] || 2;
  const blocksCol  = headerIdx['Blocks']  || 0;

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === lessonId) {
      sheet.getRange(i + 1, contentCol).setValue(content);
      if (blocksCol > 0 && blocks) sheet.getRange(i + 1, blocksCol).setValue(blocks);
      return { success: true };
    }
  }

  const row = new Array(header.length).fill('');
  row[0] = lessonId;
  row[contentCol - 1] = content;
  if (blocksCol > 0) row[blocksCol - 1] = blocks;
  sheet.appendRow(row);
  return { success: true };
}

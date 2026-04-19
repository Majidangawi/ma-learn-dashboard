/**
 * MA Learn Dashboard — Admin endpoints (appended to token-validator/Code.js).
 *
 * Every action here requires `admin_token` in the request body to match the
 * ADMIN_TOKEN constant already defined in Code.js. Rotate ADMIN_TOKEN if
 * suspected compromised — it's the sole gate on all write operations.
 */

function adminToggleLesson(params) {
  if (params.admin_token !== ADMIN_TOKEN) return { ok: false, error: 'unauthorized' };
  const lessonId = String(params.lesson_id || '');
  const active = String(params.active || '').toUpperCase() === 'TRUE';
  if (!lessonId) return { ok: false, error: 'lesson_id required' };

  const ss = SpreadsheetApp.openById(MAIN_SHEET_ID);
  const sh = ss.getSheetByName(LESSONS_SHEET);
  const data = sh.getDataRange().getValues();
  const header = data[0];
  const iId = header.indexOf('LessonID');
  const iActive = header.indexOf('Active');
  if (iId === -1 || iActive === -1) return { ok: false, error: 'schema mismatch' };

  for (let r = 1; r < data.length; r++) {
    if (String(data[r][iId]) === lessonId) {
      sh.getRange(r + 1, iActive + 1).setValue(active ? 'TRUE' : 'FALSE');
      return { ok: true, lessonId: lessonId, active: active, row: r + 1 };
    }
  }
  return { ok: false, error: 'lesson_not_found' };
}

function adminCreateCoupon(params) {
  if (params.admin_token !== ADMIN_TOKEN) return { ok: false, error: 'unauthorized' };
  const code = String(params.code || '').toUpperCase().trim();
  if (!code) return { ok: false, error: 'code required' };

  const ss = SpreadsheetApp.openById(MAIN_SHEET_ID);
  const sh = ss.getSheetByName(COUPONS_SHEET);
  const data = sh.getDataRange().getValues();
  for (let r = 1; r < data.length; r++) {
    if (String(data[r][0]).toUpperCase().trim() === code) {
      return { ok: false, error: 'code_exists' };
    }
  }
  const row = [
    code,
    String(params.type || 'percentage'),
    Number(params.value || 0),
    Number(params.min_sar || 0),
    params.uses_left === '' ? '' : Number(params.uses_left),
    params.start_date || '',
    params.end_date || '',
    'TRUE',
    String(params.products || 'all'),
    new Date().toISOString(),
    String(params.created_by || 'majid'),
    '',
  ];
  sh.appendRow(row);
  return { ok: true, code: code, row: row };
}

function adminUpdateCoupon(params) {
  if (params.admin_token !== ADMIN_TOKEN) return { ok: false, error: 'unauthorized' };
  const code = String(params.code || '').toUpperCase().trim();
  const ss = SpreadsheetApp.openById(MAIN_SHEET_ID);
  const sh = ss.getSheetByName(COUPONS_SHEET);
  const data = sh.getDataRange().getValues();
  const allowed = ['value', 'min_sar', 'uses_left', 'start_date', 'end_date', 'active', 'products'];
  const map = { value: 3, min_sar: 4, uses_left: 5, start_date: 6, end_date: 7, active: 8, products: 9 };
  for (let r = 1; r < data.length; r++) {
    if (String(data[r][0]).toUpperCase().trim() === code) {
      allowed.forEach(function (k) {
        if (params[k] !== undefined) {
          var v;
          if (k === 'active') v = String(params[k]).toUpperCase();
          else if (k === 'value' || k === 'min_sar') v = Number(params[k]);
          else if (k === 'uses_left' && params[k] !== '') v = Number(params[k]);
          else v = params[k];
          sh.getRange(r + 1, map[k]).setValue(v);
        }
      });
      return { ok: true, code: code };
    }
  }
  return { ok: false, error: 'code_not_found' };
}

function adminAddLinkbio(params) {
  if (params.admin_token !== ADMIN_TOKEN) return { ok: false, error: 'unauthorized' };
  const ss = SpreadsheetApp.openById(MAIN_SHEET_ID);
  const sh = ss.getSheetByName('LinkInBio');
  if (!sh) return { ok: false, error: 'no LinkInBio tab' };
  const linkId = 'LNK-' + Utilities.getUuid().slice(0, 8).toUpperCase();
  const lastRow = sh.getLastRow();
  const nextOrder = lastRow > 1 ? lastRow : 1;
  sh.appendRow([
    linkId,
    String(params.title_ar || ''),
    String(params.title_en || ''),
    String(params.url || ''),
    String(params.icon || ''),
    String(params.description || ''),
    'TRUE',
    nextOrder,
    0,
  ]);
  return { ok: true, linkId: linkId };
}

function adminUpdateLinkbio(params) {
  if (params.admin_token !== ADMIN_TOKEN) return { ok: false, error: 'unauthorized' };
  const id = String(params.link_id || '');
  const ss = SpreadsheetApp.openById(MAIN_SHEET_ID);
  const sh = ss.getSheetByName('LinkInBio');
  const data = sh.getDataRange().getValues();
  const fields = { title_ar: 2, title_en: 3, url: 4, icon: 5, description: 6, active: 7, order: 8 };
  for (let r = 1; r < data.length; r++) {
    if (String(data[r][0]) === id) {
      Object.keys(fields).forEach(function (k) {
        if (params[k] !== undefined) {
          var v;
          if (k === 'active') v = String(params[k]).toUpperCase();
          else if (k === 'order') v = Number(params[k]);
          else v = params[k];
          sh.getRange(r + 1, fields[k]).setValue(v);
        }
      });
      return { ok: true, linkId: id };
    }
  }
  return { ok: false, error: 'link_not_found' };
}

function adminDeleteLinkbio(params) {
  if (params.admin_token !== ADMIN_TOKEN) return { ok: false, error: 'unauthorized' };
  const id = String(params.link_id || '');
  const ss = SpreadsheetApp.openById(MAIN_SHEET_ID);
  const sh = ss.getSheetByName('LinkInBio');
  const data = sh.getDataRange().getValues();
  for (let r = 1; r < data.length; r++) {
    if (String(data[r][0]) === id) {
      sh.deleteRow(r + 1);
      return { ok: true, linkId: id };
    }
  }
  return { ok: false, error: 'link_not_found' };
}

function adminUpdateLinkbioHeader(params) {
  if (params.admin_token !== ADMIN_TOKEN) return { ok: false, error: 'unauthorized' };
  const ss = SpreadsheetApp.openById(MAIN_SHEET_ID);
  const sh = ss.getSheetByName('LinkInBioHeader');
  const data = sh.getDataRange().getValues();
  const updates = {};
  if (params.photo_url !== undefined) updates.PhotoURL = params.photo_url;
  if (params.tagline_ar !== undefined) updates.TaglineAR = params.tagline_ar;
  if (params.tagline_en !== undefined) updates.TaglineEN = params.tagline_en;
  for (let r = 1; r < data.length; r++) {
    const key = String(data[r][0]);
    if (updates[key] !== undefined) sh.getRange(r + 1, 2).setValue(updates[key]);
  }
  return { ok: true };
}

function adminIncrementLinkbioClick(params) {
  // No admin_token check — called from the public link.malearnsa.com page.
  const id = String(params.link_id || '');
  const ss = SpreadsheetApp.openById(MAIN_SHEET_ID);
  const sh = ss.getSheetByName('LinkInBio');
  const data = sh.getDataRange().getValues();
  for (let r = 1; r < data.length; r++) {
    if (String(data[r][0]) === id) {
      const cur = Number(data[r][8]) || 0;
      sh.getRange(r + 1, 9).setValue(cur + 1);
      return { ok: true, linkId: id, clicks: cur + 1 };
    }
  }
  return { ok: false, error: 'link_not_found' };
}

function adminSendEmail(params) {
  if (params.admin_token !== ADMIN_TOKEN) return { ok: false, error: 'unauthorized' };
  const to = String(params.to || '');
  const subject = String(params.subject || '');
  const body = String(params.body || '');
  if (!to || !subject || !body) return { ok: false, error: 'missing fields' };
  try {
    GmailApp.sendEmail(to, subject, body, {
      name: FROM_NAME,
      from: FROM_EMAIL,
      htmlBody: body,
    });
    return { ok: true, to: to };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

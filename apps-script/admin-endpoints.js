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
  let iId = header.indexOf('LessonID');
  if (iId === -1) iId = header.indexOf('ID');
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

// Map API param name → Coupons sheet header name. Header-driven, so extra columns
// like "Allowed Courses", "Excluded Courses", "Allowed Methods" are untouched.
const COUPON_PARAM_TO_HEADER = {
  code: 'Code',
  type: 'Type',
  value: 'Value',
  min_sar: 'Min Amount (SAR)',
  uses_left: 'Uses Left',
  start_date: 'Start Date',
  end_date: 'End Date',
  active: 'Active',
  products: 'Products',
  created_at: 'CreatedAt',
  created_by: 'CreatedBy',
};

function _couponHeaderIndex(sh) {
  const header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const idx = {};
  for (let i = 0; i < header.length; i++) idx[String(header[i])] = i;
  return { header: header, idx: idx };
}

function _couponValue(param, raw) {
  if (param === 'active') return String(raw).toUpperCase();
  if (param === 'value' || param === 'min_sar') return Number(raw);
  if (param === 'uses_left') return raw === '' ? '' : Number(raw);
  return raw;
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

  const info = _couponHeaderIndex(sh);
  const row = new Array(info.header.length).fill('');
  // Seed defaults even for params the caller omitted.
  const values = {
    code: code,
    type: String(params.type || 'percentage'),
    value: Number(params.value || 0),
    min_sar: Number(params.min_sar || 0),
    uses_left: params.uses_left === '' || params.uses_left === undefined ? '' : Number(params.uses_left),
    start_date: params.start_date || '',
    end_date: params.end_date || '',
    active: 'TRUE',
    products: String(params.products || 'all'),
    created_at: new Date().toISOString(),
    created_by: String(params.created_by || 'majid'),
  };
  Object.keys(values).forEach(function (p) {
    const h = COUPON_PARAM_TO_HEADER[p];
    if (h !== undefined && info.idx[h] !== undefined) row[info.idx[h]] = values[p];
  });
  sh.appendRow(row);
  return { ok: true, code: code, row: row };
}

function adminUpdateCoupon(params) {
  if (params.admin_token !== ADMIN_TOKEN) return { ok: false, error: 'unauthorized' };
  const code = String(params.code || '').toUpperCase().trim();
  const ss = SpreadsheetApp.openById(MAIN_SHEET_ID);
  const sh = ss.getSheetByName(COUPONS_SHEET);
  const data = sh.getDataRange().getValues();
  const info = _couponHeaderIndex(sh);
  const mutable = ['value', 'min_sar', 'uses_left', 'start_date', 'end_date', 'active', 'products'];
  for (let r = 1; r < data.length; r++) {
    if (String(data[r][0]).toUpperCase().trim() === code) {
      mutable.forEach(function (p) {
        if (params[p] !== undefined) {
          const h = COUPON_PARAM_TO_HEADER[p];
          if (h === undefined || info.idx[h] === undefined) return;
          sh.getRange(r + 1, info.idx[h] + 1).setValue(_couponValue(p, params[p]));
        }
      });
      return { ok: true, code: code };
    }
  }
  return { ok: false, error: 'code_not_found' };
}

function adminDeleteCoupon(params) {
  if (params.admin_token !== ADMIN_TOKEN) return { ok: false, error: 'unauthorized' };
  const code = String(params.code || '').toUpperCase().trim();
  if (!code) return { ok: false, error: 'code required' };
  const ss = SpreadsheetApp.openById(MAIN_SHEET_ID);
  const sh = ss.getSheetByName(COUPONS_SHEET);
  const data = sh.getDataRange().getValues();
  for (let r = 1; r < data.length; r++) {
    if (String(data[r][0]).toUpperCase().trim() === code) {
      sh.deleteRow(r + 1);
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

function adminAddEmailTemplate(params) {
  if (params.admin_token !== ADMIN_TOKEN) return { ok: false, error: 'unauthorized' };
  const ss = SpreadsheetApp.openById(MAIN_SHEET_ID);
  const sh = ss.getSheetByName('EmailTemplates');
  if (!sh) return { ok: false, error: 'no EmailTemplates tab' };
  const templateId = String(params.template_id || ('tpl-' + Utilities.getUuid().slice(0, 8).toLowerCase()));
  const data = sh.getDataRange().getValues();
  for (let r = 1; r < data.length; r++) {
    if (String(data[r][0]) === templateId) return { ok: false, error: 'template_id_exists' };
  }

  // Build header map so we can write columns by name (and only touch Blocks if present).
  const headers = data.length > 0 ? data[0] : [];
  const headerMap = {};
  for (let c = 0; c < headers.length; c++) headerMap[String(headers[c])] = c;
  const width = headers.length > 0 ? headers.length : 7;
  const row = new Array(width).fill('');

  function setCol(name, value, fallbackIdx) {
    if (headerMap[name] !== undefined) row[headerMap[name]] = value;
    else if (typeof fallbackIdx === 'number' && fallbackIdx < row.length) row[fallbackIdx] = value;
  }

  // Canonical column layout (v1): TemplateID, Name, SubjectAR, SubjectEN, BodyAR, BodyEN, Variables, (Blocks).
  setCol('TemplateID', templateId, 0);
  setCol('Name', String(params.name || 'Untitled'), 1);
  setCol('SubjectAR', String(params.subject_ar || ''), 2);
  setCol('SubjectEN', String(params.subject_en || ''), 3);
  setCol('BodyAR', String(params.body_ar || ''), 4);
  setCol('BodyEN', String(params.body_en || ''), 5);
  setCol('Variables', String(params.variables || 'name'), 6);
  // Blocks column is optional — only written if the header exists.
  if (headerMap['Blocks'] !== undefined) {
    row[headerMap['Blocks']] = String(params.blocks || '');
  }

  sh.appendRow(row);
  return { ok: true, templateId: templateId };
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

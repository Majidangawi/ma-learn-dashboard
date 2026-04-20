/**
 * MA Learn Dashboard — Newsletter + Subscribers admin endpoints.
 *
 * Appended to the live `token-validator` Apps Script project alongside the
 * existing admin-endpoints.js. Every action gates on `admin_token` matching
 * the ADMIN_TOKEN constant already defined in Code.js.
 *
 * Sheets touched (must exist with headers per docs/sheet-schema.md):
 *   - Subscribers          (new in 2026-04-20 Emails V2 + Newsletter rollout)
 *   - Newsletters          (new)
 *   - NewsletterEvents     (new)
 *
 * Integration points (wiring to add in doGet switch at Code.js bottom):
 *
 *   case 'admin_upsert_subscriber':      return _json(_admin_upsert_subscriber(params));
 *   case 'admin_mark_unsubscribed':      return _json(_admin_mark_unsubscribed(params));
 *   case 'admin_create_newsletter':      return _json(_admin_create_newsletter(params));
 *   case 'admin_update_newsletter':      return _json(_admin_update_newsletter(params));
 *   case 'admin_mark_newsletter_status': return _json(_admin_mark_newsletter_status(params));
 *   case 'admin_append_newsletter_event':return _json(_admin_append_newsletter_event(params));
 *   case 'admin_upload_email_image':     return _json(_admin_upload_email_image(params));
 *
 * All writes use lowercase email, ISO-ish timestamps in Asia/Riyadh TZ.
 * This file is a REFERENCE COPY in the repo — source of truth is the live
 * Apps Script project Majid edits in the browser.
 */

// ---------- helpers ----------
function _lc(s) { return String(s || '').trim().toLowerCase(); }
function _now() { return Utilities.formatDate(new Date(), 'Asia/Riyadh', "yyyy-MM-dd'T'HH:mm:ss"); }
function _sheet(name) { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name); }
function _rndToken(n) {
  var a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var s = '';
  for (var i = 0; i < (n || 24); i++) s += a.charAt(Math.floor(Math.random() * a.length));
  return s;
}

// Reads header row of a sheet and returns { colName: colIndex(0-based) }.
function _headerMap(sheet) {
  var row = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var map = {};
  row.forEach(function (h, i) { map[String(h).trim()] = i; });
  return map;
}

// ---------- admin_upsert_subscriber ----------
// Inserts a new Subscribers row or updates the existing one (appending the
// source to the CSV Sources column and refreshing LastSourceAt).
function _admin_upsert_subscriber(p) {
  var email = _lc(p.email);
  if (!email) return { ok: false, error: 'missing_email' };
  var src = String(p.source || '').trim();
  if (!src) return { ok: false, error: 'missing_source' };

  var sh = _sheet('Subscribers');
  if (!sh) return { ok: false, error: 'Subscribers_tab_missing' };
  var headers = _headerMap(sh);
  var last = sh.getLastRow();
  var data = last > 1 ? sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues() : [];

  var rowIndex = -1;
  for (var i = 0; i < data.length; i++) {
    if (_lc(data[i][headers['Email']]) === email) { rowIndex = i + 2; break; }
  }

  if (rowIndex > 0) {
    var sources = String(sh.getRange(rowIndex, headers['Sources'] + 1).getValue() || '')
      .split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    if (sources.indexOf(src) === -1) sources.push(src);
    sh.getRange(rowIndex, headers['Sources'] + 1).setValue(sources.join(','));
    sh.getRange(rowIndex, headers['LastSourceAt'] + 1).setValue(_now());
    if (p.name) sh.getRange(rowIndex, headers['Name'] + 1).setValue(p.name);
    return { ok: true, action: 'updated', email: email };
  }

  var newRow = new Array(sh.getLastColumn()).fill('');
  newRow[headers['Email']]            = email;
  newRow[headers['Name']]             = p.name || '';
  newRow[headers['Sources']]          = src;
  newRow[headers['Language']]         = (p.language === 'EN' ? 'EN' : 'AR');
  newRow[headers['AddedAt']]          = _now();
  newRow[headers['LastSourceAt']]     = _now();
  newRow[headers['Status']]           = 'active';
  newRow[headers['UnsubscribeToken']] = _rndToken(24);
  sh.appendRow(newRow);

  // Fire-and-forget welcome email (backend handles, won't fail subscribe on error).
  try {
    var backendUrl = PropertiesService.getScriptProperties().getProperty('BACKEND_URL');
    var adminToken = PropertiesService.getScriptProperties().getProperty('ADMIN_TOKEN');
    if (backendUrl && adminToken) {
      UrlFetchApp.fetch(backendUrl + '/api/writes/newsletter/send_welcome', {
        method: 'post',
        contentType: 'application/json',
        muteHttpExceptions: true,
        headers: { 'x-admin-token': adminToken },
        payload: JSON.stringify({ email: email, name: p.name || '', language: newRow[headers['Language']] }),
      });
    }
  } catch (e) { /* swallow */ }

  return { ok: true, action: 'inserted', email: email };
}

// ---------- admin_mark_unsubscribed ----------
// Flip Status to 'unsubscribed' and stamp UnsubscribedAt. Matches by email
// OR by UnsubscribeToken (whichever is supplied).
function _admin_mark_unsubscribed(p) {
  var email = _lc(p.email);
  var token = String(p.token || '').trim();
  if (!email && !token) return { ok: false, error: 'missing_email_or_token' };

  var sh = _sheet('Subscribers');
  if (!sh) return { ok: false, error: 'Subscribers_tab_missing' };
  var headers = _headerMap(sh);
  var last = sh.getLastRow();
  if (last < 2) return { ok: false, error: 'no_rows' };
  var data = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    if ((email && _lc(row[headers['Email']]) === email) ||
        (token && row[headers['UnsubscribeToken']] === token)) {
      var r = i + 2;
      sh.getRange(r, headers['Status'] + 1).setValue('unsubscribed');
      sh.getRange(r, headers['UnsubscribedAt'] + 1).setValue(_now());
      return { ok: true, email: _lc(row[headers['Email']]) };
    }
  }
  return { ok: false, error: 'not_found' };
}

// ---------- admin_create_newsletter ----------
function _admin_create_newsletter(p) {
  var sh = _sheet('Newsletters');
  if (!sh) return { ok: false, error: 'Newsletters_tab_missing' };
  var headers = _headerMap(sh);
  var id = 'nl_' + _rndToken(12);
  var row = new Array(sh.getLastColumn()).fill('');
  row[headers['NewsletterID']]     = id;
  row[headers['Subject']]          = p.subject || '';
  row[headers['Preheader']]        = p.preheader || '';
  row[headers['Language']]         = (p.language === 'EN' ? 'EN' : 'AR');
  row[headers['Blocks']]           = p.blocks || '[]';
  row[headers['SegmentFilter']]    = p.segmentFilter || '{}';
  row[headers['Status']]           = 'draft';
  row[headers['CreatedAt']]        = _now();
  row[headers['UpdatedAt']]        = _now();
  row[headers['IdempotencyKey']]   = _rndToken(24);
  row[headers['CreatedBy']]        = p.createdBy || 'majid';
  row[headers['CloneOf']]          = p.cloneOf || '';
  sh.appendRow(row);
  return { ok: true, newsletterId: id };
}

// ---------- admin_update_newsletter ----------
// Edits allowed fields on an existing newsletter draft or scheduled row.
function _admin_update_newsletter(p) {
  var id = String(p.newsletterId || '').trim();
  if (!id) return { ok: false, error: 'missing_newsletterId' };

  var sh = _sheet('Newsletters');
  if (!sh) return { ok: false, error: 'Newsletters_tab_missing' };
  var headers = _headerMap(sh);
  var data = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][headers['NewsletterID']]) === id) {
      var r = i + 2;
      var fields = ['Subject', 'Preheader', 'Language', 'Blocks', 'SegmentFilter', 'ScheduledAt'];
      fields.forEach(function (f) {
        var key = f.charAt(0).toLowerCase() + f.slice(1);
        if (p[key] !== undefined) sh.getRange(r, headers[f] + 1).setValue(p[key]);
      });
      sh.getRange(r, headers['UpdatedAt'] + 1).setValue(_now());
      return { ok: true };
    }
  }
  return { ok: false, error: 'not_found' };
}

// ---------- admin_mark_newsletter_status ----------
// Atomic status transition: only sets if current matches fromStatus (when given).
// Used by the scheduler/send pipeline to take ownership of a row.
function _admin_mark_newsletter_status(p) {
  var id = String(p.newsletterId || '').trim();
  var toStatus = String(p.toStatus || '').trim();
  var fromStatus = String(p.fromStatus || '').trim();
  if (!id || !toStatus) return { ok: false, error: 'missing' };

  var sh = _sheet('Newsletters');
  if (!sh) return { ok: false, error: 'Newsletters_tab_missing' };
  var headers = _headerMap(sh);
  var data = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][headers['NewsletterID']]) === id) {
      var r = i + 2;
      var current = String(sh.getRange(r, headers['Status'] + 1).getValue());
      if (fromStatus && current !== fromStatus) {
        return { ok: false, error: 'status_mismatch', current: current };
      }
      sh.getRange(r, headers['Status'] + 1).setValue(toStatus);
      sh.getRange(r, headers['UpdatedAt'] + 1).setValue(_now());
      if (toStatus === 'sent') sh.getRange(r, headers['SentAt'] + 1).setValue(_now());
      if (p.recipientCount !== undefined) sh.getRange(r, headers['RecipientCount'] + 1).setValue(p.recipientCount);
      if (p.brevoCampaignId) sh.getRange(r, headers['BrevoCampaignId'] + 1).setValue(p.brevoCampaignId);
      return { ok: true };
    }
  }
  return { ok: false, error: 'not_found' };
}

// ---------- admin_append_newsletter_event ----------
// Brevo webhook relays events (delivered/opened/clicked/unsubscribed/bounced).
// Backend calls this per event; we also increment the summary counter on the
// Newsletters row so the dashboard cards + stats view stay cheap to read.
function _admin_append_newsletter_event(p) {
  var sh = _sheet('NewsletterEvents');
  if (!sh) return { ok: false, error: 'NewsletterEvents_tab_missing' };
  var headers = _headerMap(sh);
  var row = new Array(sh.getLastColumn()).fill('');
  row[headers['EventID']]       = _rndToken(16);
  row[headers['Timestamp']]     = _now();
  row[headers['NewsletterID']]  = p.newsletterId || '';
  row[headers['Email']]         = _lc(p.email);
  row[headers['Event']]         = p.event || '';
  row[headers['URL']]           = p.url || '';
  row[headers['UserAgent']]     = String(p.userAgent || '').slice(0, 200);
  sh.appendRow(row);

  if (p.newsletterId) _incrementNewsletterCounter(p.newsletterId, p.event);
  return { ok: true };
}

function _incrementNewsletterCounter(newsletterId, event) {
  var map = {
    delivered: 'DeliveredCount', opened: 'OpenCount', clicked: 'ClickCount',
    unsubscribed: 'UnsubCount',  hard_bounce: 'BounceCount', soft_bounce: 'BounceCount',
  };
  var col = map[event];
  if (!col) return;
  var sh = _sheet('Newsletters');
  if (!sh) return;
  var headers = _headerMap(sh);
  var data = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][headers['NewsletterID']]) === newsletterId) {
      var r = i + 2;
      var current = Number(sh.getRange(r, headers[col] + 1).getValue()) || 0;
      sh.getRange(r, headers[col] + 1).setValue(current + 1);
      return;
    }
  }
}

// ---------- admin_upload_email_image ----------
// Fallback uploader for cases where the backend cannot reach the Drive API
// (e.g. local dev without OAuth refresh token). Normal flow is: frontend
// composer → backend /api/writes/upload_email_image → Drive API directly.
// This endpoint exists so the same contract works from Apps Script too.
//
// Params:
//   filename       — original file name (sanitized before use).
//   contentType    — MIME type (e.g. 'image/jpeg').
//   dataBase64     — base64-encoded file bytes (hard cap 7000 chars because
//                    Apps Script GET query strings are length-limited; larger
//                    uploads must go through the backend Drive path).
//
// Returns { ok: true, url: 'https://drive.google.com/uc?id=<id>' } on success.
function _admin_upload_email_image(p) {
  var filename = String(p.filename || '').trim();
  var contentType = String(p.contentType || '').trim();
  var b64 = String(p.dataBase64 || '');
  if (!filename || !contentType || !b64) return { ok: false, error: 'missing_params' };
  if (b64.length > 7000) return { ok: false, error: 'payload_too_large_use_backend' };

  var folderId = PropertiesService.getScriptProperties().getProperty('EMAIL_ASSETS_FOLDER_ID');
  var bytes;
  try { bytes = Utilities.base64Decode(b64); }
  catch (e) { return { ok: false, error: 'invalid_base64' }; }

  var blob = Utilities.newBlob(bytes, contentType, Date.now() + '-' + filename);
  var file = folderId
    ? DriveApp.getFolderById(folderId).createFile(blob)
    : DriveApp.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { ok: true, url: 'https://drive.google.com/uc?id=' + file.getId() };
}

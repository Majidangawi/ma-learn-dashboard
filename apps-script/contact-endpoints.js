// ═════════════════════════════════════════════════════════════════════
// CONTACTS / CRM — admin endpoints (2026-04-23 rollout)
// ═════════════════════════════════════════════════════════════════════
// Reference copy. The live handlers are appended to the token-validator
// Code.js and pushed via clasp from ~/code/.clasp-token-validator/.
// Called by the dashboard's Contacts page via /api/writes/contact/* routes.
//
// Depends on these symbols defined in the main Code.js:
//   ADMIN_TOKEN, MAIN_SHEET_ID, TOKENS_SHEET, CUSTOMERS_SHEET,
//   T2_PRODUCT, T3_PRODUCT, BL_PRODUCT, PP_PRODUCT,
//   FROM_NAME, FROM_EMAIL,
//   buildT2Email, buildT3Email, buildBLEmail, buildPPEmail,
//   _nl_lc, _nl_rndToken, _nl_sheet, _nl_headerMap

// ─── admin_resend_access_link ──────────────────────────────────────────────
function _admin_resend_access_link(p) {
  if (p.admin_token !== ADMIN_TOKEN) return { ok: false, error: 'unauthorized' };
  var email = _nl_lc(p.email);
  var product = String(p.product || '').trim();
  if (!email || !product) return { ok: false, error: 'missing_params' };

  var ss = SpreadsheetApp.openById(MAIN_SHEET_ID);
  var tokensSheet = ss.getSheetByName(TOKENS_SHEET);
  if (!tokensSheet) return { ok: false, error: 'no_tokens_sheet' };

  var data = tokensSheet.getDataRange().getValues();
  var foundToken = null;
  for (var i = 1; i < data.length; i++) {
    if (_nl_lc(data[i][3]) === email && String(data[i][1]).trim() === product) {
      foundToken = String(data[i][0]).trim();
      break;
    }
  }
  if (!foundToken) return { ok: false, error: 'no_token_for_product' };

  var custSheet = ss.getSheetByName(CUSTOMERS_SHEET);
  var name = '';
  if (custSheet) {
    var cdata = custSheet.getDataRange().getValues();
    for (var j = 1; j < cdata.length; j++) {
      if (_nl_lc(cdata[j][1]) === email) { name = String(cdata[j][2] || ''); break; }
    }
  }

  var courseUrl, subject, body;
  if (product === T2_PRODUCT) {
    courseUrl = 'https://player.malearnsa.com/watch.html?token=' + foundToken;
    subject = 'وصلك رابط الدورة — مدخل إلى الذكاء الاصطناعي الإبداعي';
    body = buildT2Email(name, courseUrl);
  } else if (product === T3_PRODUCT) {
    var t2Url = 'https://player.malearnsa.com/watch.html?token=' + foundToken + '&course=' + T2_PRODUCT;
    subject = 'تم تسجيلك — ورشة صناعة الإلهام';
    body = buildT3Email(name, t2Url);
  } else if (product === BL_PRODUCT) {
    courseUrl = 'https://player.malearnsa.com/watch.html?token=' + foundToken + '&course=beyond-lighting';
    subject = 'وصلك رابط الدورة — أبعد من إمكانيات الإضاءة';
    body = buildBLEmail(name, courseUrl);
  } else if (product === PP_PRODUCT) {
    var libUrl = 'https://malearnsa.com/prompt-pack/library/?token=' + foundToken;
    subject = 'وصلك كود الوصول — حزمة البرومبتات الإبداعية';
    body = buildPPEmail(name, libUrl, foundToken);
  } else {
    return { ok: false, error: 'unknown_product' };
  }

  try {
    GmailApp.sendEmail(email, subject, '', { htmlBody: body, name: FROM_NAME, from: FROM_EMAIL });
    return { ok: true, product: product, email: email };
  } catch (e) {
    return { ok: false, error: 'send_failed: ' + String(e) };
  }
}

// ─── admin_gift_token ──────────────────────────────────────────────────────
function _admin_gift_token(p) {
  if (p.admin_token !== ADMIN_TOKEN) return { ok: false, error: 'unauthorized' };
  var email = _nl_lc(p.email);
  var product = String(p.product || '').trim();
  if (!email || !product) return { ok: false, error: 'missing_params' };

  var ss = SpreadsheetApp.openById(MAIN_SHEET_ID);
  var tokensSheet = ss.getSheetByName(TOKENS_SHEET);
  if (!tokensSheet) return { ok: false, error: 'no_tokens_sheet' };

  var data = tokensSheet.getDataRange().getValues();
  var tokenRow = -1, assignedToken = null;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]).trim() === product && String(data[i][2]).trim() === 'available') {
      assignedToken = String(data[i][0]).trim();
      tokenRow = i + 1;
      break;
    }
  }
  if (!assignedToken) return { ok: false, error: 'no_tokens_available' };

  tokensSheet.getRange(tokenRow, 3).setValue('used');
  tokensSheet.getRange(tokenRow, 4).setValue(email);

  var custSheet = ss.getSheetByName(CUSTOMERS_SHEET);
  var name = String(p.name || '');
  var dateStr = Utilities.formatDate(new Date(), 'Asia/Riyadh', 'yyyy-MM-dd HH:mm:ss');
  var paymentId = 'gift-' + _nl_rndToken(10);
  if (custSheet) custSheet.appendRow([dateStr, email, name, '', product, 0, 'gift', paymentId]);

  var subject, body;
  if (product === T2_PRODUCT) {
    subject = 'هديتك — مدخل إلى الذكاء الاصطناعي الإبداعي';
    body = buildT2Email(name, 'https://player.malearnsa.com/watch.html?token=' + assignedToken);
  } else if (product === T3_PRODUCT) {
    subject = 'هديتك — ورشة صناعة الإلهام';
    body = buildT3Email(name, 'https://player.malearnsa.com/watch.html?token=' + assignedToken + '&course=' + T2_PRODUCT);
  } else if (product === BL_PRODUCT) {
    subject = 'هديتك — أبعد من إمكانيات الإضاءة';
    body = buildBLEmail(name, 'https://player.malearnsa.com/watch.html?token=' + assignedToken + '&course=beyond-lighting');
  } else if (product === PP_PRODUCT) {
    subject = 'هديتك — حزمة البرومبتات الإبداعية';
    body = buildPPEmail(name, 'https://malearnsa.com/prompt-pack/library/?token=' + assignedToken, assignedToken);
  } else {
    return { ok: false, error: 'unknown_product' };
  }

  try {
    GmailApp.sendEmail(email, subject, '', { htmlBody: body, name: FROM_NAME, from: FROM_EMAIL });
    return { ok: true, token: assignedToken, paymentId: paymentId, product: product };
  } catch (e) {
    return { ok: false, error: 'send_failed: ' + String(e) };
  }
}

// ─── admin_remove_subscriber ───────────────────────────────────────────────
function _admin_remove_subscriber(p) {
  if (p.admin_token !== ADMIN_TOKEN) return { ok: false, error: 'unauthorized' };
  var email = _nl_lc(p.email);
  if (!email) return { ok: false, error: 'missing_email' };

  var sh = _nl_sheet('Subscribers', p.sheetId);
  if (!sh) return { ok: false, error: 'Subscribers_tab_missing' };
  var headers = _nl_headerMap(sh);
  var last = sh.getLastRow();
  if (last < 2) return { ok: true, removed: false };
  var data = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
  for (var i = 0; i < data.length; i++) {
    if (_nl_lc(data[i][headers['Email']]) === email) {
      sh.deleteRow(i + 2);
      return { ok: true, removed: true, email: email };
    }
  }
  return { ok: true, removed: false };
}

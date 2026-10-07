/**
 * Vienovo Raw Material Canvass: Google Apps Script backend (locked down).
 *
 * Outsiders (suppliers) can ONLY submit. They cannot read any canvass data.
 * Procurement reads everything by opening the form with #admin=<ADMIN_KEY>.
 *
 * Setup (see SETUP-APPS-SCRIPT.md):
 *  1. Open the Google Sheet that should store canvasses > Extensions > Apps Script.
 *  2. Replace the code with this file.
 *  3. Project Settings > Script properties > add ADMIN_KEY = a long random string.
 *  4. Deploy > New deployment > Web app > Execute as: Me, Who has access: Anyone.
 *  5. Put the new /exec URL in SHEET_URL in index.html.
 */
var SHEET_NAME = 'Canvass_v2';
var MAX_BODY = 20000; // bytes; a canvass record is ~2 KB

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(['ref', 'updatedAt', 'token', 'status', 'submittedBy', 'supplier', 'record(json)']);
    sh.setFrozenRows(1);
  }
  return sh;
}

function isAdmin_(key) {
  var real = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY') || '';
  if (!real || real.length < 16 || !key || key.length !== real.length) return false;
  var diff = 0;
  for (var i = 0; i < real.length; i++) diff |= real.charCodeAt(i) ^ key.charCodeAt(i);
  return diff === 0;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function findRow_(sh, ref) {
  var last = sh.getLastRow();
  if (last < 2) return 0;
  var refs = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < refs.length; i++) if (refs[i][0] === ref) return i + 2;
  return 0;
}

/** GET: public callers learn nothing except whether THEIR OWN canvass (ref + token) was stored. */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (isAdmin_(p.key)) {
    var sh = sheet_(), last = sh.getLastRow(), records = [];
    if (last > 1) {
      sh.getRange(2, 7, last - 1, 1).getValues().forEach(function (r) {
        try { records.push(JSON.parse(r[0])); } catch (err) {}
      });
    }
    return json_({ ok: true, admin: true, records: records });
  }
  if (p.check && p.token) {
    var s = sheet_(), row = findRow_(s, String(p.check));
    var stored = row > 0 && s.getRange(row, 3).getValue() === String(p.token);
    return json_({ ok: true, admin: false, stored: stored });
  }
  return json_({ ok: true, admin: false });
}

function validate_(r) {
  if (!r || typeof r !== 'object') return 'bad record';
  if (!/^CS-\d{6}-[A-Z2-9]{6}$/.test(String(r.ref || ''))) return 'bad ref';
  if (!r.brand || !r.supplierName || !r.submittedBy) return 'missing fields';
  if (!isFinite(Number(r.total)) || !isFinite(Number(r.price)) || !isFinite(Number(r.quantity))) return 'bad numbers';
  return '';
}

/** POST: submit or update a canvass. */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var raw = (e && e.postData && e.postData.contents) || '';
    if (raw.length > MAX_BODY) return json_({ ok: false, error: 'too large' });
    var body = JSON.parse(raw), rec = body.record, token = String(body.token || '');
    var err = validate_(rec);
    if (err) return json_({ ok: false, error: err });

    var admin = isAdmin_(body.key);
    if (!admin && !/^[a-z0-9]{32}$/.test(token)) return json_({ ok: false, error: 'bad token' });

    var sh = sheet_(), row = findRow_(sh, rec.ref), now = new Date().toISOString();
    if (row) {
      var existing = sh.getRange(row, 1, 1, 4).getValues()[0];
      if (!admin) {
        if (existing[2] !== token) return json_({ ok: false, error: 'ref taken' });      // not the original submitter
        if (existing[3] === 'final') return json_({ ok: false, error: 'finalized' });     // locked once finalized
      }
      token = admin ? String(existing[2]) : token; // admin edits keep the supplier's token
      sh.getRange(row, 1, 1, 7).setValues([[rec.ref, now, token, rec.status || 'submitted', rec.submittedBy, rec.supplierName, JSON.stringify(rec)]]);
    } else {
      if (admin && !token) token = 'admin';
      sh.appendRow([rec.ref, now, token, rec.status || 'submitted', rec.submittedBy, rec.supplierName, JSON.stringify(rec)]);
    }
    return json_({ ok: true });
  } catch (ex) {
    return json_({ ok: false, error: 'server error' });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

/**
 * Melange: send every Google Form response to the app as an applicant.
 *
 * Paste this into the response SHEET's Apps Script editor (Extensions >
 * Apps Script), not the form's. Setup is in docs/MATCHING.md.
 *
 * - onFormSubmit runs on every new response (you add the trigger once).
 * - importExistingRows sends every row already in the sheet. Safe to run
 *   more than once: the app updates an applicant with the same email rather
 *   than making a duplicate, and skips anyone who didn't consent.
 *
 * The secret lives in Project Settings > Script Properties as
 * APPLICANT_IMPORT_SECRET, never in this file.
 */

var ENDPOINT = 'https://melange-psi.vercel.app/api/applicants';

function onFormSubmit(e) {
  send_(e.namedValues);
}

function importExistingRows() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var values = sheet.getDataRange().getDisplayValues();
  var headers = values[0];
  var sent = 0;
  for (var r = 1; r < values.length; r++) {
    var namedValues = {};
    for (var c = 0; c < headers.length; c++) {
      namedValues[headers[c]] = [values[r][c]];
    }
    send_(namedValues);
    sent++;
  }
  Logger.log('Sent ' + sent + ' rows.');
}

function send_(namedValues) {
  var secret = PropertiesService.getScriptProperties().getProperty('APPLICANT_IMPORT_SECRET');
  if (!secret) throw new Error('Set APPLICANT_IMPORT_SECRET in Project Settings > Script Properties.');
  var res = UrlFetchApp.fetch(ENDPOINT, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + secret },
    payload: JSON.stringify({ namedValues: namedValues }),
    muteHttpExceptions: true,
  });
  var code = res.getResponseCode();
  var body = res.getContentText();
  Logger.log(code + ' ' + body);
  // A failure shows up under Executions, and Google emails you about it.
  if (code !== 200) throw new Error('Melange import failed (' + code + '): ' + body);
}

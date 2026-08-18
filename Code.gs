/**
 * BUDGET TOOLS
 * ---------------------------------------------------------------------
 * A custom "Budget Tools" menu with these actions:
 *   1. Add Transaction…     – simple popup form Bianca/Jonathan can use
 *                             for everyday entry. Fills in every backend
 *                             column (IDs, dedupe key, raw-record copy,
 *                             import batch, timestamps) automatically.
 *   2. Add Category…        – simple popup form to add a new spending
 *                             or income category without knowing the
 *                             ID scheme. New categories are born with
 *                             their Budget/Dashboard name live-linked to
 *                             Categories (see #8).
 *   3. View Category Spending… – picks one category and charts what was
 *                             actually spent/received on it, per week,
 *                             grouped by month, for the last 3/6/12
 *                             months. Read-only — writes nothing.
 *   4. Refresh This Week Snapshot – writes a "This Week" panel onto the
 *                             Dashboard sheet (spending vs last week,
 *                             top movers, pace projection, weekly
 *                             budget remaining, biggest transaction,
 *                             who spent what, a data-quality nudge).
 *                             Only ever touches its own block of cells.
 *                             Warns if Budget!B2 isn't the real current
 *                             month, since Pace Projection / Weekly
 *                             Budget Remaining are computed against it.
 *   5. Jump to Current Month – one-click way to set Budget!B2 to
 *                             today's calendar month, so it never has
 *                             to be retyped by hand.
 *   6. Monthly Budget Sit-Down… – reviews last month's essentials,
 *                             sets up next month's Budget Plan rows,
 *                             and now offers to advance Budget!B2 to
 *                             that month for you right afterward.
 *   7. Classify Fixed vs Fluctuating (one-time setup)… – seeds the
 *                             Fixed/Variable split used by #6.
 *   8. Sync Category Names to Budget & Dashboard (one-time setup)… –
 *                             retroactively live-links every existing
 *                             Budget/Dashboard category name to
 *                             Categories, so a rename in one place shows
 *                             up everywhere instead of the two silently
 *                             drifting apart (the root cause behind
 *                             names like "Household Gas" vs "Gas
 *                             (House)" showing up for what's actually
 *                             the same category).
 *   9. Show Version & Diagnostics – one place to check "is the pasted
 *                             code actually current" and "does the
 *                             script's view of the workbook's layout
 *                             match reality" — the version string, the
 *                             timezone actually being used, whether
 *                             Budget!B2 matches the current month,
 *                             whether every column these tools depend on
 *                             is still where they expect, the most
 *                             recent entries from the Change Log (see
 *                             logChange_ below — a hidden sheet every
 *                             write-capable tool appends one row to, so
 *                             "what happened and when" has an answer
 *                             without a live data read), the most
 *                             recently shipped versions from the Release
 *                             Notes sheet (see RELEASE_HISTORY_ below —
 *                             a hidden sheet listing every version this
 *                             file has shipped, kept current automatically
 *                             by syncReleaseNotes_()), and how long ago
 *                             the budget summary metrics below last
 *                             refreshed. Read-only.
 *  10. Refresh Budget Summary – recomputes the ENTIRE Budget/Dashboard/
 *                             Income History numeric surface: every
 *                             category's Budgeted & Actual, the Income/
 *                             Expense/Essential totals, NET, the Income
 *                             vs Expenses recap, the Household Safety
 *                             Number, Dashboard's per-category Budgeted/
 *                             Actual/Remaining mirror and its Fixed/
 *                             Variable/Total Income, Total Expenses, Net
 *                             and Savings Rate, and every month on Income
 *                             History — see recomputeBudgetSummaryMetrics_()
 *                             below (v0.0.22) for why none of this is a
 *                             spreadsheet formula anymore. Also runs
 *                             automatically after Add Transaction, Add
 *                             Shift, Add Category, Monthly Budget
 *                             Sit-Down, and Jump to Current Month; this
 *                             menu item is for after a manual edit made
 *                             directly in the sheet, outside the tools.
 *  11. Enable Scheduled Budget Refresh (one-time setup) – adds a
 *                             time-driven trigger (every 4 hours) that
 *                             also calls the same recompute, so the
 *                             numbers above stay reasonably current even
 *                             without an explicit action. Safe to re-run
 *                             — will not create a duplicate trigger.
 *  12. Data Health Check – read-only scan for the exact class of bug that
 *                             has bitten this project before: orphaned
 *                             foreign keys (a Subcategory whose
 *                             Parent_Category_ID doesn't match any active
 *                             Category — the CAT-INCOME/INCOME bug from
 *                             v0.0.19; a Transaction whose Manual/Effective
 *                             Category_ID doesn't match an active top-level
 *                             Category; a Transaction/Budget Plan row whose
 *                             Subcategory_ID doesn't match any active
 *                             Subcategory; a Transaction's Member_ID not
 *                             matching an active Household Member),
 *                             duplicate/drifted category names (the "2 Cat
 *                             Litter subcategories" issue), duplicate
 *                             Category_IDs, and Budget-vs-Dashboard
 *                             category-set mismatches — see
 *                             runDataHealthCheck_() below (v0.0.23/v0.0.24).
 *                             Read-only — never writes anything.
 *  13. Refresh Duplicate Flags – recomputes Potential_Duplicate_Flag for
 *                             the real Transactions data extent in one
 *                             linear-time pass. Duplicate_Key and the
 *                             reviewed Is_Duplicate financial control are
 *                             never changed.
 *  14. View Data Dictionary – jumps to a new, visible "Data Dictionary"
 *                             sheet mapping every real sheet to its ID
 *                             column, ID scheme, foreign-key relationships
 *                             to other sheets, and any hidden/behind-the-
 *                             scenes columns — kept current automatically
 *                             by syncDataDictionary_() (see
 *                             DATA_DICTIONARY_ below, v0.0.23), the same
 *                             self-generating pattern as Release Notes.
 *  15. Preview / Apply v0.0.24 Data Corrections – development-only menu
 *                             controls defined in Maintenance.gs. Preview
 *                             is read-only; Apply is confirmation-gated,
 *                             validates exact IDs/current values, verifies
 *                             results, and rolls back its own writes on a
 *                             failed migration attempt.
 *
 * Normal tools preserve existing ledger history — every action only
 * appends new rows, or (Refresh This Week Snapshot / Refresh Budget Summary) rewrites
 * its own dedicated block of cells, or (Jump to Current Month / the
 * Sit-Down prompt) updates the single Budget!B2 cell, or (Sync Category
 * Names) rewrites only the category-name cells on Budget/Dashboard into
 * live formulas, or (View Data Dictionary) rewrites only its own
 * self-generating reference sheet — using the same schema the workbook
 * already uses, so the
 * backend (Transactions / Raw Transactions / Import Batches / Categories /
 * Budget Plan) stays exactly as-is for future automation. The one-time
 * v0.0.24 data-integrity correction is the explicit exception: it is
 * development-only, previewed, confirmation-gated, and verified.
 *
 * COLUMN LOOKUPS: with the exception of Budget and Dashboard (which are
 * presentation sheets with irregular, multi-section layouts rather than
 * a single header row — see findRowByLabel_ below), every sheet this
 * file reads or writes is addressed by HEADER NAME, not hardcoded
 * column letter/number — see headerMap_() / col_() / colLetter_() /
 * rowFromHeaders_() just below readTable_(). Renaming, inserting, or
 * reordering a column on one of those sheets no longer silently breaks
 * a formula or read somewhere else in the file; a genuinely missing
 * column throws a clear error naming the sheet and header it expected,
 * instead of quietly reading/writing the wrong column.
 *
 * DATES & TIMEZONES: every place this file interprets "what calendar
 * month/day is this" goes through the spreadsheet's OWN timezone
 * (getTz_()), never the Apps Script runtime's implicit one — see the
 * comment above getTz_() below for why that distinction is a real,
 * previously-hit bug (Jump to Current Month once falsely reported
 * "already correct"). This applies to every Date this file constructs
 * from user input or from a month range, not just month-selector logic —
 * addTransaction()'s entered date and getCategorySpendingData()'s month
 * range are both parsed/built the same tz-safe way, via
 * Utilities.parseDate()/monthStartFromKey_()/shiftMonthKey_() rather
 * than a bare `new Date(...)` (fixed 2026-08-17, v0.0.17).
 *
 * VERSIONING: APP_VERSION follows v0.0.x — bump the trailing number by
 * one, and add a matching entry to RELEASE_HISTORY_ (see the VERSION &
 * DIAGNOSTICS section near the bottom of this file), any time this file
 * changes in a way worth remembering. The hidden Release Notes sheet
 * stays in sync with that list automatically (syncReleaseNotes_(),
 * called from onOpen() and showDiagnostics()) — nothing needs to be
 * typed into the spreadsheet by hand.
 * ---------------------------------------------------------------------
 */
// ============================= MENU =================================
function onOpen() {
  syncReleaseNotes_(); // keeps the Release Notes sheet current every time the workbook opens
  syncDataDictionary_(); // keeps the Data Dictionary sheet current every time the workbook opens (v0.0.23)
  refreshBudgetSummarySilently_(); // keeps the whole Budget/Dashboard/Income History numeric surface current on open — see the BUDGET, DASHBOARD & INCOME HISTORY ENGINE below
  var menu = SpreadsheetApp.getUi()
    .createMenu('Budget Tools')
    .addItem('Add Transaction…', 'showAddTransactionDialog')
    .addItem('Add Category…', 'showAddCategoryDialog')
    .addItem('Add Shift… (tips & wages)', 'showAddShiftDialog')
    .addSeparator()
    .addItem('View Category Spending…', 'showCategorySpendingDialog')
    .addItem('Refresh This Week Snapshot', 'refreshThisWeekSnapshot')
    .addItem('Refresh Budget Summary', 'refreshBudgetSummary')
    .addSeparator()
    .addItem('Jump to Current Month', 'jumpToCurrentMonth')
    .addItem('Monthly Budget Sit-Down…', 'monthlyBudgetSitDown')
    .addItem('Classify Fixed vs Fluctuating (one-time setup)…', 'classifyFixedVsFluctuating')
    .addItem('Sync Category Names to Budget & Dashboard (one-time setup)…', 'syncCategoryNames')
    .addItem('Enable Scheduled Budget Refresh (one-time setup)…', 'setupScheduledBudgetRefresh')
    .addSeparator()
    .addItem('Show Version & Diagnostics', 'showDiagnostics')
    .addItem('Data Health Check', 'dataHealthCheck')
    .addItem('Refresh Duplicate Flags', 'refreshPotentialDuplicateFlags')
    .addItem('View Data Dictionary', 'viewDataDictionary');
  // The migration controls never appear in production. typeof keeps onOpen
  // resilient if an incomplete paste omitted Maintenance.gs.
  if (typeof isLegacyIncomeV0025DevSpreadsheet_ === 'function' && isLegacyIncomeV0025DevSpreadsheet_()) {
    menu.addSeparator()
      .addItem('Preview v0.0.25 Income-ID Corrections', 'previewLegacyIncomeCorrections')
      .addItem('Apply v0.0.25 Income-ID Corrections…', 'applyLegacyIncomeCorrections');
  } else if (typeof isDataIntegrityV0024DevSpreadsheet_ === 'function' && isDataIntegrityV0024DevSpreadsheet_()) {
    menu.addSeparator()
      .addItem('Preview v0.0.24 Data Corrections', 'previewDataIntegrityCorrections')
      .addItem('Apply v0.0.24 Data Corrections…', 'applyDataIntegrityCorrections');
  }
  menu.addToUi();
}
// ======================= SMALL SHARED HELPERS ========================
function sheet_(name) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error('Sheet not found: ' + name);
  return sh;
}
// Reads a whole table (header row 4, data starting row 5) into an array
// of plain objects keyed by header name. Stops at the first fully blank row.
function readTable_(sheetName) {
  var sh = sheet_(sheetName);
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow < 5) return [];
  var headers = sh.getRange(4, 1, 1, lastCol).getValues()[0];
  var values = sh.getRange(5, 1, lastRow - 4, lastCol).getValues();
  var out = [];
  for (var r = 0; r < values.length; r++) {
    var row = values[r];
    var blank = row.every(function (v) { return v === '' || v === null; });
    if (blank) continue;
    var obj = { _row: r + 5 };
    for (var c = 0; c < headers.length; c++) {
      if (headers[c]) obj[headers[c]] = row[c];
    }
    out.push(obj);
  }
  return out;
}
// ================ HEADER-BASED COLUMN LOOKUP =========================
// Instead of hardcoding "column F" / "column 6" everywhere, a sheet's
// header row (row 4) is read once and cached as a {headerName: colNumber}
// map. Every read/write in this file that used to say "column 6" now
// says col_('Transactions', 'Transaction_Date') — so inserting, removing,
// or reordering a column no longer silently breaks a formula or a bulk
// read somewhere else in the file, and a genuinely missing/renamed
// header throws a clear error immediately instead of quietly reading
// the wrong column. This does NOT apply to Budget or Dashboard, which
// are presentation sheets with irregular, multi-section layouts (a
// section label row, then a header row one row below it, repeated more
// than once per sheet) rather than one consistent header row — those
// two are still addressed via findRowByLabel_() and a small number of
// deliberately-documented fixed columns (see insertBudgetRow_ /
// addDashboardRow_ / syncCategoryNames below).
var HEADER_MAP_CACHE_ = {};
function headerMap_(sheetName) {
  if (HEADER_MAP_CACHE_[sheetName]) return HEADER_MAP_CACHE_[sheetName];
  var sh = sheet_(sheetName);
  var lastCol = sh.getLastColumn();
  var headers = sh.getRange(4, 1, 1, lastCol).getValues()[0];
  var map = {};
  for (var c = 0; c < headers.length; c++) {
    var name = String(headers[c] || '').trim();
    if (name) map[name] = c + 1; // 1-based column number
  }
  HEADER_MAP_CACHE_[sheetName] = map;
  return map;
}
// 1-based column number for `headerName` on `sheetName`. Throws a clear,
// specific error (naming both the sheet and the header) rather than
// silently reading/writing the wrong column if a header ever gets
// renamed, removed, or the sheet's layout changes.
function col_(sheetName, headerName) {
  var c = headerMap_(sheetName)[headerName];
  if (!c) {
    throw new Error('Expected a column labeled "' + headerName + '" on the ' + sheetName +
      ' sheet (row 4 headers) but couldn\'t find one — its layout may have changed.');
  }
  return c;
}
// A1-style column letter for `headerName` on `sheetName` — for building
// formula strings that need a real cell reference (e.g. "$F5").
function colLetter_(sheetName, headerName) {
  return columnToLetter_(col_(sheetName, headerName));
}
function columnToLetter_(colNum) {
  var letter = '';
  while (colNum > 0) {
    var rem = (colNum - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    colNum = Math.floor((colNum - 1) / 26);
  }
  return letter;
}
// Builds a row array for appendRow()/setValues() from a plain
// {headerName: value} object, placing each value according to the
// sheet's ACTUAL current header layout — so a write stays correct even
// if columns get reordered later, and a typo'd/missing key here throws
// immediately (naming the bad key) instead of silently writing blank or
// into the wrong column. Any header on the sheet not mentioned in
// `valuesByHeader` is left blank, same as leaving a field empty today.
function rowFromHeaders_(sheetName, valuesByHeader) {
  var map = headerMap_(sheetName);
  var maxCol = 0;
  Object.keys(map).forEach(function (h) { maxCol = Math.max(maxCol, map[h]); });
  var row = new Array(maxCol).fill('');
  Object.keys(valuesByHeader).forEach(function (h) {
    var c = map[h];
    if (!c) {
      throw new Error('Expected a column labeled "' + h + '" on the ' + sheetName +
        ' sheet (row 4 headers) but couldn\'t find one — its layout may have changed.');
    }
    row[c - 1] = valuesByHeader[h];
  });
  return row;
}
// ======================= CHANGE LOG / AUDIT TRAIL =====================
// A hidden "Change Log" sheet that every write-capable tool appends one
// row to: when, which tool, what it did. This exists so "when did
// Budget!B2 last change, and what else happened around then" is a
// question answerable by opening one sheet — instead of needing a live
// Drive read and some detective work, the way every bug earlier in this
// project had to be diagnosed. Show Version & Diagnostics surfaces the
// most recent entries; the full history lives on the sheet itself
// (Sheet menu → hide/unhide sheets to view it — it's hidden by default
// so it doesn't clutter the tab bar for everyday use).
var CHANGE_LOG_SHEET_NAME = 'Change Log';
// Creates the Change Log sheet (with a header row, hidden) the first
// time any write-capable tool runs. Safe to call every time — a no-op
// if the sheet already exists.
function getOrCreateChangeLogSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CHANGE_LOG_SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(CHANGE_LOG_SHEET_NAME);
    sh.getRange(1, 1, 1, 3).setValues([['Timestamp', 'Action', 'Details']]);
    sh.getRange(1, 1, 1, 3).setFontWeight('bold');
    sh.setColumnWidth(1, 150);
    sh.setColumnWidth(2, 160);
    sh.setColumnWidth(3, 500);
    try { sh.hideSheet(); } catch (e) { /* hiding is best-effort */ }
  }
  return sh;
}
// Appends one row to the Change Log. Call this at the end of any tool
// that writes to the workbook, with a short action name and a
// human-readable one-line summary of what changed. Deliberately
// swallows its own errors (e.g. someone deleted the Change Log sheet
// mid-session) — a logging failure should never break the tool that
// called it.
function logChange_(action, details) {
  try {
    var sh = getOrCreateChangeLogSheet_();
    sh.appendRow([new Date(), action, details]);
  } catch (e) {
    // Logging is best-effort — never let it break the calling tool.
  }
}
function slug_(text) {
  return String(text)
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
// Finds the next unused numeric suffix in an ID column like
// "TXN-LEGACY-000001" / "TXN-MANUAL-000004" — looks at ALL existing
// values in the column regardless of prefix, so numbering never
// collides. Takes the column's HEADER NAME (e.g. "Transaction_ID"), not
// a hardcoded letter, so it stays correct if that column ever moves.
function nextSequence_(sheetName, headerName) {
  var sh = sheet_(sheetName);
  var lastRow = sh.getLastRow();
  if (lastRow < 5) return 1;
  var columnLetter = colLetter_(sheetName, headerName);
  var col = sh.getRange(columnLetter + '5:' + columnLetter + lastRow).getValues();
  var max = 0;
  col.forEach(function (r) {
    var v = String(r[0] || '');
    var m = v.match(/(\d+)\s*$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return max + 1;
}
function pad_(n, width) {
  var s = String(n);
  while (s.length < width) s = '0' + s;
  return s;
}
function uniqueId_(candidate, existingIds) {
  if (existingIds.indexOf(candidate) === -1) return candidate;
  var n = 2;
  while (existingIds.indexOf(candidate + '-' + n) !== -1) n++;
  return candidate + '-' + n;
}
function todayStr_() {
  return Utilities.formatDate(new Date(), getTz_(), 'yyyy-MM-dd');
}
// The spreadsheet's OWN configured timezone (File > Settings > Time zone),
// not the Apps Script project's separately-configured one. These two can
// differ — and when they do, a date sitting near midnight on the 1st can
// get read by the script as one calendar month while the sheet's own
// display and native formulas (EOMONTH, etc.) still treat it as the
// previous month. That mismatch was a real bug: Jump to Current Month
// once reported Budget!B2 as "already" the current month while the sheet
// itself (and its own Actual formulas) still showed the previous month.
// Using the spreadsheet's real timezone everywhere a month is compared or
// written keeps the script's idea of "what month is this" in agreement
// with what the sheet itself shows.
var EXPECTED_TIMEZONE_ = 'America/Toronto';
function getTz_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone() || Session.getScriptTimeZone() || EXPECTED_TIMEZONE_;
}
// 'yyyy-MM' key for a date, explicit about which timezone did the
// interpreting — use this (not raw Date.getMonth()/getFullYear(), which
// depend on the script runtime's own implicit timezone) any time two
// dates need to be compared as "same calendar month," so the comparison
// always agrees with the spreadsheet's own timezone.
function monthKey_(date, tz) {
  return Utilities.formatDate(date, tz, 'yyyy-MM');
}
// Builds a Date representing the 1st of the given 'yyyy-MM' key, midnight,
// unambiguously anchored to `tz` via Utilities.parseDate — rather than
// `new Date(y, m, 1)`, which is constructed in the script runtime's own
// implicit timezone and can silently disagree with the spreadsheet's.
function monthStartFromKey_(monthKey, tz) {
  return Utilities.parseDate(monthKey + '-01', tz, 'yyyy-MM-dd');
}
// Shifts a 'yyyy-MM' month key by `delta` whole months (positive or
// negative), using plain integer arithmetic on the year/month parts —
// deliberately NOT built from a JS Date object, so there's no runtime-
// timezone hazard to reason about at all here. Pairs with
// monthStartFromKey_() any time code needs "N months before/after this
// month" without risking the same implicit-timezone drift getTz_() /
// monthKey_() / monthStartFromKey_() exist to guard against elsewhere.
// (Added 2026-08-17, v0.0.17, alongside the getCategorySpendingData()
// timezone fix below.)
function shiftMonthKey_(monthKey, delta) {
  var parts = monthKey.split('-');
  var year = parseInt(parts[0], 10);
  var monthIdx = parseInt(parts[1], 10) - 1; // 0-indexed
  var total = year * 12 + monthIdx + delta;
  var newYear = Math.floor(total / 12);
  var newMonthIdx = ((total % 12) + 12) % 12;
  return newYear + '-' + pad_(newMonthIdx + 1, 2);
}
// Returns (creating if needed) the single shared "manual entry" import
// batch used for everything added through these two tools, and bumps
// its Record_Count.
function getOrCreateManualBatch_(accountId) {
  var sh = sheet_('Import Batches');
  var rows = readTable_('Import Batches');
  var existing = rows.filter(function (r) { return r.Import_Batch_ID === 'BATCH-MANUAL-ENTRY'; })[0];
  if (existing) {
    sh.getRange(existing._row, col_('Import Batches', 'Record_Count')).setValue((existing.Record_Count || 0) + 1);
    return 'BATCH-MANUAL-ENTRY';
  }
  sh.appendRow(rowFromHeaders_('Import Batches', {
    Import_Batch_ID: 'BATCH-MANUAL-ENTRY',
    Imported_At: new Date(),
    Source_System: 'Manual entry (Add Transaction tool)',
    Source_File: '',
    Account_ID: accountId,
    Record_Count: 1,
    Status: 'Completed',
    Notes: 'Auto-created by the Add Transaction tool; reused for every manual entry.'
  }));
  return 'BATCH-MANUAL-ENTRY';
}
function getActiveAccountId_() {
  var accounts = readTable_('Accounts').filter(function (a) { return a.Active_Flag === 'Yes'; });
  if (!accounts.length) throw new Error('No active account found in the Accounts sheet.');
  return accounts[0].Account_ID; // only one account exists today; first active one wins
}
function getHouseholdMembersList_() {
  return readTable_('Household Members')
    .filter(function (m) { return m.Active_Flag === 'Yes'; })
    .map(function (m) { return { id: m.Member_ID, name: m.Display_Name }; });
}
function getCategoriesList_() {
  // Only subcategories (leaf rows) are selectable on a transaction/budget line.
  return readTable_('Categories')
    .filter(function (c) { return c.Record_Type === 'Subcategory' && c.Active_Flag === 'Yes'; })
    .map(function (c) {
      return {
        subId: c.Category_ID,
        subName: c.Category_Name,
        parentId: c.Parent_Category_ID,
        transactionType: c.Transaction_Type,
        essentialDefault: c.Essential_Default,
        incomeStabilityDefault: c.Income_Stability_Default
      };
    });
}
function getTopLevelCategoriesList_() {
  return readTable_('Categories')
    .filter(function (c) { return c.Record_Type === 'Category' && c.Active_Flag === 'Yes'; })
    .map(function (c) { return { id: c.Category_ID, name: c.Category_Name, transactionType: c.Transaction_Type }; });
}
// ==================== DUPLICATE REVIEW ENGINE =========================
var DUPLICATE_FLAG_LOCK_TIMEOUT_MS_ = 10000;

// Potential_Duplicate_Flag is a review aid, not the financial control:
// only the separately-reviewed Is_Duplicate column affects Budget,
// Dashboard, and Income History totals. Before v0.0.26 every transaction
// carried its own COUNTIF formula capped at row 5,000. That both missed
// later rows and made scaling the range increasingly expensive. This pure
// function counts exact, case-insensitive Duplicate_Key values in O(n),
// then returns the same "flag every occurrence when a key repeats" policy.
// Duplicate_Key itself is deliberately left unchanged.
function calcPotentialDuplicateFlags_(duplicateKeys) {
  var canonicalKeys = duplicateKeys.map(function (value) {
    if (value === '' || value === null || typeof value === 'undefined') return '';
    return String(value).toLowerCase();
  });
  var counts = {};
  canonicalKeys.forEach(function (key) {
    if (!key) return;
    var token = '$' + key; // prefix avoids special object keys such as __proto__
    counts[token] = (counts[token] || 0) + 1;
  });
  var duplicateKeyCount = 0;
  Object.keys(counts).forEach(function (token) {
    if (counts[token] > 1) duplicateKeyCount++;
  });
  var duplicateRowCount = 0;
  var flags = canonicalKeys.map(function (key) {
    if (!key) return '';
    var flag = counts['$' + key] > 1 ? 'Yes' : 'No';
    if (flag === 'Yes') duplicateRowCount++;
    return flag;
  });
  return {
    flags: flags,
    duplicateKeyCount: duplicateKeyCount,
    duplicateRowCount: duplicateRowCount
  };
}

// Thin Sheet I/O wrapper: one column read and one column write, regardless
// of ledger length. A document lock serializes overlapping recalculations
// so an older full-column result cannot overwrite a newer one. The lock is
// deliberately acquired before the ledger extent is read and always
// released in finally. SpreadsheetApp.flush() makes sure a newly-written
// Duplicate_Key formula has recalculated before its value is counted.
function recomputePotentialDuplicateFlags_() {
  var lock = LockService.getDocumentLock();
  if (!lock || !lock.tryLock(DUPLICATE_FLAG_LOCK_TIMEOUT_MS_)) {
    throw new Error('Could not obtain the duplicate-review lock within 10 seconds. No duplicate flags were changed; try again.');
  }
  try {
    var sh = sheet_('Transactions');
    var lastRow = sh.getLastRow();
    if (lastRow < 5) {
      return { scannedRows: 0, duplicateKeyCount: 0, duplicateRowCount: 0 };
    }
    SpreadsheetApp.flush();
    var rowCount = lastRow - 4;
    var keyValues = sh.getRange(5, col_('Transactions', 'Duplicate_Key'), rowCount, 1).getValues();
    var result = calcPotentialDuplicateFlags_(keyValues.map(function (row) { return row[0]; }));
    sh.getRange(5, col_('Transactions', 'Potential_Duplicate_Flag'), rowCount, 1)
      .setValues(result.flags.map(function (flag) { return [flag]; }));
    return {
      scannedRows: rowCount,
      duplicateKeyCount: result.duplicateKeyCount,
      duplicateRowCount: result.duplicateRowCount
    };
  } finally {
    lock.releaseLock();
  }
}

// Manual recovery/control for bulk imports or diagnostics. This only
// rewrites the derived Potential_Duplicate_Flag column.
function refreshPotentialDuplicateFlags() {
  var result = recomputePotentialDuplicateFlags_();
  logChange_('Refresh Duplicate Flags', 'Scanned ' + result.scannedRows + ' transaction row(s); ' +
    result.duplicateRowCount + ' row(s) across ' + result.duplicateKeyCount + ' repeated key(s) flagged.');
  SpreadsheetApp.getUi().alert(
    'Budget Tools — Duplicate Review',
    '✓ Duplicate review flags refreshed across ' + result.scannedRows + ' transaction row(s).\n\n' +
    result.duplicateRowCount + ' row(s) share ' + result.duplicateKeyCount + ' repeated key(s).\n' +
    'Duplicate_Key and Is_Duplicate were not changed.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

// Preserve the old formula-driven instant-update behavior for direct edits
// to the fields that make up Duplicate_Key. Script writes do not fire this
// simple trigger; Add Transaction and Add Shift call the recompute directly.
function onEdit(e) {
  if (!e || !e.range) return;
  var editedSheet = e.range.getSheet();
  if (editedSheet.getName() !== 'Transactions') return;
  var lastEditedRow = e.range.getRow() + e.range.getNumRows() - 1;
  if (lastEditedRow < 5) return;
  var firstEditedCol = e.range.getColumn();
  var lastEditedCol = firstEditedCol + e.range.getNumColumns() - 1;
  var watchedColumns = [
    col_('Transactions', 'Transaction_Date'),
    col_('Transactions', 'Amount'),
    col_('Transactions', 'Account_ID'),
    col_('Transactions', 'Transaction_Type'),
    col_('Transactions', 'Original_Description'),
    col_('Transactions', 'Duplicate_Key'),
    col_('Transactions', 'Potential_Duplicate_Flag')
  ];
  var touchesDuplicateInput = watchedColumns.some(function (column) {
    return column >= firstEditedCol && column <= lastEditedCol;
  });
  if (touchesDuplicateInput) recomputePotentialDuplicateFlags_();
}
// ======================= ADD TRANSACTION =============================
// Browser-side controls are a convenience only. This pure function is the
// authoritative boundary for every Add Transaction request: it accepts plain
// form/reference data, makes no SpreadsheetApp calls, and returns normalized
// plain data that the Sheet adapter can safely consume. Issue #6 will add the
// separate lock/rollback boundary for the later writes.
function validateAndNormalizeTransactionInput_(form, referenceData) {
  if (!form || typeof form !== 'object' || Array.isArray(form)) {
    throw new Error('Transaction details are required.');
  }
  if (!referenceData || typeof referenceData !== 'object' || Array.isArray(referenceData)) {
    throw new Error('Transaction reference data is unavailable — please reopen the form.');
  }

  if (typeof form.type !== 'string') {
    throw new Error('Transaction type must be Income or Expense.');
  }
  var type = form.type.trim();
  if (['Income', 'Expense'].indexOf(type) === -1) {
    throw new Error('Transaction type must be Income or Expense.');
  }

  if (typeof form.date !== 'string') {
    throw new Error('Date must be a valid Toronto calendar date in YYYY-MM-DD format.');
  }
  var dateKey = form.date.trim();
  var dateParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!dateParts) {
    throw new Error('Date must be a valid Toronto calendar date in YYYY-MM-DD format.');
  }
  var year = Number(dateParts[1]);
  var month = Number(dateParts[2]);
  var day = Number(dateParts[3]);
  var leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  var monthLengths = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1000 || month < 1 || month > 12 || day < 1 || day > monthLengths[month - 1]) {
    throw new Error('Date must be a valid Toronto calendar date in YYYY-MM-DD format.');
  }

  var timeZone = String(referenceData.timeZone || '').trim();
  if (timeZone !== EXPECTED_TIMEZONE_) {
    throw new Error('Spreadsheet timezone must be ' + EXPECTED_TIMEZONE_ + ' before adding transactions.');
  }

  if (form.amount === '' || form.amount === null || typeof form.amount === 'undefined') {
    throw new Error('Amount is required.');
  }
  if (typeof form.amount !== 'string' && typeof form.amount !== 'number') {
    throw new Error('Amount must be a positive number.');
  }
  var amountText = typeof form.amount === 'string' ? form.amount.trim() : '';
  if (typeof form.amount === 'string' && !/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(amountText)) {
    throw new Error('Amount must be a positive decimal with no more than two decimal places.');
  }
  var amount = Number(typeof form.amount === 'string' ? amountText : form.amount);
  if (!isFinite(amount) || amount <= 0) {
    throw new Error('Amount must be a positive number.');
  }
  var rawCents = amount * 100;
  var amountCents = Math.round(rawCents);
  if (Math.abs(rawCents - amountCents) > 0.0000001) {
    throw new Error('Amount must use no more than two decimal places.');
  }
  if (Math.abs(amountCents) > 9007199254740991) {
    throw new Error('Amount is too large to represent safely in cents.');
  }
  amount = amountCents / 100;

  if (typeof form.subId !== 'string') throw new Error('Category is required.');
  var subId = form.subId.trim();
  if (!subId) throw new Error('Category is required.');
  var categories = Array.isArray(referenceData.categories) ? referenceData.categories : [];
  var category = categories.filter(function (candidate) {
    return candidate && candidate.subId === subId;
  })[0];
  if (!category) {
    throw new Error('Category is no longer active — please reopen the form.');
  }
  if (category.transactionType !== type) {
    throw new Error('Selected category does not match the transaction type — please choose again.');
  }
  if (!category.parentId || !category.subName) {
    throw new Error('Category configuration is incomplete — run Data Health Check before trying again.');
  }

  if (form.memberId !== null && typeof form.memberId !== 'undefined' && typeof form.memberId !== 'string') {
    throw new Error('Household member selection is invalid — please reopen the form.');
  }
  var memberId = String(form.memberId || '').trim();
  var members = Array.isArray(referenceData.members) ? referenceData.members : [];
  if (memberId) {
    var memberIsActive = members.some(function (member) {
      return member && member.id === memberId;
    });
    if (!memberIsActive) {
      throw new Error('Household member is no longer active — please reopen the form.');
    }
  }

  var accountId = String(referenceData.accountId || '').trim();
  if (!accountId) {
    throw new Error('No active account is available for this transaction.');
  }

  if (form.note !== null && typeof form.note !== 'undefined' && typeof form.note !== 'string') {
    throw new Error('Note must be text.');
  }

  return {
    dateKey: dateKey,
    timeZone: timeZone,
    type: type,
    amount: amount,
    amountCents: amountCents,
    subId: subId,
    memberId: memberId,
    note: String(form.note || '').trim(),
    accountId: accountId,
    category: {
      subId: category.subId,
      subName: category.subName,
      parentId: category.parentId,
      transactionType: category.transactionType,
      essentialDefault: category.essentialDefault || '',
      incomeStabilityDefault: category.incomeStabilityDefault || ''
    }
  };
}

function showAddTransactionDialog() {
  var template = HtmlService.createTemplateFromFile('AddTransactionDialog');
  template.members = getHouseholdMembersList_();
  template.categories = getCategoriesList_();
  var html = template.evaluate().setWidth(420).setHeight(480);
  SpreadsheetApp.getUi().showModalDialog(html, 'Add a transaction');
}
/**
 * Called from AddTransactionDialog.html via google.script.run.
 * form = { date, type, amount, subId, memberId, note }
 */
function addTransaction(form) {
  var input = validateAndNormalizeTransactionInput_(form, {
    categories: getCategoriesList_(),
    members: getHouseholdMembersList_(),
    accountId: getActiveAccountId_(),
    timeZone: getTz_()
  });
  // Parsed explicitly in the SPREADSHEET's own timezone (getTz_()),
  // not the Apps Script runtime's implicit one — the same class of fix
  // as getTz_()/monthKey_()/monthStartFromKey_() above. Previously this
  // was `new Date(form.date + 'T00:00:00')`, which is interpreted in
  // the runtime's own timezone; if that ever differs from the
  // spreadsheet's, a date entered near midnight could be saved and
  // later displayed one day off from what was actually typed. (Fixed
  // 2026-08-17, v0.0.17.)
  var date = Utilities.parseDate(input.dateKey, input.timeZone, 'yyyy-MM-dd');
  if (!(date instanceof Date) || isNaN(date.getTime()) || Utilities.formatDate(date, input.timeZone, 'yyyy-MM-dd') !== input.dateKey) {
    throw new Error('Date could not be represented safely in ' + input.timeZone + '.');
  }
  // Everything above is read-only validation/parsing. Issue #6 will place
  // the write section below under one lock with rollback; until then, keeping
  // every validation failure above this line guarantees zero Sheet changes.
  var batchId = getOrCreateManualBatch_(input.accountId);
  var txnSeq = nextSequence_('Transactions', 'Transaction_ID');
  var rawSeq = nextSequence_('Raw Transactions', 'Raw_Record_ID');
  var txnId = 'TXN-MANUAL-' + pad_(txnSeq, 6);
  var rawId = 'RAW-MANUAL-' + pad_(rawSeq, 6);
  var amount = input.amount;
  var cat = input.category;
  var note = input.note;
  var now = new Date();
  // Raw Transactions — every value placed by header name (see
  // rowFromHeaders_ above), so this still lands in the right columns
  // even if Raw Transactions' layout ever changes.
  var rawSheet = sheet_('Raw Transactions');
  rawSheet.appendRow(rowFromHeaders_('Raw Transactions', {
    Raw_Record_ID: rawId,
    Import_Batch_ID: batchId,
    Source_System: 'Manual entry (Add Transaction tool)',
    Account_ID: input.accountId,
    Imported_At: now,
    Raw_Transaction_Date: date,
    Raw_Type: input.type,
    Raw_Category: cat.subName,
    Raw_Description: note,
    Raw_Amount: amount,
    Raw_Currency: 'USD',
    Raw_Notes: note,
    Normalization_Status: 'Normalized'
  }));
  // Transactions — same header-name approach. Effective_Category_ID,
  // Effective_Subcategory_ID, and Duplicate_Key are formula columns, set
  // separately below once the row exists. Potential_Duplicate_Flag is
  // then derived for the full ledger by recomputePotentialDuplicateFlags_().
  var txSheet = sheet_('Transactions');
  var newRow = txSheet.getLastRow() + 1;
  var txRow = rowFromHeaders_('Transactions', {
    Transaction_ID: txnId,
    Raw_Record_ID: rawId,
    Import_Batch_ID: batchId,
    Account_ID: input.accountId,
    Member_ID: input.memberId, // blank = Joint/Shared
    Transaction_Date: date,
    Transaction_Type: input.type,
    Amount: amount,
    Currency: 'USD',
    Original_Description: note,
    Income_Stability: input.type === 'Income' ? (cat.incomeStabilityDefault || '') : '',
    Manual_Category_ID: cat.parentId,
    Manual_Subcategory_ID: cat.subId,
    Reviewed_Flag: 'Yes',
    Review_Status: 'Confirmed',
    Is_Duplicate: 'No', // reviewed manually as it's typed, not imported
    User_Notes: note,
    Created_At: now,
    Updated_At: now
  });
  txSheet.getRange(newRow, 1, 1, txRow.length).setValues([txRow]);
  // Calculated columns — same formulas used throughout the sheet,
  // written to whichever columns are CURRENTLY labeled for them (via
  // colLetter_) rather than hardcoded letters.
  var effCatCol = colLetter_('Transactions', 'Effective_Category_ID');
  var effSubCol = colLetter_('Transactions', 'Effective_Subcategory_ID');
  var manCatCol = colLetter_('Transactions', 'Manual_Category_ID');
  var manSubCol = colLetter_('Transactions', 'Manual_Subcategory_ID');
  var autoCatCol = colLetter_('Transactions', 'Auto_Category_ID');
  var autoSubCol = colLetter_('Transactions', 'Auto_Subcategory_ID');
  var dupKeyCol = colLetter_('Transactions', 'Duplicate_Key');
  var txDateCol = colLetter_('Transactions', 'Transaction_Date');
  var txAmountCol = colLetter_('Transactions', 'Amount');
  var txAcctCol = colLetter_('Transactions', 'Account_ID');
  var txTypeCol = colLetter_('Transactions', 'Transaction_Type');
  var txDescCol = colLetter_('Transactions', 'Original_Description');
  txSheet.getRange(effCatCol + newRow).setFormula('=IF(' + manCatCol + newRow + '<>"",' + manCatCol + newRow + ',' + autoCatCol + newRow + ')');
  txSheet.getRange(effSubCol + newRow).setFormula('=IF(' + manSubCol + newRow + '<>"",' + manSubCol + newRow + ',' + autoSubCol + newRow + ')');
  txSheet.getRange(dupKeyCol + newRow).setFormula(
    '=IF(' + txDateCol + newRow + '="","",LOWER(TEXT(' + txDateCol + newRow + ',"yyyymmdd")&"|"&TEXT(' + txAmountCol + newRow + ',"0.00")&"|"&' +
    txAcctCol + newRow + '&"|"&' + txTypeCol + newRow + '&"|"&TRIM(' + txDescCol + newRow + ')))'
  );
  recomputePotentialDuplicateFlags_();
  logChange_('Add Transaction', txnId + ': ' + input.type + ' $' + amount.toFixed(2) + ' (' + cat.subName + ') on ' + input.dateKey);
  refreshBudgetSummarySilently_(); // this transaction may change NET / Household Safety Number / Dashboard Fixed & Variable Income
  return { ok: true, message: 'Added ' + input.type.toLowerCase() + ' of $' + amount.toFixed(2) + ' (' + cat.subName + ').' };
}
// ========================= ADD CATEGORY ==============================
function showAddCategoryDialog() {
  var template = HtmlService.createTemplateFromFile('AddCategoryDialog');
  template.topLevel = getTopLevelCategoriesList_();
  var html = template.evaluate().setWidth(420).setHeight(500);
  SpreadsheetApp.getUi().showModalDialog(html, 'Add a category');
}
/**
 * form = { name, type, parentId, newGroupName, essential, incomeStability, monthlyBudget }
 */
function addCategory(form) {
  if (!form.name || !form.type) throw new Error('Please fill in a name and choose Income or Expense.');
  var catSheet = sheet_('Categories');
  var existing = readTable_('Categories');
  var existingIds = existing.map(function (c) { return c.Category_ID; });
  var maxSort = existing.reduce(function (m, c) { return Math.max(m, Number(c.Sort_Order) || 0); }, 0);
  var parentId = form.parentId;
  // Income only ever has one top-level bucket, and its real Category_ID in
  // the live Categories sheet is the bare string "INCOME" — NOT "CAT-INCOME".
  // Every top-level Expense category uses a "CAT-" prefix (CAT-TRANSPORT,
  // CAT-SUBSCRIPTIONS, etc.), but Income is a documented one-off exception to
  // that naming convention, not an inconsistency to "fix". v0.0.17 (2026-08-17)
  // incorrectly changed this to 'CAT-INCOME' based on legacy Transaction rows'
  // Auto_Category_ID/Effective_Category_ID fields, which turned out to be an
  // orphaned/incorrect reference from the original 2026-08-16 migration, not
  // proof of a real Categories-table ID. Confirmed directly against the live
  // Categories sheet on 2026-08-17 (v0.0.19): row for Income has
  // Category_ID = "INCOME", and its real subcategories all reference
  // Parent_Category_ID = "INCOME". Reverted here — see v0.0.19 release notes.
  if (form.type === 'Income') {
    parentId = 'INCOME';
  } else if (form.parentId === '__new__') {
    if (!form.newGroupName) throw new Error('Please name the new category group.');
    var newTopId = uniqueId_('CAT-' + slug_(form.newGroupName), existingIds);
    maxSort += 10;
    catSheet.appendRow(rowFromHeaders_('Categories', {
      Category_ID: newTopId,
      Parent_Category_ID: '',
      Record_Type: 'Category',
      Category_Name: form.newGroupName,
      Transaction_Type: 'Expense',
      Essential_Default: 'N',
      Income_Stability_Default: '',
      Active_Flag: 'Yes',
      Legacy_Budget_Label: form.newGroupName,
      Sort_Order: maxSort
    }));
    existingIds.push(newTopId);
    parentId = newTopId;
  }
  if (!parentId) throw new Error('Please choose a category group.');
  var parentSlug = String(parentId).replace(/^CAT-/, '');
  var subId = uniqueId_('SUB-' + parentSlug + '-' + slug_(form.name), existingIds);
  var row = rowFromHeaders_('Categories', {
    Category_ID: subId,
    Parent_Category_ID: parentId,
    Record_Type: 'Subcategory',
    Category_Name: form.name,
    Transaction_Type: form.type,
    Essential_Default: form.type === 'Expense' ? (form.essential || 'N') : 'N',
    Income_Stability_Default: form.type === 'Income' ? (form.incomeStability || 'Fixed') : '',
    Active_Flag: 'Yes',
    Legacy_Budget_Label: form.name,
    Sort_Order: maxSort + 1
  });
  catSheet.appendRow(row);
  var message = 'Added category "' + form.name + '".';
  // Add it as a real line on the Budget page (and Dashboard, for expenses) —
  // inserted so the existing Total/SUM formulas automatically expand to
  // include it, rather than needing anyone to edit those formulas by hand.
  var budgetRow = insertBudgetRow_(form.type, form.name, form.essential, form.incomeStability, subId);
  if (form.type === 'Expense') {
    addDashboardRow_(form.name, budgetRow, subId);
  }
  message += ' It now appears on the Budget page' + (form.type === 'Expense' ? ' and Dashboard' : '') + '.';
  // Optional: also seed a Budget Plan row for the currently-selected Budget month.
  var budgetAmount = Number(form.monthlyBudget);
  if (form.monthlyBudget && isFinite(budgetAmount) && budgetAmount > 0) {
    var budgetMonth = sheet_('Budget').getRange('B2').getValue();
    var bpSheet = sheet_('Budget Plan');
    var bpExisting = readTable_('Budget Plan');
    var bpSeq = bpExisting.reduce(function (m, r) {
      var mm = String(r.Budget_ID || '').match(/(\d+)\s*$/);
      return mm ? Math.max(m, parseInt(mm[1], 10)) : m;
    }, 0) + 1;
    var monthTag = Utilities.formatDate(budgetMonth, getTz_(), 'yyyyMM');
    bpSheet.appendRow(rowFromHeaders_('Budget Plan', {
      Budget_ID: 'BUD-' + monthTag + '-' + pad_(bpSeq, 3),
      Month_Start: budgetMonth,
      Member_ID: '',
      Account_ID: '',
      Transaction_Type: form.type,
      Subcategory_ID: subId,
      Budgeted_Amount: budgetAmount,
      Essential_Flag: form.type === 'Expense' ? (form.essential || 'N') : 'N',
      Income_Stability: form.type === 'Income' ? (form.incomeStability || 'Fixed') : '',
      Notes: 'Added via Add Category tool.',
      Active_Flag: 'Yes'
    }));
    message += ' Budgeted $' + budgetAmount.toFixed(2) + ' for this month.';
  } else {
    message += ' Set a budget for it (on the Budget Plan sheet, or next time via the monthly-budget field here) to see it counted in totals.';
  }
  logChange_('Add Category', subId + ' "' + form.name + '" (' + form.type + ')');
  refreshBudgetSummarySilently_(); // a new Fixed/Variable income or Essential expense category should count immediately, not just after its first transaction
  return { ok: true, message: message };
}
// Finds the row whose value in `col` (1 = A, default) is exactly `label`.
function findRowByLabel_(sheet, label, col) {
  col = col || 1;
  var vals = sheet.getRange(1, col, 200, 1).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (vals[i][0] === label) return i + 1;
  }
  throw new Error('Could not find a row labeled "' + label + '" on the ' + sheet.getName() + ' sheet — its layout may have changed.');
}
// Builds a live formula that pulls a category's current name straight off
// the Categories sheet by Subcategory_ID, instead of ever storing the name
// as static text. `idCellRef` is the A1 reference (on whichever sheet the
// formula is being written into) holding that row's Subcategory_ID — e.g.
// "$E12" on Budget or "$G12" on Dashboard. Falls back to showing the raw
// ID (rather than going blank) if the ID doesn't match anything, so a
// data problem stays visible instead of disappearing silently.
function liveCategoryNameFormula_(idCellRef) {
  return '=IFERROR(INDEX(Categories!$D$5:$D$1000,MATCH(' + idCellRef + ',Categories!$A$5:$A$1000,0)),' + idCellRef + ')';
}
/**
 * Inserts a new category line into the Budget sheet, positioned so the
 * existing "Total Income" / "Total Expenses" SUM (and the "of which
 * Essential" SUMIFS) automatically expand to include it — the same as
 * if you'd right-clicked a row just above the Total row and chosen
 * "Insert row above" by hand. Returns the row number the new line ends
 * up on.
 *
 * Budgeted (C) and Actual (D) are deliberately left blank here — as of
 * v0.0.22, Budget's entire Budgeted/Actual matrix is computed by
 * recomputeBudgetSummaryMetrics_() below (no more per-cell SUMIFS text
 * written at insert time, so there's no longer a "this formula predates
 * the last bug fix" gap to worry about), and every caller of this
 * function already triggers a refresh right after via
 * refreshBudgetSummarySilently_(), so the blank cells get filled with
 * real numbers immediately.
 */
function insertBudgetRow_(type, name, essential, incomeStability, subId) {
  var sh = sheet_('Budget');
  var totalLabel = type === 'Income' ? 'Total Income' : 'Total Expenses';
  var totalRow = findRowByLabel_(sh, totalLabel);
  var lastCategoryRow = totalRow - 1; // e.g. "Savings & Other" today
  sh.insertRowBefore(lastCategoryRow);
  var newRow = lastCategoryRow; // the new blank row now sits here
  // Copy formatting from the row above so the new line matches (borders,
  // number formats, etc.) — cosmetic only, safe to skip if it fails.
  try {
    sh.getRange(newRow - 1, 1, 1, 5).copyFormatToRange(sh, 1, 5, newRow, newRow);
  } catch (e) { /* formatting is best-effort */ }
  // E (Subcategory_ID) is set first, since A's formula reads it back.
  sh.getRange('E' + newRow).setValue(subId);
  sh.getRange('A' + newRow).setFormula(liveCategoryNameFormula_('$E' + newRow));
  sh.getRange('B' + newRow).setValue(type === 'Expense' ? (essential || 'N') : (incomeStability || 'Fixed'));
  return newRow;
}
/**
 * Adds a matching line to the Dashboard "Expense Categories: Budgeted vs
 * Actual" table. The name is pulled live from Categories by Subcategory_ID
 * (stored in a hidden helper column, G) rather than proxied through
 * Budget!A's row position — Budget and Dashboard don't always insert new
 * categories at matching row numbers (Budget inserts right above "Savings
 * & Other"; Dashboard appends at the end of its own list), so an ID-based
 * lookup is what actually stays correct as more categories get added.
 *
 * Budgeted/Actual/Remaining (C/D/E) are deliberately left blank here — as
 * of v0.0.22 these are computed by recomputeBudgetSummaryMetrics_() below
 * (mirrored from Budget by Subcategory_ID, not by row position — see the
 * same function), and every caller already triggers a refresh right
 * after, so the blank cells get filled with real numbers immediately.
 * `budgetRow` is unused now (kept so existing call sites don't need to
 * change) — Budgeted/Actual no longer reference Budget's row at all,
 * live or otherwise.
 */
function addDashboardRow_(name, budgetRow, subId) {
  var sh = sheet_('Dashboard');
  // First blank row in column B at/after row 6 is where the category list ends.
  var col = sh.getRange('B6:B40').getValues();
  var insertAt = null;
  for (var i = 0; i < col.length; i++) {
    if (col[i][0] === '' || col[i][0] === null) { insertAt = i + 6; break; }
  }
  if (!insertAt) throw new Error('Could not find the end of the category list on Dashboard — its layout may have changed.');
  sh.insertRowBefore(insertAt);
  var newRow = insertAt;
  try {
    sh.getRange(newRow - 1, 2, 1, 4).copyFormatToRange(sh, 2, 5, newRow, newRow);
  } catch (e) { /* formatting is best-effort */ }
  sh.getRange('G' + newRow).setValue(subId); // hidden helper column, see syncCategoryNames() below
  sh.getRange('B' + newRow).setFormula(liveCategoryNameFormula_('$G' + newRow));
}
// ======= BUDGET, DASHBOARD & INCOME HISTORY ENGINE (script-computed) =======
// v0.0.22 — per Jonathan's direction ("no more hardcoding into excel, all
// logic through the script"), this function grew from owning a handful of
// narrative cells (NET, Household Safety Number, ...) to owning the ENTIRE
// numeric surface of Budget, Dashboard, and Income History. The 2026-08-18
// full-formula audit found that every earlier fix in this area (v0.0.20's
// date-match correction, v0.0.21's metrics migration) could only ever apply
// GOING FORWARD — neither could reach back and repair a formula already
// sitting in a cell — which is exactly why two supposedly-fixed spots were
// still silently wrong: Budget!C6/C7/C10 were still running the pre-v0.0.20
// exact-date-match SUMIFS (written before that fix existed), and every
// category present since the original migration was still reading
// Transactions through a range hardcoded to rows 5:33 — about 6 more real
// transactions from silently freezing. A formula's range bound is baked
// into the cell at write-time; only a script recompute using
// getLastRow()-based reads (readTable_(), used throughout below) is immune
// to that failure class, because it can't go stale — it re-reads the whole
// table fresh every single run.
//
// v0.0.23 split this into two layers, per Jonathan's request to incorporate
// both ideas raised alongside the v0.0.22 delivery:
//   1. A PURE COMPUTE LAYER (calcBudgetSummary_(), calcIncomeHistory_(),
//      groupAmountsByKey_(), groupIncomeTxByMonth_(), all just below) that
//      takes plain JS data in and returns plain JS data out — zero
//      SpreadsheetApp calls anywhere inside. This is the actual "budget
//      math" (sum a category's spend for a month, roll up totals, compute
//      a 3-month average), separated from reading it off a sheet and
//      writing it back to one. It's the layer that ports over almost
//      unchanged whenever this project eventually becomes a real app
//      backend — same inputs, same outputs, wherever they come from.
//   2. A thin I/O layer (recomputeBudgetSummaryMetrics_(),
//      recomputeIncomeHistory_()) that only reads ranges into plain
//      objects, calls the pure layer, and writes the result back. If a
//      future bug ever shows up in "the math," it can be reasoned about
//      (and even unit-tested, if this project ever gets a test runner)
//      without touching a single getRange()/setValue() call.
// Also new in v0.0.23: a one-cell freshness indicator (updateFreshnessIndicator_()
// below) written to Budget!E2 and Dashboard!F2 every time this runs —
// green "✓ Refreshed Xm ago" or red "⚠ Stale", visible right where
// Jonathan/Bianca are already looking, not just buried in Show Version &
// Diagnostics.
//
// How it works: Budget Plan and Transactions are each read ONCE per run via
// readTable_() (no row cap of any kind) and grouped into plain JS lookup
// maps keyed by "Transaction_Type||Subcategory_ID" — turning what used to
// be dozens of separate per-category SUMIFS scans into a single pass over
// each table plus O(1) map lookups per category, the efficient script-side
// equivalent of the old formula fan-out. Every value is then written with
// setValue()/setValues() (batched where the cells are contiguous) instead
// of a spreadsheet formula, so there is no cell reference or range bound
// left anywhere in this surface that can go stale as categories are added.
//
// Cells this owns (Budget and Dashboard are both irregular-layout sheets
// addressed by label + a small number of documented fixed columns — see
// the COLUMN LOOKUPS note at the top of this file):
//   Budget!C6:D10, C16:D33 — every category's Budgeted (C) and Actual (D)
//   Budget!C11/D11         — Total Income
//   Budget!C34/D34         — Total Expenses
//   Budget!C35/D35         — of which Essential
//   Budget!C37/D37         — NET (Income - Expenses)
//   Budget!C41:C43         — Income vs Expenses recap
//   Budget!C48:C50         — Household Safety Number
//   Budget!C12             — Suggested variable income estimate (3-mo avg,
//                             conservative) — the current Budget!B2 month's
//                             row from Income History's own 3-Mo Avg
//                             (Variable) column, computed below
//   Budget!E2               — Data freshness indicator (v0.0.23)
//   Dashboard!C6:E<last>   — per-category Budgeted/Actual/Remaining mirror,
//                             matched to Budget by Subcategory_ID (column
//                             G), not row position — Budget and Dashboard
//                             don't insert new categories at matching rows
//   Dashboard!C27:C32      — Fixed/Variable Income (Actual), Total
//                             Income/Expenses (Actual), Net (Actual),
//                             Savings Rate. The last four used to be a
//                             formula chain reading through cells this
//                             function already writes (e.g.
//                             "=Budget!D11") — now written directly, one
//                             less place for the two sheets to disagree
//                             (closes audit Finding 5a).
//   Dashboard!F2            — Data freshness indicator (v0.0.23)
//   Income History!B5:D<last> — every month's Fixed/Variable Income
//                             (Actual) and 3-Mo Avg (Variable), via
//                             recomputeIncomeHistory_() below, except the
//                             one row explicitly marked "Preserved from
//                             original workbook" in its Notes column — that
//                             row (November 2025) predates the Transactions
//                             ledger and has nothing to derive it from.
//
// Deliberately NOT converted to script-computed values: Transactions' own
// row-level helper formulas (Effective_Category_ID/Subcategory_ID,
// Duplicate_Key, Potential_Duplicate_Flag) and the Categories-lookup name
// formulas (Budget!A, Dashboard!B, via liveCategoryNameFormula_). Both
// reference only their own row or an already-generously-capped lookup
// range — neither is the hardcoded-range-silently-drops-data failure class
// this migration exists to close — and converting them would trade an
// instant update (re-categorizing a transaction by hand takes effect
// immediately today) for a staleness window, for no bug-safety benefit.
//
// Runs automatically at the end of every tool that can change these
// numbers (Add Transaction, Add Shift, Add Category, Monthly Budget
// Sit-Down, Jump to Current Month — see refreshBudgetSummarySilently_()
// calls throughout this file) and on open, plus on a scheduled trigger
// (setupScheduledBudgetRefresh() below) once enabled — and on demand via
// the "Refresh Budget Summary" menu item, for after any hand-edit made
// directly in Transactions/Budget Plan/Budget outside the tools. Show
// Version & Diagnostics reports how long ago it last ran, so a gap is
// visible instead of silent — and now, so does the sheet itself.
//
// Dashboard!C33 ("Fixed-Income Coverage Gap (Budgeted)" — Finding 4, an
// exact duplicate of Net (Actual) one row up, neither fixed-income-
// specific nor budgeted) is cleared here rather than migrated, per
// Jonathan's call — see project docs for the full discussion.
var BUDGET_SUMMARY_LAST_RUN_PROP_ = 'BUDGET_SUMMARY_LAST_RUN';

// ------------------------- PURE COMPUTE LAYER --------------------------
// Everything from here down to "END PURE COMPUTE LAYER" takes plain
// JS objects/arrays in and returns plain JS objects/arrays out. No
// sheet_()/getRange()/setValue() calls anywhere in this section — see the
// v0.0.23 note above for why that boundary is deliberate. monthKey_() /
// sameMonth_() (defined elsewhere in this file) are the one exception:
// they're pure/deterministic given their inputs (just date-string
// formatting via Utilities, no Sheet reads), so they're safe to lean on
// here the same way any other utility function would be.

// Groups Budget Plan's Budgeted_Amount and Transactions' Amount by
// "Type||Subcategory_ID", scoped to whichever calendar month `monthStart`
// falls in. Takes the plain-object arrays readTable_() already returns —
// this is the O(1)-lookup-per-category grouping step described above.
function groupAmountsByKey_(budgetPlanRows, transactionRows, monthStart, tz) {
  var budgetedByKey = {};
  budgetPlanRows.forEach(function (r) {
    if (r.Active_Flag !== 'Yes') return;
    if (!(r.Month_Start instanceof Date) || !sameMonth_(r.Month_Start, monthStart, tz)) return;
    var key = r.Transaction_Type + '||' + r.Subcategory_ID;
    budgetedByKey[key] = (budgetedByKey[key] || 0) + (Number(r.Budgeted_Amount) || 0);
  });
  var actualByKey = {};
  transactionRows.forEach(function (t) {
    if (t.Is_Duplicate !== 'No') return;
    if (!(t.Transaction_Date instanceof Date) || !sameMonth_(t.Transaction_Date, monthStart, tz)) return;
    var key = t.Transaction_Type + '||' + t.Effective_Subcategory_ID;
    actualByKey[key] = (actualByKey[key] || 0) + (Number(t.Amount) || 0);
  });
  return { budgetedByKey: budgetedByKey, actualByKey: actualByKey };
}

// Groups Transactions' Income rows by calendar month and Income_Stability
// (Fixed vs Variable) — the input recomputeIncomeHistory_() below needs.
function groupIncomeTxByMonth_(transactionRows, tz) {
  var incomeTxByMonth = {};
  transactionRows.forEach(function (t) {
    if (t.Transaction_Type !== 'Income' || t.Is_Duplicate !== 'No') return;
    if (!(t.Transaction_Date instanceof Date)) return;
    var key = monthKey_(t.Transaction_Date, tz);
    var bucket = incomeTxByMonth[key] || (incomeTxByMonth[key] = { Fixed: 0, Variable: 0 });
    var amt = Number(t.Amount) || 0;
    if (t.Income_Stability === 'Fixed') bucket.Fixed += amt;
    else if (t.Income_Stability === 'Variable') bucket.Variable += amt;
  });
  return incomeTxByMonth;
}

/**
 * The actual "budget math" — every derived number Budget/Dashboard shows,
 * computed from plain inputs with no idea where they came from or where
 * they're going.
 * @param {Object} input
 * @param {Array<{type:string,subId:string}>} input.incomeRows - Budget's income section, in row order (type: "Fixed"/"Variable")
 * @param {Array<{essential:string,subId:string}>} input.expenseRows - Budget's expense section, in row order (essential: "Y"/"N")
 * @param {Array<string>} input.dashboardSubIds - Dashboard's category mirror, in row order
 * @param {Object} input.budgetedByKey - {"Type||SubId": amount}, from groupAmountsByKey_()
 * @param {Object} input.actualByKey - {"Type||SubId": amount}, from groupAmountsByKey_()
 * @returns {Object} every figure the I/O layer below writes to a cell
 */
function calcBudgetSummary_(input) {
  var income = [];
  var totalIncomeBudgeted = 0, totalIncomeActual = 0;
  var fixedIncomeActual = 0, variableIncomeActual = 0;
  input.incomeRows.forEach(function (row) {
    var budgeted = input.budgetedByKey['Income||' + row.subId] || 0;
    var actual = input.actualByKey['Income||' + row.subId] || 0;
    income.push({ budgeted: budgeted, actual: actual });
    totalIncomeBudgeted += budgeted;
    totalIncomeActual += actual;
    if (row.type === 'Fixed') fixedIncomeActual += actual;
    else if (row.type === 'Variable') variableIncomeActual += actual;
  });

  var expense = [];
  var totalExpenseBudgeted = 0, totalExpenseActual = 0;
  var essentialExpenseBudgeted = 0, essentialExpenseActual = 0;
  var expenseBySubId = {};
  input.expenseRows.forEach(function (row) {
    var budgeted = input.budgetedByKey['Expense||' + row.subId] || 0;
    var actual = input.actualByKey['Expense||' + row.subId] || 0;
    expense.push({ budgeted: budgeted, actual: actual });
    totalExpenseBudgeted += budgeted;
    totalExpenseActual += actual;
    if (row.essential === 'Y') { essentialExpenseBudgeted += budgeted; essentialExpenseActual += actual; }
    expenseBySubId[row.subId] = { budgeted: budgeted, actual: actual };
  });

  var netActual = totalIncomeActual - totalExpenseActual;
  var dashboardCategories = input.dashboardSubIds.map(function (subId) {
    var entry = expenseBySubId[subId] || { budgeted: 0, actual: 0 };
    return { budgeted: entry.budgeted, actual: entry.actual, remaining: entry.budgeted - entry.actual };
  });

  return {
    income: income,
    expense: expense,
    totals: {
      totalIncomeBudgeted: totalIncomeBudgeted, totalIncomeActual: totalIncomeActual,
      totalExpenseBudgeted: totalExpenseBudgeted, totalExpenseActual: totalExpenseActual,
      essentialExpenseBudgeted: essentialExpenseBudgeted, essentialExpenseActual: essentialExpenseActual,
      fixedIncomeActual: fixedIncomeActual, variableIncomeActual: variableIncomeActual
    },
    net: { budgeted: totalIncomeBudgeted - totalExpenseBudgeted, actual: netActual },
    // "Coverage Gap (Income vs Expenses)" and the Household Safety Number's
    // own "Coverage Gap" are the same Income-minus-Expenses figure reused
    // by two different sections on Budget — computed once here.
    coverageGapActual: netActual,
    householdCoverageGap: fixedIncomeActual - essentialExpenseActual,
    expenseBySubId: expenseBySubId,
    dashboardCategories: dashboardCategories,
    dashboardSummary: {
      totalIncomeActual: totalIncomeActual,
      totalExpenseActual: totalExpenseActual,
      netActual: netActual,
      savingsRate: totalIncomeActual ? (netActual / totalIncomeActual) : 0
    }
  };
}

/**
 * Income History's month-by-month math: which rows get recomputed from
 * Transactions vs. preserved as-is, and the sliding 3-month Variable-
 * income average (mirroring the sheet's own original AVERAGEIF(...,">0")
 * windowing exactly — this row plus up to the two immediately above it,
 * $0 months excluded from the average).
 * @param {Array<{month:Date,notes:string,fixedActual:number,variableActual:number}>} rows - Income History, in row order
 * @param {Object} incomeTxByMonth - {"yyyy-MM": {Fixed, Variable}}, from groupIncomeTxByMonth_()
 * @param {string} tz - spreadsheet timezone, for month-key formatting
 * @returns {{perRow: Array<{fixed:number,variable:number,avg:number}>, byMonthKey: Object}}
 */
function calcIncomeHistory_(rows, incomeTxByMonth, tz) {
  var finalFixed = [], finalVariable = [];
  rows.forEach(function (r) {
    var preserved = String(r.notes || '').indexOf('Preserved') !== -1;
    if (preserved || !(r.month instanceof Date)) {
      finalFixed.push(Number(r.fixedActual) || 0);
      finalVariable.push(Number(r.variableActual) || 0);
      return;
    }
    var bucket = incomeTxByMonth[monthKey_(r.month, tz)] || { Fixed: 0, Variable: 0 };
    finalFixed.push(bucket.Fixed);
    finalVariable.push(bucket.Variable);
  });

  var perRow = [];
  var byMonthKey = {};
  for (var i = 0; i < rows.length; i++) {
    var windowVals = finalVariable.slice(Math.max(0, i - 2), i + 1).filter(function (v) { return v > 0; });
    var avg = windowVals.length ? windowVals.reduce(function (a, b) { return a + b; }, 0) / windowVals.length : 0;
    perRow.push({ fixed: finalFixed[i], variable: finalVariable[i], avg: avg });
    if (rows[i].month instanceof Date) {
      byMonthKey[monthKey_(rows[i].month, tz)] = { fixed: finalFixed[i], variable: finalVariable[i], avg: avg };
    }
  }
  return { perRow: perRow, byMonthKey: byMonthKey };
}
// ----------------------- END PURE COMPUTE LAYER -------------------------

// ------------------------- FRESHNESS INDICATOR --------------------------
// One-cell status badge, always visible on Budget!E2 and Dashboard!F2 (see
// the v0.0.23 note above) — updated at the end of every
// recomputeBudgetSummaryMetrics_() run, so it's never more stale than the
// numbers it's describing. Same >24h staleness threshold Show Version &
// Diagnostics already uses.
var FRESHNESS_STALE_HOURS_ = 24;
var FRESHNESS_FRESH_BG_ = '#d9ead3';   // light green
var FRESHNESS_FRESH_FG_ = '#274e13';
var FRESHNESS_STALE_BG_ = '#f4cccc';   // light red
var FRESHNESS_STALE_FG_ = '#990000';

// Human-friendly "how long ago," e.g. "3m ago" / "2 hours ago" / "5 days ago".
function relativeTimeAgo_(date) {
  var mins = Math.round((new Date().getTime() - date.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + (mins === 1 ? ' min ago' : ' mins ago');
  var hours = Math.round(mins / 60);
  if (hours < 24) return hours + (hours === 1 ? ' hour ago' : ' hours ago');
  var days = Math.round(hours / 24);
  return days + (days === 1 ? ' day ago' : ' days ago');
}

function updateFreshnessIndicator_() {
  var lastRunIso = PropertiesService.getScriptProperties().getProperty(BUDGET_SUMMARY_LAST_RUN_PROP_);
  var text, bg, fg;
  if (!lastRunIso) {
    text = '⚠ Never refreshed — run "Refresh Budget Summary"';
    bg = FRESHNESS_STALE_BG_; fg = FRESHNESS_STALE_FG_;
  } else {
    var lastRun = new Date(lastRunIso);
    var hoursAgo = (new Date().getTime() - lastRun.getTime()) / 3600000;
    if (hoursAgo > FRESHNESS_STALE_HOURS_) {
      text = '⚠ Stale — refreshed ' + relativeTimeAgo_(lastRun);
      bg = FRESHNESS_STALE_BG_; fg = FRESHNESS_STALE_FG_;
    } else {
      text = '✓ Refreshed ' + relativeTimeAgo_(lastRun);
      bg = FRESHNESS_FRESH_BG_; fg = FRESHNESS_FRESH_FG_;
    }
  }
  // Best-effort, one sheet at a time — a formatting failure on one sheet
  // (e.g. a cell that's part of an unexpected merge) shouldn't stop the
  // other one from updating.
  try {
    sheet_('Budget').getRange('E2').setValue(text).setBackground(bg).setFontColor(fg)
      .setFontSize(9).setHorizontalAlignment('left');
  } catch (e) { /* best-effort */ }
  try {
    sheet_('Dashboard').getRange('F2').setValue(text).setBackground(bg).setFontColor(fg)
      .setFontSize(9).setHorizontalAlignment('left');
  } catch (e) { /* best-effort */ }
}
// ----------------------- END FRESHNESS INDICATOR -------------------------

// --------------------------- I/O LAYER -----------------------------------
// Reads Budget/Dashboard/Budget Plan/Transactions into plain objects,
// hands them to the pure compute layer above, and writes the result back.
// This function itself does no math — see calcBudgetSummary_() above for
// that; everything here is getRange()/setValue() plumbing.
function recomputeBudgetSummaryMetrics_() {
  var budget = sheet_('Budget');
  var dash = sheet_('Dashboard');
  var tz = getTz_();

  // --- Locate every section anchor by label, not by hardcoded row
  // number, so this stays correct as categories get added. ---
  var incomeHeaderRow = findRowByLabel_(budget, 'Source');
  var totalIncomeRow = findRowByLabel_(budget, 'Total Income');
  var expenseHeaderRow = findRowByLabel_(budget, 'Category');
  var totalExpenseRow = findRowByLabel_(budget, 'Total Expenses');
  var essentialRow = findRowByLabel_(budget, '  of which Essential');

  // --- The month Budget is currently showing (Budget!B2) — every
  // Budgeted/Actual figure below is scoped to this one calendar month,
  // same as the formulas it replaces. ---
  var budgetMonthVal = budget.getRange('B2').getValue();
  var monthStart = (budgetMonthVal instanceof Date)
    ? monthStartFromKey_(monthKey_(budgetMonthVal, tz), tz)
    : monthStartFromKey_(monthKey_(new Date(), tz), tz);

  // --- READ: pull raw sheet data into plain objects (I/O only). ---
  var incomeRows = [];
  for (var ir = incomeHeaderRow + 1; ir < totalIncomeRow; ir++) {
    incomeRows.push({
      type: String(budget.getRange(ir, 2).getValue() || '').trim(),
      subId: budget.getRange(ir, 5).getValue()
    });
  }
  var expenseRows = [];
  for (var er = expenseHeaderRow + 1; er < totalExpenseRow; er++) {
    expenseRows.push({
      essential: String(budget.getRange(er, 2).getValue() || '').trim(),
      subId: budget.getRange(er, 5).getValue()
    });
  }
  var dashCatCol = dash.getRange('B6:G40').getValues();
  var dashboardSubIds = [];
  for (var di = 0; di < dashCatCol.length; di++) {
    if (dashCatCol[di][0] === '' || dashCatCol[di][0] === null) break;
    dashboardSubIds.push(dashCatCol[di][5]); // column G
  }
  var grouped = groupAmountsByKey_(readTable_('Budget Plan'), readTable_('Transactions'), monthStart, tz);

  // --- COMPUTE: pure function, no sheet calls (see above). ---
  var result = calcBudgetSummary_({
    incomeRows: incomeRows,
    expenseRows: expenseRows,
    dashboardSubIds: dashboardSubIds,
    budgetedByKey: grouped.budgetedByKey,
    actualByKey: grouped.actualByKey
  });

  // --- WRITE: everything below is I/O only. ---
  if (result.income.length) {
    budget.getRange(incomeHeaderRow + 1, 3, result.income.length, 2)
      .setValues(result.income.map(function (r) { return [r.budgeted, r.actual]; }));
  }
  if (result.expense.length) {
    budget.getRange(expenseHeaderRow + 1, 3, result.expense.length, 2)
      .setValues(result.expense.map(function (r) { return [r.budgeted, r.actual]; }));
  }
  budget.getRange(totalIncomeRow, 3, 1, 2).setValues([[result.totals.totalIncomeBudgeted, result.totals.totalIncomeActual]]);
  budget.getRange(totalExpenseRow, 3, 1, 2).setValues([[result.totals.totalExpenseBudgeted, result.totals.totalExpenseActual]]);
  budget.getRange(essentialRow, 3, 1, 2).setValues([[result.totals.essentialExpenseBudgeted, result.totals.essentialExpenseActual]]);

  var netRow = findRowByLabel_(budget, 'NET (Income - Expenses)');
  budget.getRange(netRow, 3, 1, 2).setValues([[result.net.budgeted, result.net.actual]]);

  // "Coverage Gap (Income vs Expenses)" is the row immediately below
  // "Total Expenses (Actual)" in this section — anchored off that unique
  // label rather than the gap's own label text, which (by the original
  // template's own design) is reused verbatim by the Household Safety
  // Number section below and so can't be searched for directly via
  // findRowByLabel_ (it would always resolve to the first, wrong, match).
  var totalExpenseActualLabelRow = findRowByLabel_(budget, 'Total Expenses (Actual)');
  budget.getRange(findRowByLabel_(budget, 'Total Income (Actual)'), 3).setValue(result.totals.totalIncomeActual);
  budget.getRange(totalExpenseActualLabelRow, 3).setValue(result.totals.totalExpenseActual);
  budget.getRange(totalExpenseActualLabelRow + 1, 3).setValue(result.coverageGapActual);

  // Household Safety Number, anchored off its own unique question labels,
  // not the (also reused) "Coverage Gap" text, for the same reason as above.
  var madeRow = findRowByLabel_(budget, 'How much has Jonathan 1 made?');
  budget.getRange(findRowByLabel_(budget, 'How much have we spent so far?'), 3).setValue(result.totals.essentialExpenseActual);
  budget.getRange(madeRow, 3).setValue(result.totals.fixedIncomeActual);
  budget.getRange(madeRow + 1, 3).setValue(result.householdCoverageGap);

  dash.getRange(findRowByLabel_(dash, 'Fixed Income (Actual)', 2), 3).setValue(result.totals.fixedIncomeActual);
  dash.getRange(findRowByLabel_(dash, 'Variable Income (Actual)', 2), 3).setValue(result.totals.variableIncomeActual);
  dash.getRange(findRowByLabel_(dash, 'Total Income (Actual)', 2), 3).setValue(result.dashboardSummary.totalIncomeActual);
  dash.getRange(findRowByLabel_(dash, 'Total Expenses (Actual)', 2), 3).setValue(result.dashboardSummary.totalExpenseActual);
  dash.getRange(findRowByLabel_(dash, 'Net (Actual)', 2), 3).setValue(result.dashboardSummary.netActual);
  dash.getRange(findRowByLabel_(dash, 'Savings Rate', 2), 3).setValue(result.dashboardSummary.savingsRate);

  if (result.dashboardCategories.length) {
    dash.getRange(6, 3, result.dashboardCategories.length, 3)
      .setValues(result.dashboardCategories.map(function (r) { return [r.budgeted, r.actual, r.remaining]; }));
  }

  // Dashboard!C33 (Finding 4) — cleared, not migrated. See the comment
  // block above this function for why. Wrapped in try/catch since it's
  // already gone after the first successful run.
  try {
    var staleGapRow = findRowByLabel_(dash, 'Fixed-Income Coverage Gap (Budgeted)', 2);
    dash.getRange(staleGapRow, 2, 1, 2).clearContent();
  } catch (e) {
    // Already cleared in a prior run — nothing to do.
  }

  // Income History (its own full month-by-month recompute), then
  // Budget!C12's "Suggested variable income estimate" — a direct lookup
  // into the map recomputeIncomeHistory_() just built.
  var ihResult = recomputeIncomeHistory_();
  var suggestedRow = findRowByLabel_(budget, 'Suggested variable income estimate (3-mo avg, conservative)');
  var monthData = ihResult.byMonthKey[monthKey_(monthStart, tz)];
  budget.getRange(suggestedRow, 3).setValue(monthData ? monthData.avg : 0);

  PropertiesService.getScriptProperties().setProperty(BUDGET_SUMMARY_LAST_RUN_PROP_, new Date().toISOString());
  updateFreshnessIndicator_();
}

// I/O wrapper around calcIncomeHistory_() above — reads Income History and
// Transactions into plain objects, calls the pure function, writes the
// result back. Returns { byMonthKey: { 'yyyy-MM': {fixed, variable, avg} } }
// so recomputeBudgetSummaryMetrics_() above can look up Budget!C12's value
// for the current Budget!B2 month without a second pass over this sheet.
function recomputeIncomeHistory_() {
  var sh = sheet_('Income History');
  var tz = getTz_();
  var rawRows = readTable_('Income History');
  if (!rawRows.length) return { byMonthKey: {} };

  var rows = rawRows.map(function (r) {
    return {
      month: r.Month,
      notes: r.Notes,
      fixedActual: r['Fixed Income (Actual)'],
      variableActual: r['Variable Income (Actual)']
    };
  });
  var incomeTxByMonth = groupIncomeTxByMonth_(readTable_('Transactions'), tz);

  var result = calcIncomeHistory_(rows, incomeTxByMonth, tz);

  var out = result.perRow.map(function (r) { return [r.fixed, r.variable, r.avg]; });
  sh.getRange(5, 2, out.length, 3).setValues(out);
  return { byMonthKey: result.byMonthKey };
}

// Read-only companion to recomputeBudgetSummaryMetrics_() above — looks
// up every section-anchor label that function depends on and throws a
// clear error naming whichever one is missing, but never calls setValue.
// This is what Show Version & Diagnostics runs (see showDiagnostics()
// below) so a layout change surfaces there, in a read-only check, rather
// than only being discoverable by noticing a wrong number somewhere.
function validateBudgetSummaryAnchors_() {
  var budget = sheet_('Budget');
  var dash = sheet_('Dashboard');
  findRowByLabel_(budget, 'Source');
  findRowByLabel_(budget, 'Total Income');
  findRowByLabel_(budget, 'Category');
  findRowByLabel_(budget, 'Total Expenses');
  findRowByLabel_(budget, '  of which Essential');
  findRowByLabel_(budget, 'NET (Income - Expenses)');
  findRowByLabel_(budget, 'Total Income (Actual)');
  findRowByLabel_(budget, 'Total Expenses (Actual)');
  findRowByLabel_(budget, 'How much have we spent so far?');
  findRowByLabel_(budget, 'How much has Jonathan 1 made?');
  findRowByLabel_(budget, 'Suggested variable income estimate (3-mo avg, conservative)');
  findRowByLabel_(dash, 'Fixed Income (Actual)', 2);
  findRowByLabel_(dash, 'Variable Income (Actual)', 2);
  findRowByLabel_(dash, 'Total Income (Actual)', 2);
  findRowByLabel_(dash, 'Total Expenses (Actual)', 2);
  findRowByLabel_(dash, 'Net (Actual)', 2);
  findRowByLabel_(dash, 'Savings Rate', 2);
}
// Best-effort wrapper for the automatic hooks scattered through this file
// (Add Transaction, Add Category, Add Shift, Monthly Budget Sit-Down,
// Jump to Current Month, onOpen) — never lets a summary-recompute failure
// break the tool that triggered it, same swallow-and-continue pattern as
// logChange_. If this keeps failing silently, Show Version & Diagnostics'
// "last refreshed" line will reveal it.
function refreshBudgetSummarySilently_() {
  try {
    recomputeBudgetSummaryMetrics_();
  } catch (e) {
    // Best-effort — see comment above.
  }
}
// Manual entry point (Budget Tools menu) — same computation as the
// automatic hooks above, surfaced with a visible result for after a
// hand-edit made directly in Transactions/Budget Plan/Budget, outside the
// tools, where nothing would otherwise trigger a recompute.
function refreshBudgetSummary() {
  var ui = SpreadsheetApp.getUi();
  try {
    recomputeBudgetSummaryMetrics_();
    logChange_('Refresh Budget Summary', 'Recomputed every category Budgeted/Actual, Income/Expense/Essential totals, NET, Income vs Expenses, Household Safety Number, Dashboard\'s category mirror and summary figures, and Income History.');
    ui.alert('Budget summary metrics refreshed.');
  } catch (e) {
    ui.alert('Could not refresh budget summary metrics: ' + e.message);
  }
}
// One-time (safe to re-run) setup: adds a time-driven trigger so these
// metrics stay reasonably current even without an explicit action — e.g.
// a transaction added by hand-editing Transactions directly, bypassing
// Add Transaction. Guards against creating a duplicate trigger on repeat
// runs. recomputeBudgetSummaryMetrics_() is set as the trigger handler
// directly (not a wrapper) — its trailing underscore only hides it from
// the Apps Script editor's manual trigger-setup dropdown, it has no
// effect on a trigger created from code, as this one is.
function setupScheduledBudgetRefresh() {
  var ui = SpreadsheetApp.getUi();
  var already = ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === 'recomputeBudgetSummaryMetrics_';
  });
  if (already) {
    ui.alert('Scheduled Budget Refresh is already set up (runs every 4 hours) — nothing to do.');
    return;
  }
  ScriptApp.newTrigger('recomputeBudgetSummaryMetrics_').timeBased().everyHours(4).create();
  logChange_('Enable Scheduled Budget Refresh', 'Created a time-driven trigger — recomputeBudgetSummaryMetrics_() every 4 hours.');
  ui.alert('Done — budget summary metrics will now also refresh automatically every 4 hours, in addition to right after every Add Transaction / Add Shift / Add Category / Monthly Budget Sit-Down / Jump to Current Month.');
}
// =================== SYNC CATEGORY NAMES ================================
// The Budget and Dashboard sheets predate the Apps Script tools — their
// category name cells were just typed text, completely disconnected from
// the Categories sheet, which is what Add Transaction / Add Category /
// View Category Spending / This Week Snapshot all actually read from.
// That's why the same category could show up under two different names
// depending on which part of the workbook you were looking at (e.g.
// Categories called SUB-HOUSING-GAS "Household Gas"; Budget/Dashboard had
// it typed in as "Gas (House)") — nothing kept the two in sync.
//
// This one-time (safe to re-run) tool rewires both sheets so the category
// name is always pulled live from Categories, keyed by Subcategory_ID —
// the same pattern insertBudgetRow_ / addDashboardRow_ above already use
// for brand-new categories, just applied retroactively to the rows that
// predate these tools:
//   - Budget!A{row}     -> live formula off Budget!E{row} (already stored
//                          on every row, old and new alike).
//   - Dashboard!B{row}  -> live formula off a new hidden ID column (G),
//                          populated here by matching each row's current
//                          text against Budget's current text, once.
// Budgeted/Actual dollar formulas are NOT touched — only the display
// name. If a Dashboard row's text can't be matched to a Budget category
// (shouldn't normally happen), it's left untouched and called out in the
// summary rather than silently skipped.
function syncCategoryNames() {
  var ui = SpreadsheetApp.getUi();
  var budget = sheet_('Budget');
  var dash = sheet_('Dashboard');
  var validIds = {};
  readTable_('Categories').forEach(function (c) { validIds[c.Category_ID] = true; });
  // ---- Pass 1: read Budget's current category rows before rewriting anything ----
  var lastRow = budget.getLastRow();
  var aVals = budget.getRange(1, 1, lastRow, 1).getValues(); // A
  var eVals = budget.getRange(1, 5, lastRow, 1).getValues(); // E
  var nameToId = {};   // Budget's current A text -> Subcategory_ID
  var budgetRows = [];
  for (var r = 0; r < lastRow; r++) {
    var subId = eVals[r][0];
    var name = String(aVals[r][0] || '').trim();
    if (subId && validIds[subId] && name) {
      budgetRows.push({ row: r + 1, subId: subId });
      nameToId[name] = subId;
    }
  }
  // ---- Pass 2: rewrite Budget!A as a live formula off its own Subcategory_ID ----
  budgetRows.forEach(function (item) {
    budget.getRange('A' + item.row).setFormula(liveCategoryNameFormula_('$E' + item.row));
  });
  // ---- Pass 3: find Dashboard's category block, give it a hidden ID column ----
  var sectionRow = findRowByLabel_(dash, 'Expense Categories: Budgeted vs Actual', 2);
  var startRow = sectionRow + 2; // skip the section title row and the column-header row
  var col = dash.getRange(startRow, 2, 200, 1).getValues(); // B, scanning down
  var dashRows = [];
  var unmatched = [];
  for (var i = 0; i < col.length; i++) {
    var text = String(col[i][0] || '').trim();
    if (!text) break; // first blank row ends the category list
    var row = startRow + i;
    var subId2 = nameToId[text];
    if (subId2) {
      dashRows.push({ row: row, subId: subId2 });
    } else {
      unmatched.push(text + ' (row ' + row + ')');
    }
  }
  dashRows.forEach(function (item) {
    dash.getRange('G' + item.row).setValue(item.subId);
    dash.getRange('B' + item.row).setFormula(liveCategoryNameFormula_('$G' + item.row));
  });
  dash.getRange('G' + (sectionRow + 1)).setValue('Subcategory_ID (used by Budget Tools — leave alone)');
  try { dash.hideColumns(7); } catch (e) { /* hiding is best-effort */ }
  var msg = 'Linked ' + budgetRows.length + ' Budget row' + (budgetRows.length === 1 ? '' : 's') +
    ' and ' + dashRows.length + ' Dashboard row' + (dashRows.length === 1 ? '' : 's') +
    ' to Categories.\n\nRenaming a category on the Categories sheet will now update its name on Budget and Dashboard automatically — no more typing it in three places.';
  if (unmatched.length) {
    msg += '\n\nCouldn\'t match ' + unmatched.length + ' Dashboard row(s) to a Budget category, so they were left untouched: ' + unmatched.join(', ');
  }
  logChange_('Sync Category Names', 'Linked ' + budgetRows.length + ' Budget row(s), ' + dashRows.length + ' Dashboard row(s)' +
    (unmatched.length ? '; ' + unmatched.length + ' Dashboard row(s) unmatched: ' + unmatched.join(', ') : ''));
  ui.alert(msg);
}
// =================== ADD SHIFT (TIP TRACKER) ============================
// A tipped-employee income manager: logs one row per shift (Sales, Cash
// Tips, Credit Card Tips, Hours) to a self-provisioning "Tip Tracker"
// sheet, automatically computes tip-out (money paid out to floor/bar
// staff, plus the card-processing deduction on credit card tips only),
// and posts two linked Transactions rows per shift — "Wages" (Hours ×
// the hourly rate) and "Tips" (net, after tip-out) — so shift income
// flows into Income History/Budget/Dashboard the same as any other
// transaction, with no manual double-entry.
//
// Tip-out formula (all four settings plus the hourly rate live in named
// ranges on the Tip Tracker sheet itself — see
// getOrCreateTipTrackerSheet_ below — so Bianca or Jonathan can change
// any of them any time without touching Code.gs):
//   Floor tip-out = Sales × Floor Tip-Out %
//   Bar tip-out   = CEILING(Sales × Bar Tip-Out %, Bar Tip-Out Rounding)
//                   — i.e. rounded UP to the nearest multiple of the
//                   rounding setting (default $5)
//   CC tip-out    = Credit Card Tips × CC Tip-Out % (cash tips are never
//                   subject to this — there's no card-processing fee on
//                   cash)
//   Net tips      = Cash Tips + Credit Card Tips − Floor tip-out
//                   − Bar tip-out − CC tip-out
//   Wages         = Hours × Hourly Wage Rate
//
// Deliberately NOT sharing addTransaction()'s row-writing code — this
// posts its own Raw Transactions / Transactions rows via a dedicated
// postShiftTransaction_ helper below, kept intentionally separate so
// nothing about this new feature can regress the already-working Add
// Transaction tool. (Worth revisiting as a shared helper in a future
// cleanup pass — see the idea backlog.)

var TIP_TRACKER_SHEET_NAME = 'Tip Tracker';
// Row numbers are only used to BUILD the sheet's initial layout; every
// read after that goes through the named ranges (TT_...) below, not
// these row numbers, so the settings stay correct even if someone
// inserts a row above the settings block later.
var TIP_TRACKER_HEADER_ROW = 9;       // shift-log header row
var TIP_TRACKER_DATA_START_ROW = 10;  // first shift-log data row

// Creates the Tip Tracker sheet (settings block + shift-log header +
// named ranges) the first time Add Shift is used. Safe to call every
// time — a no-op if the sheet already exists, so it never overwrites
// settings someone has already customized.
function getOrCreateTipTrackerSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(TIP_TRACKER_SHEET_NAME);
  if (sh) return sh;

  sh = ss.insertSheet(TIP_TRACKER_SHEET_NAME);
  sh.getRange('A1').setValue('TIP TRACKER — SETTINGS (edit the values in column B any time; Add Shift reads them automatically)').setFontWeight('bold');
  sh.getRange('A2:C2').setValues([['Setting', 'Value', 'Notes']]).setFontWeight('bold');
  var settingsRows = [
    ['Floor Tip-Out %', 6, '% of Sales paid out to floor staff'],
    ['Bar Tip-Out %', 1, '% of Sales paid out to bar staff, before rounding'],
    ['Bar Tip-Out Rounding ($)', 5, 'Bar tip-out is rounded UP to the nearest multiple of this'],
    ['CC Tip-Out %', 2, '% deducted from Credit Card Tips only — cash tips are never charged this'],
    ['Hourly Wage Rate ($)', 17.6, 'Wages = Hours × this rate']
  ];
  sh.getRange(3, 1, settingsRows.length, 3).setValues(settingsRows);
  sh.getRange(3, 2, settingsRows.length, 1).setBackground('#fff2cc'); // yellow = user-editable, matches Budget's own convention

  ss.setNamedRange('TT_FLOOR_PCT', sh.getRange('B3'));
  ss.setNamedRange('TT_BAR_PCT', sh.getRange('B4'));
  ss.setNamedRange('TT_BAR_ROUND', sh.getRange('B5'));
  ss.setNamedRange('TT_CC_PCT', sh.getRange('B6'));
  ss.setNamedRange('TT_HOURLY_RATE', sh.getRange('B7'));

  sh.getRange(TIP_TRACKER_HEADER_ROW, 1, 1, 12).setValues([[
    'Date', 'Member', 'Sales', 'Cash Tips', 'CC Tips', 'Hours',
    'Floor Tip-Out', 'Bar Tip-Out', 'CC Tip-Out', 'Net Tips', 'Wages', 'Logged At'
  ]]).setFontWeight('bold');

  sh.setColumnWidth(1, 100);
  sh.autoResizeColumns(2, 11);
  return sh;
}

// Reads the four tip-out settings + hourly rate via their named ranges
// (not hardcoded row numbers) so this stays correct even if someone
// inserts a row above the settings block. Throws a clear error rather
// than silently falling back to a default, since a wrong tip-out % or
// hourly rate here means a wrong dollar figure on someone's income
// record.
function getTipTrackerSettings_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  function readNamed_(name) {
    var range = ss.getRangeByName(name);
    if (!range) {
      throw new Error('Missing named range "' + name + '" — the Tip Tracker sheet\'s settings block may have been altered. Delete the Tip Tracker sheet and re-run Add Shift to have it rebuilt, or recreate the named range manually.');
    }
    var v = range.getValue();
    if (typeof v !== 'number' || !isFinite(v)) {
      throw new Error('The value for "' + name + '" on the Tip Tracker sheet isn\'t a valid number — please fix it there before adding a shift.');
    }
    return v;
  }
  return {
    floorPct: readNamed_('TT_FLOOR_PCT'),
    barPct: readNamed_('TT_BAR_PCT'),
    barRound: readNamed_('TT_BAR_ROUND'),
    ccPct: readNamed_('TT_CC_PCT'),
    hourlyRate: readNamed_('TT_HOURLY_RATE')
  };
}

// Called from AddShiftDialog.html on load, to power the live tip-out/
// wage preview as the user types. Creates the Tip Tracker sheet on
// first-ever use (same lazy creation the real submit path uses below)
// so the preview works correctly even before any shift has been logged.
function getTipTrackerSettingsForPreview_() {
  getOrCreateTipTrackerSheet_();
  return getTipTrackerSettings_();
}

function showAddShiftDialog() {
  var template = HtmlService.createTemplateFromFile('AddShiftDialog');
  template.members = getHouseholdMembersList_();
  var html = template.evaluate().setWidth(420).setHeight(600);
  SpreadsheetApp.getUi().showModalDialog(html, 'Add a shift');
}

// Finds (or creates, live-linked into Budget the same way Add Category
// does) the income subcategory with this exact name under the real
// top-level Income category, whose Category_ID is the bare string
// "INCOME" (not "CAT-INCOME" — see the note in addCategory() above).
// Shared by addShift() below for both "Wages" and "Tips" so re-running
// Add Shift never creates duplicate categories.
function ensureIncomeSubcategory_(name) {
  var existing = readTable_('Categories');
  var match = existing.filter(function (c) {
    return c.Record_Type === 'Subcategory' && c.Parent_Category_ID === 'INCOME' &&
      String(c.Category_Name || '').trim().toLowerCase() === name.toLowerCase();
  })[0];
  if (match) return match.Category_ID;

  var catSheet = sheet_('Categories');
  var existingIds = existing.map(function (c) { return c.Category_ID; });
  var maxSort = existing.reduce(function (m, c) { return Math.max(m, Number(c.Sort_Order) || 0); }, 0);
  var subId = uniqueId_('SUB-INCOME-' + slug_(name), existingIds);

  catSheet.appendRow(rowFromHeaders_('Categories', {
    Category_ID: subId,
    Parent_Category_ID: 'INCOME',
    Record_Type: 'Subcategory',
    Category_Name: name,
    Transaction_Type: 'Income',
    Essential_Default: 'N',
    Income_Stability_Default: 'Variable', // shift income varies shift to shift, same treatment as Partner 2's variable income
    Active_Flag: 'Yes',
    Legacy_Budget_Label: name,
    Sort_Order: maxSort + 1
  }));

  // Live-link it onto the Budget page too, same as Add Category does for
  // every new category — so "Wages"/"Tips" show up as real budget lines
  // immediately instead of only existing in Categories.
  insertBudgetRow_('Income', name, '', 'Variable', subId);

  logChange_('Add Category', subId + ' "' + name + '" (Income) — auto-created by Add Shift');
  return subId;
}

// Returns (creating if needed) the shared "shift entry" import batch,
// kept separate from Add Transaction's BATCH-MANUAL-ENTRY so shift-
// sourced income can be filtered/reported on distinctly later.
function getOrCreateShiftBatch_(accountId) {
  var sh = sheet_('Import Batches');
  var rows = readTable_('Import Batches');
  var existing = rows.filter(function (r) { return r.Import_Batch_ID === 'BATCH-SHIFT-ENTRY'; })[0];
  if (existing) {
    sh.getRange(existing._row, col_('Import Batches', 'Record_Count')).setValue((existing.Record_Count || 0) + 1);
    return 'BATCH-SHIFT-ENTRY';
  }
  sh.appendRow(rowFromHeaders_('Import Batches', {
    Import_Batch_ID: 'BATCH-SHIFT-ENTRY',
    Imported_At: new Date(),
    Source_System: 'Manual entry (Add Shift tool)',
    Source_File: '',
    Account_ID: accountId,
    Record_Count: 1,
    Status: 'Completed',
    Notes: 'Auto-created by the Add Shift tool; reused for every shift-sourced Wages/Tips transaction.'
  }));
  return 'BATCH-SHIFT-ENTRY';
}

// Posts one Raw Transactions + Transactions row pair — same shape as
// addTransaction()'s own writes, just parameterized instead of reading
// straight from a form, since Add Shift posts two of these per shift
// (Wages, Tips) instead of one.
function postShiftTransaction_(date, amount, subId, subName, memberId, note, batchId, accountId) {
  var txnSeq = nextSequence_('Transactions', 'Transaction_ID');
  var rawSeq = nextSequence_('Raw Transactions', 'Raw_Record_ID');
  var txnId = 'TXN-SHIFT-' + pad_(txnSeq, 6);
  var rawId = 'RAW-SHIFT-' + pad_(rawSeq, 6);
  var now = new Date();

  sheet_('Raw Transactions').appendRow(rowFromHeaders_('Raw Transactions', {
    Raw_Record_ID: rawId,
    Import_Batch_ID: batchId,
    Source_System: 'Manual entry (Add Shift tool)',
    Account_ID: accountId,
    Imported_At: now,
    Raw_Transaction_Date: date,
    Raw_Type: 'Income',
    Raw_Category: subName,
    Raw_Description: note,
    Raw_Amount: amount,
    Raw_Currency: 'USD',
    Raw_Notes: note,
    Normalization_Status: 'Normalized'
  }));

  var txSheet = sheet_('Transactions');
  var newRow = txSheet.getLastRow() + 1;
  var txRow = rowFromHeaders_('Transactions', {
    Transaction_ID: txnId,
    Raw_Record_ID: rawId,
    Import_Batch_ID: batchId,
    Account_ID: accountId,
    Member_ID: memberId || '',
    Transaction_Date: date,
    Transaction_Type: 'Income',
    Amount: amount,
    Currency: 'USD',
    Original_Description: note,
    Income_Stability: 'Variable',
    Manual_Category_ID: 'INCOME',
    Manual_Subcategory_ID: subId,
    Reviewed_Flag: 'Yes',
    Review_Status: 'Confirmed',
    Is_Duplicate: 'No',
    User_Notes: note,
    Created_At: now,
    Updated_At: now
  });
  txSheet.getRange(newRow, 1, 1, txRow.length).setValues([txRow]);

  var effCatCol = colLetter_('Transactions', 'Effective_Category_ID');
  var effSubCol = colLetter_('Transactions', 'Effective_Subcategory_ID');
  var manCatCol = colLetter_('Transactions', 'Manual_Category_ID');
  var manSubCol = colLetter_('Transactions', 'Manual_Subcategory_ID');
  var autoCatCol = colLetter_('Transactions', 'Auto_Category_ID');
  var autoSubCol = colLetter_('Transactions', 'Auto_Subcategory_ID');
  var dupKeyCol = colLetter_('Transactions', 'Duplicate_Key');
  var txDateCol = colLetter_('Transactions', 'Transaction_Date');
  var txAmountCol = colLetter_('Transactions', 'Amount');
  var txAcctCol = colLetter_('Transactions', 'Account_ID');
  var txTypeCol = colLetter_('Transactions', 'Transaction_Type');
  var txDescCol = colLetter_('Transactions', 'Original_Description');

  txSheet.getRange(effCatCol + newRow).setFormula('=IF(' + manCatCol + newRow + '<>"",' + manCatCol + newRow + ',' + autoCatCol + newRow + ')');
  txSheet.getRange(effSubCol + newRow).setFormula('=IF(' + manSubCol + newRow + '<>"",' + manSubCol + newRow + ',' + autoSubCol + newRow + ')');
  txSheet.getRange(dupKeyCol + newRow).setFormula(
    '=IF(' + txDateCol + newRow + '="","",LOWER(TEXT(' + txDateCol + newRow + ',"yyyymmdd")&"|"&TEXT(' + txAmountCol + newRow + ',"0.00")&"|"&' +
    txAcctCol + newRow + '&"|"&' + txTypeCol + newRow + '&"|"&TRIM(' + txDescCol + newRow + ')))'
  );

  return txnId;
}

/**
 * Called from AddShiftDialog.html via google.script.run.
 * form = { date, memberId, sales, cashTips, ccTips, hours, confirmed }
 * Two-phase: if a shift already exists for the same date and
 * form.confirmed isn't true, returns { duplicate: true, message } instead
 * of writing anything — the dialog shows a confirm prompt and resubmits
 * with confirmed = true to actually log a second shift that day. This is
 * a warn-and-confirm guard, not a hard block, since legitimate double
 * shifts do happen.
 */
function addShift(form) {
  if (!form.date) throw new Error('Please choose a date.');
  var hours = Number(form.hours);
  if (!isFinite(hours) || hours <= 0) throw new Error('Hours worked must be a positive number.');
  var sales = Number(form.sales) || 0;
  var cashTips = Number(form.cashTips) || 0;
  var ccTips = Number(form.ccTips) || 0;
  if (sales < 0 || cashTips < 0 || ccTips < 0) throw new Error('Sales and tips can\'t be negative.');

  var tz = getTz_();
  var date = Utilities.parseDate(form.date, tz, 'yyyy-MM-dd');
  var dateKey = Utilities.formatDate(date, tz, 'yyyy-MM-dd');

  var sh = getOrCreateTipTrackerSheet_();
  var lastRow = sh.getLastRow();

  if (!form.confirmed && lastRow >= TIP_TRACKER_DATA_START_ROW) {
    var n = lastRow - TIP_TRACKER_DATA_START_ROW + 1;
    var existingDates = sh.getRange(TIP_TRACKER_DATA_START_ROW, 1, n, 1).getValues();
    for (var i = 0; i < existingDates.length; i++) {
      var d = existingDates[i][0];
      if (d instanceof Date && Utilities.formatDate(d, tz, 'yyyy-MM-dd') === dateKey) {
        return {
          duplicate: true,
          message: 'A shift is already logged for ' + Utilities.formatDate(date, tz, 'MMM d, yyyy') + '. Log this as an additional shift for the same day?'
        };
      }
    }
  }

  var settings = getTipTrackerSettings_();
  var floorTipOut = sales * settings.floorPct / 100;
  var barTipOutRaw = sales * settings.barPct / 100;
  var barTipOut = settings.barRound > 0 ? Math.ceil(barTipOutRaw / settings.barRound) * settings.barRound : barTipOutRaw;
  var ccTipOut = ccTips * settings.ccPct / 100;
  var netTips = cashTips + ccTips - floorTipOut - barTipOut - ccTipOut;
  var wages = hours * settings.hourlyRate;

  sh.getRange(sh.getLastRow() + 1, 1, 1, 12).setValues([[
    date, form.memberId || '', sales, cashTips, ccTips, hours,
    floorTipOut, barTipOut, ccTipOut, netTips, wages, new Date()
  ]]);

  var accountId = getActiveAccountId_();
  var batchId = getOrCreateShiftBatch_(accountId);
  var wagesSubId = ensureIncomeSubcategory_('Wages');
  var tipsSubId = ensureIncomeSubcategory_('Tips');

  var dateLabel = Utilities.formatDate(date, tz, 'MMM d, yyyy');
  var wageTxnId = postShiftTransaction_(date, wages, wagesSubId, 'Wages', form.memberId, 'Shift ' + dateLabel + ' — ' + hours + ' hrs', batchId, accountId);
  var tipsTxnId = postShiftTransaction_(date, netTips, tipsSubId, 'Tips', form.memberId, 'Shift ' + dateLabel + ' — net tips after tip-out', batchId, accountId);
  recomputePotentialDuplicateFlags_();

  logChange_('Add Shift', dateLabel + ': ' + wageTxnId + ' Wages $' + wages.toFixed(2) + ', ' + tipsTxnId + ' Tips $' + netTips.toFixed(2) +
    ' (Sales $' + sales.toFixed(2) + ', tip-out: floor $' + floorTipOut.toFixed(2) + ' + bar $' + barTipOut.toFixed(2) + ' + CC $' + ccTipOut.toFixed(2) + ')');
  refreshBudgetSummarySilently_(); // Wages/Tips are Variable income — this shift's actuals should count immediately

  var message = 'Logged ' + dateLabel + ': $' + wages.toFixed(2) + ' wages (' + hours + ' hrs), $' + netTips.toFixed(2) + ' net tips ' +
    '(after $' + floorTipOut.toFixed(2) + ' floor + $' + barTipOut.toFixed(2) + ' bar + $' + ccTipOut.toFixed(2) + ' CC tip-out).';
  if (netTips < 0) {
    message += ' ⚠ Net tips came out negative — double check the amounts entered.';
  }
  return { ok: true, message: message };
}
// =================== VIEW CATEGORY SPENDING ===========================
// Read-only chart tool: pick one category, see what was actually spent
// (or received, for Income categories) per week, visually grouped by
// month, for the trailing 3/6/12 months. Nothing is written to any sheet.
function showCategorySpendingDialog() {
  var template = HtmlService.createTemplateFromFile('CategorySpendingDialog');
  template.categories = getCategoriesList_();
  var html = template.evaluate().setWidth(760).setHeight(620);
  SpreadsheetApp.getUi().showModalDialog(html, 'Category spending');
}
/**
 * Called from CategorySpendingDialog.html via google.script.run.
 * Returns weekly totals for one category, grouped by month, for the
 * trailing `monthsBack` months (including the current month).
 *
 * Reads Transactions via the same header-based column lookup as every
 * other tool in this file (col_() — see HEADER-BASED COLUMN LOOKUP
 * above): Transaction_Date, Transaction_Type, Amount, the effective
 * Subcategory_ID column, and Is_Duplicate — so a category's chart
 * always agrees with the Budget/Dashboard Actual figures for the same
 * category, and stays correct even if Transactions' column order ever
 * changes. (Corrected 2026-08-17, v0.0.17 — this comment previously
 * described fixed column letters that no longer matched the code below
 * it, left over from before the header-based-lookup refactor was
 * applied here.)
 *
 * "Week" = week-of-month (days 1–7, 8–14, 15–21, 22–28, 29–end), not a
 * true ISO calendar week — chosen so weeks never straddle a month
 * boundary, which keeps the "grouped by month" visual clean.
 *
 * The trailing month range is built entirely from 'yyyy-MM' string/
 * integer arithmetic (monthKey_()/shiftMonthKey_()/monthStartFromKey_())
 * rather than `new Date(year, month, 1)`, which is constructed in the
 * Apps Script runtime's own implicit timezone and can silently disagree
 * with the spreadsheet's — the same class of bug getTz_() exists to
 * guard against elsewhere in this file. (Fixed 2026-08-17, v0.0.17.)
 */
function getCategorySpendingData(subId, monthsBack) {
  if (!subId) throw new Error('Please choose a category.');
  var months = Math.max(1, Math.min(24, Number(monthsBack) || 6));
  var cat = getCategoriesList_().filter(function (c) { return c.subId === subId; })[0];
  if (!cat) throw new Error('Category not found — please reopen the tool.');
  var sh = sheet_('Transactions');
  var lastRow = sh.getLastRow();
  var tz = getTz_();
  var todayKey = monthKey_(new Date(), tz);
  var startKey = shiftMonthKey_(todayKey, -(months - 1));
  var rangeStart = monthStartFromKey_(startKey, tz);
  // Build the month buckets up front so empty months still show up as
  // zero-height bars instead of disappearing from the chart.
  var monthKeys = [];
  var monthMeta = {};
  for (var i = 0; i < months; i++) {
    var key = shiftMonthKey_(startKey, i);
    var d = monthStartFromKey_(key, tz);
    monthKeys.push(key);
    monthMeta[key] = { label: Utilities.formatDate(d, tz, 'MMM yyyy'), weeks: [0, 0, 0, 0, 0] };
  }
  if (lastRow >= 5) {
    var n = lastRow - 4;
    var dates = sh.getRange(5, col_('Transactions', 'Transaction_Date'), n, 1).getValues();
    var types = sh.getRange(5, col_('Transactions', 'Transaction_Type'), n, 1).getValues();
    var amounts = sh.getRange(5, col_('Transactions', 'Amount'), n, 1).getValues();
    var subIds = sh.getRange(5, col_('Transactions', 'Effective_Subcategory_ID'), n, 1).getValues();
    var dupFlags = sh.getRange(5, col_('Transactions', 'Is_Duplicate'), n, 1).getValues();
    for (var r = 0; r < n; r++) {
      var date = dates[r][0];
      if (!(date instanceof Date)) continue;
      if (types[r][0] !== cat.transactionType) continue;
      if (subIds[r][0] !== subId) continue;
      if (dupFlags[r][0] === 'Yes') continue;
      if (date < rangeStart) continue;
      var key = Utilities.formatDate(date, tz, 'yyyy-MM');
      var bucket = monthMeta[key];
      if (!bucket) continue; // outside the requested range (e.g. future-dated)
      var week = Math.min(5, Math.ceil(date.getDate() / 7)) - 1; // 0-based index
      bucket.weeks[week] += Number(amounts[r][0]) || 0;
    }
  }
  var monthsOut = monthKeys.map(function (key) {
    var b = monthMeta[key];
    // Trim a trailing week-5 slot for months that don't actually have a
    // 5th week (28/30-day months), so no stray always-zero bar shows up.
    var daysInMonth = new Date(parseInt(key.slice(0, 4), 10), parseInt(key.slice(5, 7), 10), 0).getDate();
    var weekCount = Math.ceil(daysInMonth / 7);
    return {
      key: key,
      label: b.label,
      weeks: b.weeks.slice(0, weekCount).map(function (amt, idx) {
        return { label: 'Wk ' + (idx + 1), amount: Math.round(amt * 100) / 100 };
      })
    };
  });
  var total = 0;
  monthsOut.forEach(function (m) { m.weeks.forEach(function (w) { total += w.amount; }); });
  return {
    subId: subId,
    subName: cat.subName,
    type: cat.transactionType,
    months: monthsOut,
    total: Math.round(total * 100) / 100
  };
}
// =================== THIS WEEK SNAPSHOT ================================
// Writes a "This Week" panel onto the Dashboard sheet, combining ten
// small at-a-glance stats into one refreshable block:
//   1. This week's spending vs last week (with % change)
//   2/8. Top movers vs each category's trailing weekly average, with a
//        ⚠ badge on anything running "hot" (>= HOT_THRESHOLD x average)
//   3. Pace projection for fluctuating essentials (month-to-date,
//      projected to month end, vs budgeted)
//   4. Biggest single transaction this week
//   5. Essential vs discretionary split of this week's spending
//   6. Net cash flow this week (income minus expenses)
//   7. Weekly budget remaining for fluctuating essentials (monthly
//      budget ÷ weeks-in-month, minus what's been spent this week)
//   9. Spending by household member this week (plus Joint/Shared)
//   10. Count of this week's transactions still missing a category or
//       not yet marked reviewed
//
// Every run clears and rewrites its own block from scratch (so a
// shorter run never leaves stale rows behind) and never reads or
// writes anything outside that block. Nothing here is a live formula —
// re-run "Refresh This Week Snapshot" any time you want current numbers.
var THIS_WEEK_ANCHOR_ROW = 45;   // Dashboard row the panel starts on
var THIS_WEEK_ANCHOR_COL = 2;    // Dashboard column the panel starts on (2 = B)
// Chosen to sit well below the existing "Expense Categories: Budgeted vs
// Actual" table, which occupies roughly B6:E40 (see addDashboardRow_
// above). If row 45 turns out to collide with something else on your
// Dashboard, just change these two numbers and re-run — nothing else
// needs to change. NOTE (2026-08-17): this is still a hardcoded
// constant that does NOT automatically shift when addDashboardRow_()
// inserts new rows above it (i.e. every new Expense category added via
// Add Category permanently pushes the real panel position down by one
// row). Left as-is for now — flagging again here since it wasn't
// touched in this round of fixes, only confirmed still true.
var THIS_WEEK_TRAILING_WEEKS = 8;   // how many prior full weeks count as "average"
var THIS_WEEK_HOT_THRESHOLD = 1.5;  // >= 1.5x the weekly average triggers the ⚠ badge
function refreshThisWeekSnapshot() {
  var dash = sheet_('Dashboard');
  var tz = getTz_();
  // ---- date windows (week = Sunday through Saturday) ----
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var dow = today.getDay(); // 0 = Sunday
  var weekStart = new Date(today); weekStart.setDate(today.getDate() - dow);
  var weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
  var lastWeekStart = new Date(weekStart); lastWeekStart.setDate(weekStart.getDate() - 7);
  var lastWeekEnd = new Date(weekStart); lastWeekEnd.setDate(weekStart.getDate() - 1);
  var trailingStart = new Date(weekStart); trailingStart.setDate(weekStart.getDate() - 7 * THIS_WEEK_TRAILING_WEEKS);
  var trailingEnd = new Date(weekStart); trailingEnd.setDate(weekStart.getDate() - 1);
  var budgetMonth = sheet_('Budget').getRange('B2').getValue();
  // Compared as 'yyyy-MM' strings, both explicitly run through the
  // spreadsheet's own timezone (see getTz_) — not raw Date.getMonth()/
  // getFullYear(), which follow the script runtime's own implicit
  // timezone and can silently disagree with what the sheet itself shows
  // (this was a real bug: the ⚠ warning below never fired even when
  // Budget!B2 was genuinely stale, because this comparison quietly
  // thought it already matched).
  var todayKey = monthKey_(today, tz);
  var budgetMonthKey = (budgetMonth instanceof Date) ? monthKey_(budgetMonth, tz) : todayKey;
  var monthStart = monthStartFromKey_(budgetMonthKey, tz);
  var bmParts = budgetMonthKey.split('-');
  var bmYear = parseInt(bmParts[0], 10), bmMonthIdx = parseInt(bmParts[1], 10) - 1; // 0-indexed
  var daysInMonth = new Date(bmYear, bmMonthIdx + 1, 0).getDate();
  var isCurrentCalendarMonth = budgetMonthKey === todayKey;
  var daysElapsedInMonth = isCurrentCalendarMonth ? today.getDate() : daysInMonth;
  // If Budget!B2 isn't set to the current calendar month, month-to-date
  // figures use that whole month instead of comparing against "today".
  var mtdEnd = isCurrentCalendarMonth ? today : new Date(bmYear, bmMonthIdx + 1, 0);
  var budgetMonthLabel = Utilities.formatDate(monthStart, tz, 'MMMM yyyy');
  var todayMonthLabel = Utilities.formatDate(today, tz, 'MMMM yyyy');
  // ---- category / member lookups ----
  var categories = getCategoriesList_();
  var catById = {};
  categories.forEach(function (c) { catById[c.subId] = c; });
  var members = getHouseholdMembersList_();
  // Budget Plan rows for the current Budget!B2 month, keyed by subcategory.
  var budgetedBySub = {};
  readTable_('Budget Plan')
    .filter(function (r) { return r.Active_Flag === 'Yes' && r.Month_Start && sameMonth_(new Date(r.Month_Start), monthStart, tz); })
    .forEach(function (r) { budgetedBySub[r.Subcategory_ID] = Number(r.Budgeted_Amount) || 0; });
  // ---- single pass over Transactions ----
  var sh = sheet_('Transactions');
  var lastRow = sh.getLastRow();
  var weekBySub = {}, trailingBySub = {}, monthToDateBySub = {};
  var weekMemberTotals = {};
  var weekExpenseTotal = 0, weekIncomeTotal = 0, lastWeekExpenseTotal = 0;
  var biggest = null;
  var needsReview = 0;
  if (lastRow >= 5) {
    var n = lastRow - 4;
    var dates = sh.getRange(5, col_('Transactions', 'Transaction_Date'), n, 1).getValues();
    var memberCol = sh.getRange(5, col_('Transactions', 'Member_ID'), n, 1).getValues();
    var types = sh.getRange(5, col_('Transactions', 'Transaction_Type'), n, 1).getValues();
    var amounts = sh.getRange(5, col_('Transactions', 'Amount'), n, 1).getValues();
    var notes = sh.getRange(5, col_('Transactions', 'Original_Description'), n, 1).getValues();
    var subIds = sh.getRange(5, col_('Transactions', 'Effective_Subcategory_ID'), n, 1).getValues();
    var reviewed = sh.getRange(5, col_('Transactions', 'Reviewed_Flag'), n, 1).getValues();
    var dupFlags = sh.getRange(5, col_('Transactions', 'Is_Duplicate'), n, 1).getValues();
    for (var r = 0; r < n; r++) {
      var date = dates[r][0];
      if (!(date instanceof Date)) continue;
      var type = types[r][0];
      var amount = Number(amounts[r][0]) || 0;
      var subId = subIds[r][0];
      var isDup = dupFlags[r][0] === 'Yes';
      var inThisWeek = date >= weekStart && date <= weekEnd;
      var inLastWeek = date >= lastWeekStart && date <= lastWeekEnd;
      // #10 data-quality nudge counts every transaction this week
      // regardless of type/duplicate status — it's about review
      // completeness, not spend totals.
      if (inThisWeek && (reviewed[r][0] !== 'Yes' || !subId)) needsReview++;
      if (isDup) continue; // everything below mirrors the Budget sheet's own "exclude duplicates" filter
      if (inThisWeek && type === 'Expense') {
        weekBySub[subId] = (weekBySub[subId] || 0) + amount;
        weekExpenseTotal += amount;
        var memberKey = memberCol[r][0] || '__JOINT__';
        weekMemberTotals[memberKey] = (weekMemberTotals[memberKey] || 0) + amount;
        if (!biggest || amount > biggest.amount) {
          biggest = { amount: amount, subId: subId, date: date, note: notes[r][0] || '' };
        }
      }
      if (inThisWeek && type === 'Income') weekIncomeTotal += amount;
      if (inLastWeek && type === 'Expense') lastWeekExpenseTotal += amount;
      if (type === 'Expense' && date >= trailingStart && date <= trailingEnd) {
        trailingBySub[subId] = (trailingBySub[subId] || 0) + amount;
      }
      if (type === 'Expense' && date >= monthStart && date <= mtdEnd) {
        monthToDateBySub[subId] = (monthToDateBySub[subId] || 0) + amount;
      }
    }
  }
  // ---- derived numbers ----
  var netCashFlow = weekIncomeTotal - weekExpenseTotal;
  var weekChangePct = lastWeekExpenseTotal > 0 ? (weekExpenseTotal - lastWeekExpenseTotal) / lastWeekExpenseTotal : null;
  var essentialTotal = 0, discretionaryTotal = 0;
  Object.keys(weekBySub).forEach(function (subId) {
    var cat = catById[subId];
    if (cat && cat.essentialDefault === 'Y') essentialTotal += weekBySub[subId];
    else discretionaryTotal += weekBySub[subId];
  });
  // Union of "spent this week" and "has trailing history" so a category
  // that dropped to zero this week can still show up as a mover.
  var moverKeys = {};
  Object.keys(weekBySub).forEach(function (k) { moverKeys[k] = true; });
  Object.keys(trailingBySub).forEach(function (k) { moverKeys[k] = true; });
  var movers = Object.keys(moverKeys).map(function (subId) {
    var cat = catById[subId];
    var actual = weekBySub[subId] || 0;
    var avg = (trailingBySub[subId] || 0) / THIS_WEEK_TRAILING_WEEKS;
    return {
      name: (cat && cat.subName) || subId || '(Uncategorized)',
      actual: actual,
      avg: avg,
      diff: actual - avg,
      hot: avg > 0 && actual >= avg * THIS_WEEK_HOT_THRESHOLD
    };
  }).sort(function (a, b) { return Math.abs(b.diff) - Math.abs(a.diff); }).slice(0, 3);
  var fluctuatingEssentials = categories.filter(function (c) {
    return c.transactionType === 'Expense' && c.essentialDefault === 'Y' &&
      c.incomeStabilityDefault === 'Variable' && budgetedBySub[c.subId] > 0;
  });
  var pace = fluctuatingEssentials.map(function (c) {
    var mtd = monthToDateBySub[c.subId] || 0;
    var budgeted = budgetedBySub[c.subId];
    var projected = daysElapsedInMonth > 0 ? (mtd / daysElapsedInMonth) * daysInMonth : mtd;
    return { name: c.subName, mtd: mtd, budgeted: budgeted, projected: projected, over: projected > budgeted };
  });
  var weeklyRemaining = fluctuatingEssentials.map(function (c) {
    var weeklySlice = budgetedBySub[c.subId] / (daysInMonth / 7);
    var spent = weekBySub[c.subId] || 0;
    return { name: c.subName, weeklySlice: weeklySlice, spent: spent, remaining: weeklySlice - spent };
  });
  var whoSpent = members.map(function (m) {
    return { name: m.name, amount: weekMemberTotals[m.id] || 0 };
  });
  whoSpent.push({ name: 'Joint / Shared', amount: weekMemberTotals['__JOINT__'] || 0 });
  writeThisWeekPanel_(dash, {
    weekLabel: formatDateShort_(weekStart, tz) + ' – ' + formatDateShort_(weekEnd, tz),
    isCurrentCalendarMonth: isCurrentCalendarMonth, budgetMonthLabel: budgetMonthLabel, todayMonthLabel: todayMonthLabel,
    weekExpenseTotal: weekExpenseTotal, lastWeekExpenseTotal: lastWeekExpenseTotal, weekChangePct: weekChangePct,
    netCashFlow: netCashFlow,
    essentialTotal: essentialTotal, discretionaryTotal: discretionaryTotal,
    movers: movers,
    pace: pace,
    weeklyRemaining: weeklyRemaining,
    biggest: biggest, catById: catById, tz: tz,
    whoSpent: whoSpent,
    needsReview: needsReview
  });
  logChange_('Refresh This Week Snapshot', 'Week of ' + formatDateShort_(weekStart, tz) + ' – ' + formatDateShort_(weekEnd, tz) +
    (isCurrentCalendarMonth ? '' : ' (Budget!B2 was set to ' + budgetMonthLabel + ', not the current month)'));
  SpreadsheetApp.getUi().alert('This Week snapshot refreshed (week of ' + formatDateShort_(weekStart, tz) + ' – ' + formatDateShort_(weekEnd, tz) + ').');
}
// Compares two dates as "same calendar month" via tz-safe 'yyyy-MM' string
// keys (monthKey_) rather than raw .getFullYear()/.getMonth(), which use
// the Apps Script runtime's own implicit timezone and can disagree with
// the spreadsheet's real one (getTz_()) near month/day boundaries — the
// same class of bug fixed in v0.0.20, see monthlyBudgetSitDown() below.
function sameMonth_(d, monthStart, tz) {
  tz = tz || getTz_();
  return monthKey_(d, tz) === monthKey_(monthStart, tz);
}
function formatDateShort_(d, tz) {
  return Utilities.formatDate(d, tz || (getTz_()), 'MMM d');
}
function moneyStr_(n) {
  var sign = n < 0 ? '-' : '';
  return sign + '$' + Math.abs(n).toFixed(2);
}
/**
 * Clears the panel's block and rewrites it from scratch — this is what
 * makes re-running safe even when the number of rows changes (e.g.
 * fewer "top movers" this week than last time). Only ever touches
 * THIS_WEEK_ANCHOR_ROW/COL through +80 rows / +6 columns.
 */
function writeThisWeekPanel_(dash, d) {
  var startRow = THIS_WEEK_ANCHOR_ROW;
  var startCol = THIS_WEEK_ANCHOR_COL;
  var clearRange = dash.getRange(startRow, startCol, 80, 6);
  clearRange.clear();
  var row = startRow;
  function put(col, value, opts) {
    var cell = dash.getRange(row, startCol + col);
    cell.setValue(value);
    if (opts && opts.bold) cell.setFontWeight('bold');
    if (opts && opts.color) cell.setFontColor(opts.color);
    if (opts && opts.size) cell.setFontSize(opts.size);
  }
  function nextRow(n) { row += (n || 1); }
  put(0, 'THIS WEEK SNAPSHOT', { bold: true, size: 13 });
  nextRow();
  put(0, 'Week of ' + d.weekLabel, { color: '#6b6b68' });
  nextRow();
  if (!d.isCurrentCalendarMonth) {
    put(0, '⚠ Budget!B2 is set to ' + d.budgetMonthLabel + ', not the current month (' + d.todayMonthLabel + ') — Pace Projection and Weekly Budget Remaining below are computed against ' + d.budgetMonthLabel + ', not today. Use Budget Tools → Jump to Current Month to fix this.', { color: '#a52a2a' });
    nextRow();
  }
  nextRow();
  // #1 week vs last week, #6 net cash flow
  put(0, 'This week spending:', { bold: true }); put(1, moneyStr_(d.weekExpenseTotal));
  put(2, 'Last week:'); put(3, moneyStr_(d.lastWeekExpenseTotal));
  put(4, 'Change:');
  put(5, d.weekChangePct === null ? 'n/a' : (d.weekChangePct >= 0 ? '+' : '') + (d.weekChangePct * 100).toFixed(0) + '%',
    { color: d.weekChangePct > 0 ? '#b85a34' : '#0a6b0a' });
  nextRow();
  put(0, 'Net cash flow this week:', { bold: true });
  put(1, moneyStr_(d.netCashFlow), { color: d.netCashFlow >= 0 ? '#0a6b0a' : '#b85a34' });
  nextRow(2);
  // #5 essential vs discretionary
  var totalSpend = d.essentialTotal + d.discretionaryTotal;
  put(0, 'Essential vs discretionary (this week):', { bold: true });
  nextRow();
  put(0, '  Essential:'); put(1, moneyStr_(d.essentialTotal));
  put(2, totalSpend > 0 ? (d.essentialTotal / totalSpend * 100).toFixed(0) + '%' : '—');
  nextRow();
  put(0, '  Discretionary:'); put(1, moneyStr_(d.discretionaryTotal));
  put(2, totalSpend > 0 ? (d.discretionaryTotal / totalSpend * 100).toFixed(0) + '%' : '—');
  nextRow(2);
  // #2 / #8 top movers + alert badges
  put(0, 'Top movers vs. ' + THIS_WEEK_TRAILING_WEEKS + '-week average:', { bold: true });
  nextRow();
  if (!d.movers.length) {
    put(0, '  No expense category history yet.'); nextRow();
  } else {
    d.movers.forEach(function (m) {
      put(0, '  ' + (m.hot ? '⚠ ' : '') + m.name, { color: m.hot ? '#a52a2a' : null });
      put(2, moneyStr_(m.actual));
      put(3, 'avg ' + moneyStr_(m.avg));
      put(4, (m.diff >= 0 ? '+' : '') + moneyStr_(m.diff));
      nextRow();
    });
  }
  nextRow();
  // #3 pace projection
  put(0, 'Pace projection (fluctuating essentials):', { bold: true });
  nextRow();
  if (!d.pace.length) {
    put(0, '  None classified/budgeted yet — run "Classify Fixed vs Fluctuating" and set a budget.'); nextRow();
  } else {
    d.pace.forEach(function (p) {
      put(0, '  ' + (p.over ? '⚠ ' : '') + p.name, { color: p.over ? '#a52a2a' : null });
      put(2, moneyStr_(p.mtd) + ' so far');
      put(3, '→ projected ' + moneyStr_(p.projected));
      put(4, 'budget ' + moneyStr_(p.budgeted));
      nextRow();
    });
  }
  nextRow();
  // #7 weekly budget remaining
  put(0, 'Weekly budget remaining (fluctuating essentials):', { bold: true });
  nextRow();
  if (!d.weeklyRemaining.length) {
    put(0, '  None classified/budgeted yet.'); nextRow();
  } else {
    d.weeklyRemaining.forEach(function (w) {
      put(0, '  ' + (w.remaining < 0 ? '⚠ ' : '') + w.name, { color: w.remaining < 0 ? '#a52a2a' : null });
      put(2, moneyStr_(w.spent) + ' of ' + moneyStr_(w.weeklySlice));
      put(4, w.remaining >= 0 ? moneyStr_(w.remaining) + ' left' : moneyStr_(-w.remaining) + ' over');
      nextRow();
    });
  }
  nextRow();
  // #4 biggest transaction
  put(0, 'Biggest transaction this week:', { bold: true });
  nextRow();
  if (!d.biggest) {
    put(0, '  None this week.'); nextRow();
  } else {
    var cat = d.catById[d.biggest.subId];
    put(0, '  ' + ((cat && cat.subName) || d.biggest.subId));
    put(2, moneyStr_(d.biggest.amount));
    put(3, formatDateShort_(d.biggest.date, d.tz));
    put(4, d.biggest.note);
    nextRow();
  }
  nextRow();
  // #9 who spent what
  put(0, 'Spending by person (this week):', { bold: true });
  nextRow();
  d.whoSpent.forEach(function (w) {
    put(0, '  ' + w.name); put(2, moneyStr_(w.amount));
    nextRow();
  });
  nextRow();
  // #10 data-quality nudge
  put(0, 'Needs review this week:', { bold: true });
  put(2, d.needsReview + (d.needsReview === 1 ? ' transaction' : ' transactions') + ' missing a category or not yet reviewed',
    { color: d.needsReview > 0 ? '#a52a2a' : '#0a6b0a' });
  nextRow();
  dash.autoResizeColumns(startCol, 6);
}
// =================== MONTH MANAGEMENT =================================
// Budget!B2 is the single cell that Budget, Dashboard, Pace Projection,
// and Weekly Budget Remaining all treat as "the current month." Nothing
// advances it automatically — these two entry points exist so it's
// never a manual retype: a one-click jump any time, and an offer to
// advance it right after Monthly Budget Sit-Down sets up a new month's
// Budget Plan rows (see the end of monthlyBudgetSitDown() below).
function jumpToCurrentMonth() {
  var ui = SpreadsheetApp.getUi();
  var tz = getTz_();
  var todayKey = monthKey_(new Date(), tz);
  var currentMonth = monthStartFromKey_(todayKey, tz);
  var currentMonthLabel = Utilities.formatDate(currentMonth, tz, 'MMMM yyyy');
  var budgetSheet = sheet_('Budget');
  var existing = budgetSheet.getRange('B2').getValue();
  var existingKey = (existing instanceof Date) ? monthKey_(existing, tz) : null;
  var existingLabel = (existing instanceof Date) ? Utilities.formatDate(existing, tz, 'MMMM yyyy') : String(existing);
  // Compared as 'yyyy-MM' strings, both explicitly run through the
  // spreadsheet's own timezone (see getTz_) — not raw Date.getMonth()/
  // getFullYear(), which follow the script runtime's own implicit
  // timezone and can silently disagree with what the sheet itself shows.
  if (existingKey === todayKey) {
    ui.alert('Budget!B2 is already set to ' + currentMonthLabel + ' — nothing to change.');
    return;
  }
  var resp = ui.alert(
    'Jump to current month',
    'Set Budget!B2 from ' + existingLabel + ' to ' + currentMonthLabel + '?\n\n' +
      'This changes what month Budget, Dashboard, and This Week Snapshot\'s Pace Projection are calculated against. ' +
      'It does not add or change any Budget Plan rows — if ' + currentMonthLabel + ' doesn\'t have budgeted amounts yet, ' +
      'run Monthly Budget Sit-Down first (or set them up manually on Budget Plan).',
    ui.ButtonSet.YES_NO
  );
  if (resp !== ui.Button.YES) return;
  budgetSheet.getRange('B2').setValue(currentMonth);
  logChange_('Jump to Current Month', 'Budget!B2: ' + existingLabel + ' → ' + currentMonthLabel);
  refreshBudgetSummarySilently_(); // the selected month changed, so every derived Actual figure needs to be recomputed against it
  ui.alert('Budget!B2 set to ' + currentMonthLabel + '.');
}
// =================== MONTHLY BUDGET SIT-DOWN =========================
// Replaces the earlier "copy everything forward" Roll Forward tool with
// something closer to an actual monthly budget review:
//   - Fixed essentials (rent, insurance, debt payments)      -> copied silently
//   - Fluctuating essentials (groceries, utilities, transit,
//     fuel)                                                  -> asks what you
//                                                                 actually spent
//   - Discretionary / non-essential categories                -> left out
//                                                                 entirely
//   - Income rows follow the same Fixed/Variable split, using the
//     Income_Stability already stored on each Budget Plan row.
// Cancelling any prompt aborts the whole run — nothing is written to the
// sheet until every prompt has been answered. See
// "apps-script-budget-tools-guide.md" for full usage.
// One-time (safe to re-run) setup: fills in Categories!Income_Stability_Default
// (column G) for the 8 essential expense categories with a recommended
// fixed/fluctuating split. Only fills blank cells — never overwrites a
// value you (or a previous run) already set.
function classifyFixedVsFluctuating() {
  var ui = SpreadsheetApp.getUi();
  var FIXED = ['SUB-HOUSING-RENT', 'SUB-INSURANCE-GENERAL', 'SUB-DEBT-PAYMENTS'];
  var FLUCTUATING = ['SUB-HOUSING-GAS', 'SUB-HOUSING-ELECTRIC', 'SUB-FOOD-GROCERIES', 'SUB-TRANSPORT-PUBLIC', 'SUB-TRANSPORT-FUEL'];
  var sh = sheet_('Categories');
  var rows = readTable_('Categories');
  var filled = 0, skipped = 0;
  var stabilityCol = col_('Categories', 'Income_Stability_Default');
  rows.forEach(function (r) {
    var isFixed = FIXED.indexOf(r.Category_ID) !== -1;
    var isFluctuating = FLUCTUATING.indexOf(r.Category_ID) !== -1;
    if (!isFixed && !isFluctuating) return;
    if (r.Income_Stability_Default) { skipped++; return; } // never overwrite an existing value
    sh.getRange(r._row, stabilityCol).setValue(isFixed ? 'Fixed' : 'Variable');
    filled++;
  });
  logChange_('Classify Fixed vs Fluctuating', 'Filled ' + filled + ' categor' + (filled === 1 ? 'y' : 'ies') + (skipped ? ('; ' + skipped + ' already set') : ''));
  ui.alert(
    'Classified ' + filled + ' categor' + (filled === 1 ? 'y' : 'ies') + '.' +
    (skipped ? (' ' + skipped + ' already had a value and were left untouched.') : '') +
    '\n\nReview/edit Categories column G (Income_Stability_Default) any time — the sit-down tool reads it fresh every run, no need to re-run this setup.'
  );
}
function monthlyBudgetSitDown() {
  var ui = SpreadsheetApp.getUi();
  var tz = getTz_();
  var rows = readTable_('Budget Plan');
  if (!rows.length) { ui.alert('No Budget Plan rows found yet.'); return; }
  var months = rows
    .filter(function (r) { return r.Active_Flag === 'Yes' && r.Month_Start; })
    .map(function (r) { return new Date(r.Month_Start); });
  if (!months.length) { ui.alert('No active Budget Plan rows found to review.'); return; }
  // sourceMonth itself is just picking out whichever stored Month_Start is
  // most recent — no reconstruction, so it exactly matches what's already
  // in the sheet no matter what time-of-day component that row happens to
  // carry. The bug (v0.0.20 fix, was Finding 9 in the 2026-08-17 audit) was
  // downstream of here: everything from suggestedTarget onward used to be
  // rebuilt via new Date(year, month, 1), which is midnight in the Apps
  // Script runtime's own implicit timezone, NOT the spreadsheet's real one
  // (getTz_()) — Google Sheets always displays/matches dates in its own
  // timezone, so that mismatch silently wrote every Sit-Down-created Budget
  // Plan row with a Month_Start that LOOKS like the right month but isn't
  // sitting at a clean midnight-of-day-1 in the spreadsheet's own timezone.
  // Combined with insertBudgetRow_()'s exact-equality SUMIFS match, that
  // meant Budget's "Budgeted" column silently read $0 for almost every
  // category, almost every month. Fixed here by staying in tz-safe
  // 'yyyy-MM' string space (monthKey_/shiftMonthKey_/monthStartFromKey_)
  // instead of ever reconstructing a raw Date via new Date(y, m, 1).
  var sourceMonth = new Date(Math.max.apply(null, months.map(function (d) { return d.getTime(); })));
  var sourceMonthKey = monthKey_(sourceMonth, tz);
  var suggestedTargetKey = shiftMonthKey_(sourceMonthKey, 1);
  var sourceMonthLabel = Utilities.formatDate(sourceMonth, tz, 'MMMM yyyy');
  var monthResp = ui.prompt(
    'Monthly Budget Sit-Down',
    'Reviewing ' + sourceMonthLabel + ' to set up the next month.\n\nWhich month are we setting up? (format: yyyy-MM)',
    ui.ButtonSet.OK_CANCEL
  );
  if (monthResp.getSelectedButton() !== ui.Button.OK) return;
  var input = (monthResp.getResponseText() || '').trim() || suggestedTargetKey;
  var m = input.match(/^(\d{4})-(\d{1,2})$/);
  if (!m) { ui.alert('Please enter a month like 2026-09.'); return; }
  var targetMonthKey = m[1] + '-' + pad_(parseInt(m[2], 10), 2);
  var targetMonth = monthStartFromKey_(targetMonthKey, tz);
  var targetMonthLabel = Utilities.formatDate(targetMonth, tz, 'MMMM yyyy');
  // Matched by tz-safe month-key string, not exact Date equality, so this
  // still correctly finds existing rows even if they (or older, pre-fix
  // rows already in the sheet) don't sit at a perfectly clean midnight.
  var sourceRows = rows.filter(function (r) {
    return r.Active_Flag === 'Yes' && r.Month_Start && monthKey_(new Date(r.Month_Start), tz) === sourceMonthKey;
  });
  var targetSubIds = rows
    .filter(function (r) { return r.Month_Start && monthKey_(new Date(r.Month_Start), tz) === targetMonthKey; })
    .map(function (r) { return r.Subcategory_ID; });
  var categories = readTable_('Categories');
  function categoryFor(subId) { return categories.filter(function (c) { return c.Category_ID === subId; })[0]; }
  var toWrite = [];  // collected first, written only once every prompt is answered
  var fixedCount = 0, fluctuatingCount = 0, skippedExisting = 0;
  var leftOutNames = [];
  for (var i = 0; i < sourceRows.length; i++) {
    var r = sourceRows[i];
    if (targetSubIds.indexOf(r.Subcategory_ID) !== -1) { skippedExisting++; continue; }
    var isIncome = r.Transaction_Type === 'Income';
    var isEssential = r.Essential_Flag === 'Y';
    var cat = categoryFor(r.Subcategory_ID);
    var name = (cat && cat.Category_Name) || r.Subcategory_ID;
    if (!isIncome && !isEssential) {
      leftOutNames.push(name); // discretionary — left out entirely, on purpose
      continue;
    }
    // Fixed/variable comes from the Budget Plan row itself for income
    // (already tracked there), or from Categories!Income_Stability_Default
    // for essential expenses. Unclassified defaults to "Variable" (asks
    // rather than silently guessing) — run Classify Fixed vs Fluctuating
    // to set this properly for any category missing it.
    var stability = isIncome ? (r.Income_Stability || 'Variable') : ((cat && cat.Income_Stability_Default) || 'Variable');
    var amount = r.Budgeted_Amount || 0;
    if (stability === 'Fixed') {
      toWrite.push({ r: r, amount: amount });
      fixedCount++;
      continue;
    }
    // Fluctuating — ask what actually happened last month.
    var resp = ui.prompt(
      'Monthly Budget Sit-Down',
      'What did you actually spend on ' + name + ' in ' + sourceMonthLabel + '?\n' +
        sourceMonthLabel + '\'s amount was $' + amount.toFixed(2) + '. Type a new amount, or leave blank to keep $' + amount.toFixed(2) + '.',
      ui.ButtonSet.OK_CANCEL
    );
    if (resp.getSelectedButton() !== ui.Button.OK) {
      ui.alert('Cancelled — nothing was changed.');
      return;
    }
    var typed = (resp.getResponseText() || '').trim();
    var newAmount = typed === '' ? amount : Number(typed);
    if (typed !== '' && (!isFinite(newAmount) || newAmount < 0)) {
      ui.alert('"' + typed + '" isn\'t a valid amount — cancelling. Nothing was changed. Please run this again.');
      return;
    }
    toWrite.push({ r: r, amount: newAmount });
    fluctuatingCount++;
  }
  if (!toWrite.length) {
    ui.alert('Nothing to add for ' + targetMonthLabel + ' — every eligible category already had a row, or none qualified.');
    return;
  }
  var bpSheet = sheet_('Budget Plan');
  var seq = rows.reduce(function (mx, r) {
    var mm = String(r.Budget_ID || '').match(/(\d+)\s*$/);
    return mm ? Math.max(mx, parseInt(mm[1], 10)) : mx;
  }, 0);
  var monthTag = Utilities.formatDate(targetMonth, tz, 'yyyyMM');
  toWrite.forEach(function (item) {
    seq++;
    var r = item.r;
    bpSheet.appendRow(rowFromHeaders_('Budget Plan', {
      Budget_ID: 'BUD-' + monthTag + '-' + pad_(seq, 3),
      Month_Start: targetMonth,
      Member_ID: r.Member_ID || '',
      Account_ID: r.Account_ID || '',
      Transaction_Type: r.Transaction_Type || '',
      Subcategory_ID: r.Subcategory_ID,
      Budgeted_Amount: item.amount,
      Essential_Flag: r.Essential_Flag || '',
      Income_Stability: r.Income_Stability || '',
      Notes: 'Set via Monthly Budget Sit-Down from ' + sourceMonthLabel + '.',
      Active_Flag: 'Yes'
    }));
  });
  var summary = 'Set up ' + targetMonthLabel + ':\n' +
    '• ' + fixedCount + ' fixed categor' + (fixedCount === 1 ? 'y' : 'ies') + ' copied silently\n' +
    '• ' + fluctuatingCount + ' fluctuating categor' + (fluctuatingCount === 1 ? 'y' : 'ies') + ' updated with what you typed' +
    (skippedExisting ? ('\n• ' + skippedExisting + ' skipped (already had a row for ' + targetMonthLabel + ')') : '');
  if (leftOutNames.length) {
    summary += '\n\nLeft out on purpose (add these yourself if you want them budgeted this month): ' + leftOutNames.join(', ');
  }
  logChange_('Monthly Budget Sit-Down', 'Set up ' + targetMonthLabel + ': ' + fixedCount + ' fixed, ' + fluctuatingCount +
    ' fluctuating' + (skippedExisting ? ', ' + skippedExisting + ' skipped' : '') + (leftOutNames.length ? '; left out: ' + leftOutNames.join(', ') : ''));
  ui.alert(summary);
  // Offer to advance Budget!B2 right now, instead of leaving it as a
  // manual follow-up step someone has to remember — this is the gap
  // that let Budget!B2 sit on January while Budget Plan had already
  // moved on to later months.
  var jumpResp = ui.alert(
    'Update Budget month?',
    'Set Budget!B2 to ' + targetMonthLabel + ' now, so Budget, Dashboard, and This Week Snapshot show it immediately?',
    ui.ButtonSet.YES_NO
  );
  if (jumpResp === ui.Button.YES) {
    sheet_('Budget').getRange('B2').setValue(targetMonth);
    logChange_('Monthly Budget Sit-Down', 'Budget!B2 → ' + targetMonthLabel + ' (end-of-sit-down prompt)');
    ui.alert('Budget!B2 set to ' + targetMonthLabel + '.');
  } else {
    ui.alert('No problem — Budget!B2 is unchanged. Run "Jump to Current Month" any time you\'re ready to switch.');
  }
  refreshBudgetSummarySilently_(); // new Budget Plan rows (and possibly a new Budget!B2) both affect these figures, regardless of which branch above ran
}
// =================== DATA HEALTH CHECK (v0.0.23) ========================
// A read-only diagnostic scan for the exact bug class that has bitten this
// project before: orphaned foreign keys and name-mismatch drift. Two real
// examples that motivated this: the CAT-INCOME/INCOME dangling-reference
// bug (a Subcategory's Parent_Category_ID pointing at an ID that didn't
// actually exist on Categories, fixed in v0.0.19) and the "2 Cat Litter
// subcategories" duplicate-name issue flagged in the project roadmap.
// Same contract as showDiagnostics() below — this NEVER calls
// setValue()/setValues() anywhere, it only reads and reports.
// runDataHealthCheck_() returns the raw findings (grouped by check, so the
// caller decides how to present them); dataHealthCheck() (the menu entry
// point) formats them into one alert, same pattern as showDiagnostics().
function runDataHealthCheck_() {
  var findings = [];
  function flag(section, msg) { findings.push({ section: section, msg: msg }); }

  var categories = readTable_('Categories');
  var activeCategoryIds = {};    // Record_Type === 'Category', Active_Flag === 'Yes'
  var activeSubcategoryIds = {}; // Record_Type === 'Subcategory', Active_Flag === 'Yes'
  var allActiveIdCounts = {};    // any Record_Type, Active_Flag === 'Yes' — for duplicate-ID detection

  categories.forEach(function (c) {
    var id = String(c.Category_ID || '').trim();
    if (c.Active_Flag !== 'Yes' || !id) return;
    allActiveIdCounts[id] = (allActiveIdCounts[id] || 0) + 1;
    if (c.Record_Type === 'Category') activeCategoryIds[id] = true;
    if (c.Record_Type === 'Subcategory') activeSubcategoryIds[id] = true;
  });

  // Check 1a: exact duplicate names — same Record_Type + Parent_Category_ID
  // + name (case/whitespace-insensitive) — almost certainly an accidental
  // double-entry, the known "2 Cat Litter subcategories" issue.
  // Check 1b: same name reused under a DIFFERENT parent — not necessarily
  // wrong (e.g. "Other" could legitimately exist under two categories),
  // but worth a look; this is the "name-mismatch drift" class asked for.
  var nameGroups = {};
  categories.forEach(function (c) {
    if (c.Active_Flag !== 'Yes' || !c.Category_Name) return;
    var type = c.Record_Type;
    var name = String(c.Category_Name).trim();
    var parentKey = String(c.Parent_Category_ID || '').trim() || '(top-level)';
    var groupKey = type + '||' + name.toLowerCase();
    var group = nameGroups[groupKey] || (nameGroups[groupKey] = { name: name, type: type, parents: {} });
    if (!group.parents[parentKey]) group.parents[parentKey] = [];
    group.parents[parentKey].push(name + ' (' + c.Category_ID + ')');
  });
  Object.keys(nameGroups).forEach(function (key) {
    var group = nameGroups[key];
    var parentKeys = Object.keys(group.parents);
    parentKeys.forEach(function (pk) {
      var entries = group.parents[pk];
      if (entries.length > 1) {
        flag('Duplicate names', 'Exact duplicate: ' + entries.join(' and ') + ' — same name, same parent (' + pk + '). Likely an accidental double-entry.');
      }
    });
    if (parentKeys.length > 1) {
      var oneEach = parentKeys.map(function (pk) { return group.parents[pk][0] + ', parent ' + pk; });
      flag('Possible name drift', '"' + group.name + '" (' + group.type + ') appears under more than one parent: ' + oneEach.join('; ') + '. Confirm this is intentional and not the same category typed twice.');
    }
  });

  // Check 2: duplicate active Category_ID values (any Record_Type) — IDs
  // should be unique across the whole sheet.
  Object.keys(allActiveIdCounts).forEach(function (id) {
    if (allActiveIdCounts[id] > 1) {
      flag('Duplicate IDs', 'Category_ID "' + id + '" is used by ' + allActiveIdCounts[id] + ' active rows on Categories — IDs should be unique.');
    }
  });

  // Check 3: orphaned Parent_Category_ID on active Subcategory rows — the
  // exact bug class that broke CAT-INCOME/INCOME in v0.0.19.
  categories.forEach(function (c) {
    if (c.Record_Type !== 'Subcategory' || c.Active_Flag !== 'Yes') return;
    var parent = String(c.Parent_Category_ID || '').trim();
    if (!parent) {
      flag('Orphaned parent link', 'Subcategory "' + c.Category_Name + '" (' + c.Category_ID + ') has no Parent_Category_ID.');
    } else if (!activeCategoryIds[parent]) {
      flag('Orphaned parent link', 'Subcategory "' + c.Category_Name + '" (' + c.Category_ID + ') has Parent_Category_ID "' + parent + '", which doesn\'t match any active top-level Category.');
    }
  });

  // Check 4: orphaned category, subcategory, and member links in
  // Transactions. v0.0.24 adds the two category-ID checks after the live
  // audit found four rows whose valid Effective_Subcategory_ID concealed an
  // invalid Manual_Category_ID / Effective_Category_ID pair.
  var members = readTable_('Household Members');
  var activeMemberIds = {};
  members.forEach(function (m) {
    if (m.Active_Flag === 'Yes') activeMemberIds[String(m.Member_ID || '').trim()] = true;
  });
  var transactions = readTable_('Transactions');
  var orphanManualCategoryTxIds = [];
  var orphanEffectiveCategoryTxIds = [];
  var orphanSubIdCount = 0, orphanMemberCount = 0;
  transactions.forEach(function (t) {
    var txId = String(t.Transaction_ID || 'row ' + t._row).trim();
    var manualCategoryId = String(t.Manual_Category_ID || '').trim();
    if (manualCategoryId && !activeCategoryIds[manualCategoryId]) orphanManualCategoryTxIds.push(txId);
    var effectiveCategoryId = String(t.Effective_Category_ID || '').trim();
    if (effectiveCategoryId && !activeCategoryIds[effectiveCategoryId]) orphanEffectiveCategoryTxIds.push(txId);
    var subId = String(t.Effective_Subcategory_ID || '').trim();
    if (subId && !activeSubcategoryIds[subId]) orphanSubIdCount++;
    var memId = String(t.Member_ID || '').trim();
    if (memId && !activeMemberIds[memId]) orphanMemberCount++;
  });
  function summarizeTransactionIds(ids) {
    var shown = ids.slice(0, 10);
    return shown.join(', ') + (ids.length > shown.length ? ' (plus ' + (ids.length - shown.length) + ' more)' : '');
  }
  if (orphanManualCategoryTxIds.length) {
    flag('Orphaned transaction links', orphanManualCategoryTxIds.length +
      ' Transactions row(s) have a Manual_Category_ID that doesn\'t match any active top-level Category: ' +
      summarizeTransactionIds(orphanManualCategoryTxIds) + '.');
  }
  if (orphanEffectiveCategoryTxIds.length) {
    flag('Orphaned transaction links', orphanEffectiveCategoryTxIds.length +
      ' Transactions row(s) have an Effective_Category_ID that doesn\'t match any active top-level Category: ' +
      summarizeTransactionIds(orphanEffectiveCategoryTxIds) + '.');
  }
  if (orphanSubIdCount) {
    flag('Orphaned transaction links', orphanSubIdCount + ' Transactions row(s) have an Effective_Subcategory_ID that doesn\'t match any active Subcategory.');
  }
  if (orphanMemberCount) {
    flag('Orphaned transaction links', orphanMemberCount + ' Transactions row(s) have a Member_ID that doesn\'t match any active Household Member.');
  }

  // Check 4b: Potential_Duplicate_Flag is derived from Duplicate_Key by the
  // linear-time v0.0.26 engine. Any mismatch means a failed/interrupted
  // refresh or an unsupported direct edit; Is_Duplicate is intentionally
  // not part of this check because it is the separate reviewed decision.
  var expectedDuplicateFlags = calcPotentialDuplicateFlags_(transactions.map(function (t) { return t.Duplicate_Key; })).flags;
  var driftedDuplicateFlagTxIds = [];
  transactions.forEach(function (t, index) {
    var actualFlag = String(t.Potential_Duplicate_Flag || '');
    if (actualFlag !== expectedDuplicateFlags[index]) {
      driftedDuplicateFlagTxIds.push(String(t.Transaction_ID || 'row ' + t._row).trim());
    }
  });
  if (driftedDuplicateFlagTxIds.length) {
    flag('Duplicate flag drift', driftedDuplicateFlagTxIds.length +
      ' Transactions row(s) have a Potential_Duplicate_Flag that does not match the full ledger: ' +
      summarizeTransactionIds(driftedDuplicateFlagTxIds) + '. Run Refresh Duplicate Flags.');
  }

  // Check 5: orphaned Subcategory_ID on active Budget Plan rows.
  var budgetPlan = readTable_('Budget Plan');
  var orphanPlanCount = 0;
  budgetPlan.forEach(function (r) {
    if (r.Active_Flag !== 'Yes') return;
    var subId = String(r.Subcategory_ID || '').trim();
    if (subId && !activeSubcategoryIds[subId]) orphanPlanCount++;
  });
  if (orphanPlanCount) {
    flag('Orphaned budget links', orphanPlanCount + ' active Budget Plan row(s) have a Subcategory_ID that doesn\'t match any active Subcategory.');
  }

  // Checks 6-7: Budget's expense section (column E) and Dashboard's
  // category mirror (column G) — blank/orphaned Subcategory_ID entries,
  // and a Budget-vs-Dashboard category-set mismatch (expense categories
  // only — Dashboard has no income section). Same anchors/columns
  // recomputeBudgetSummaryMetrics_() above already relies on.
  var budget = sheet_('Budget');
  var dash = sheet_('Dashboard');
  var expenseHeaderRow = findRowByLabel_(budget, 'Category');
  var totalExpenseRow = findRowByLabel_(budget, 'Total Expenses');
  var budgetExpenseSubIds = [];
  for (var er = expenseHeaderRow + 1; er < totalExpenseRow; er++) {
    var bId = String(budget.getRange(er, 5).getValue() || '').trim();
    if (!bId) {
      flag('Blank/orphaned Subcategory_ID', 'Budget row ' + er + ' (expense section) has a blank Subcategory_ID.');
    } else if (!activeSubcategoryIds[bId]) {
      flag('Blank/orphaned Subcategory_ID', 'Budget row ' + er + ' (expense section) has Subcategory_ID "' + bId + '", which doesn\'t match any active Subcategory.');
    } else {
      budgetExpenseSubIds.push(bId);
    }
  }
  var dashCatVals = dash.getRange('B6:G40').getValues();
  var dashboardSubIds = [];
  for (var di = 0; di < dashCatVals.length; di++) {
    if (dashCatVals[di][0] === '' || dashCatVals[di][0] === null) break;
    var dId = String(dashCatVals[di][5] || '').trim();
    if (!dId) {
      flag('Blank/orphaned Subcategory_ID', 'Dashboard category row ' + (di + 6) + ' has a blank Subcategory_ID.');
    } else if (!activeSubcategoryIds[dId]) {
      flag('Blank/orphaned Subcategory_ID', 'Dashboard category row ' + (di + 6) + ' has Subcategory_ID "' + dId + '", which doesn\'t match any active Subcategory.');
    } else {
      dashboardSubIds.push(dId);
    }
  }
  var budgetSet = {}; budgetExpenseSubIds.forEach(function (id) { budgetSet[id] = true; });
  var dashSet = {}; dashboardSubIds.forEach(function (id) { dashSet[id] = true; });
  var onlyInBudget = budgetExpenseSubIds.filter(function (id) { return !dashSet[id]; });
  var onlyInDash = dashboardSubIds.filter(function (id) { return !budgetSet[id]; });
  if (onlyInBudget.length) {
    flag('Budget/Dashboard mismatch', 'Subcategory_ID(s) on Budget\'s expense section but missing from Dashboard\'s category mirror: ' + onlyInBudget.join(', ') + '.');
  }
  if (onlyInDash.length) {
    flag('Budget/Dashboard mismatch', 'Subcategory_ID(s) on Dashboard\'s category mirror but missing from Budget\'s expense section: ' + onlyInDash.join(', ') + '.');
  }

  return findings;
}
// Menu entry point — runs runDataHealthCheck_() and shows the results via
// ui.alert(), the same read-only, never-calls-setValue pattern as
// showDiagnostics() below. No Change Log entry, for the same reason
// showDiagnostics() doesn't log one — this changes nothing, so there's
// nothing to log.
function dataHealthCheck() {
  var ui = SpreadsheetApp.getUi();
  try {
    var findings = runDataHealthCheck_();
    var lines = [];
    if (!findings.length) {
      lines.push('✓ No issues found. Categories, Household Members, Budget Plan, Transactions, Budget, and Dashboard all cross-reference cleanly.');
    } else {
      lines.push('⚠ ' + findings.length + ' issue(s) found:');
      lines.push('');
      var bySection = {};
      findings.forEach(function (f) {
        (bySection[f.section] = bySection[f.section] || []).push(f.msg);
      });
      Object.keys(bySection).forEach(function (section) {
        lines.push(section + ':');
        bySection[section].forEach(function (msg) { lines.push('  • ' + msg); });
        lines.push('');
      });
    }
    ui.alert('Budget Tools — Data Health Check', lines.join('\n'), ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('Data Health Check failed: ' + e.message);
  }
}
// ==================== DATA DICTIONARY (v0.0.23) ==========================
// A visible, self-generating reference sheet mapping every real sheet to
// its ID column, ID scheme, foreign-key relationships to other sheets, and
// any hidden/behind-the-scenes columns — the answer to "what does this ID
// mean and where else does it show up" without reading Code.gs itself.
// Same pattern as RELEASE_HISTORY_/Release Notes below: this hand-
// maintained array is the single source of truth — update it here whenever
// a sheet's schema changes — and syncDataDictionary_() rewrites the sheet
// from it every time it runs (a full rewrite, not an append — this is a
// small reference table, not an ever-growing history, so there's nothing
// to preserve between runs). Unlike Change Log/Release Notes, this sheet
// is left VISIBLE by default — it's meant to be opened and read, not
// archival.
var DATA_DICTIONARY_ = [
  { sheet: 'Categories', idColumn: 'Category_ID', idScheme: 'Top-level Category rows: CAT-<NAME> (e.g. CAT-HOUSING) — except Income, whose ID is the bare string "INCOME" (a documented, intentional exception; see v0.0.19 in Release Notes). Subcategory rows: SUB-<CATEGORY>-<NAME> (e.g. SUB-HOUSING-RENT).', foreignKeys: 'Parent_Category_ID → this sheet\'s own Category_ID, but only on Subcategory rows (must point to an active Category row).', notes: 'Record_Type ("Category" vs "Subcategory") distinguishes the two levels living in this one sheet/column. No hidden columns.' },
  { sheet: 'Household Members', idColumn: 'Member_ID', idScheme: 'MEM-0xx, e.g. MEM-001 = Bianca, MEM-002 = Jonathan.', foreignKeys: 'Referenced by Transactions.Member_ID, Budget Plan.Member_ID, Accounts.Owner_Member_ID.', notes: 'No hidden columns.' },
  { sheet: 'Accounts', idColumn: 'Account_ID', idScheme: 'ACC-<LABEL>, e.g. ACC-LEGACY-001.', foreignKeys: 'Owner_Member_ID → Household Members.Member_ID. Referenced by Raw Transactions.Account_ID and Import Batches.Account_ID.', notes: 'No hidden columns.' },
  { sheet: 'Import Batches', idColumn: 'Import_Batch_ID', idScheme: 'One row per import run.', foreignKeys: 'Account_ID → Accounts.Account_ID. Referenced by Raw Transactions.Import_Batch_ID.', notes: 'No hidden columns.' },
  { sheet: 'Raw Transactions', idColumn: 'Raw_Record_ID', idScheme: 'One row per imported bank line, before normalization.', foreignKeys: 'Import_Batch_ID → Import Batches.Import_Batch_ID. Account_ID → Accounts.Account_ID.', notes: 'Transactions rows are built from these; Raw_Payload holds the original source data verbatim.' },
  { sheet: 'Transactions', idColumn: 'Transaction_ID', idScheme: 'TXN-... — one per posted transaction.', foreignKeys: 'Member_ID → Household Members.Member_ID. Manual_Category_ID / Auto_Category_ID / Effective_Category_ID → Categories.Category_ID (Record_Type=Category). Manual_Subcategory_ID / Auto_Subcategory_ID / Effective_Subcategory_ID → Categories.Category_ID (Record_Type=Subcategory).', notes: 'Hidden/behind-the-scenes columns: Duplicate_Key (computed dedupe fingerprint), Potential_Duplicate_Flag (linear-time full-ledger review aid), Is_Duplicate (reviewed financial control) — Refresh Budget Summary and Income History only count rows where Is_Duplicate = "No". Effective_* resolves Manual_* first, falling back to Auto_* (see addTransaction() in Code.gs).' },
  { sheet: 'Budget Plan', idColumn: 'Budget_ID', idScheme: 'One row per category per month.', foreignKeys: 'Member_ID → Household Members.Member_ID. Account_ID → Accounts.Account_ID. Subcategory_ID → Categories.Category_ID (Record_Type=Subcategory).', notes: 'Active_Flag governs whether a row counts toward Budget/Dashboard\'s Budgeted figures — see groupAmountsByKey_() in Code.gs.' },
  { sheet: 'Budget', idColumn: 'n/a — presentation sheet, not a data table', idScheme: 'n/a', foreignKeys: 'Column E, on the income and expense line-item rows, holds that row\'s Subcategory_ID → Categories.Category_ID — the hidden join key recomputeBudgetSummaryMetrics_() in Code.gs uses to match rows by ID instead of position.', notes: 'E2 holds the freshness indicator (v0.0.23, updateFreshnessIndicator_() in Code.gs) — green when the numbers below were refreshed within 24 hours, red otherwise.' },
  { sheet: 'Dashboard', idColumn: 'n/a — presentation sheet, not a data table', idScheme: 'n/a', foreignKeys: 'Column G, on the category-mirror rows (6–40), holds that row\'s Subcategory_ID → Categories.Category_ID — same hidden join key as Budget!E.', notes: 'F2 holds the freshness indicator (v0.0.23) — same as Budget!E2.' },
  { sheet: 'Income History', idColumn: 'n/a — one row per month (Month column is the key)', idScheme: 'n/a', foreignKeys: 'No stored foreign key, but Fixed/Variable Income (Actual) are derived from Transactions (Transaction_Type=Income, grouped by month) — see recomputeIncomeHistory_() in Code.gs.', notes: 'Rows whose Notes column contains "Preserved" predate the transaction ledger and are left untouched by the recompute — there\'s nothing to derive them from.' },
  { sheet: 'Change Log', idColumn: 'n/a — append-only', idScheme: 'One row per write action, oldest first.', foreignKeys: 'None.', notes: 'Hidden sheet. Written by logChange_() in Code.gs — every write-capable tool appends one row here.' },
  { sheet: 'Release Notes', idColumn: 'Version', idScheme: 'vX.Y.Z, matches APP_VERSION history.', foreignKeys: 'None.', notes: 'Hidden sheet, kept in sync with RELEASE_HISTORY_ in Code.gs by syncReleaseNotes_().' },
  { sheet: 'Tip Tracker', idColumn: 'n/a — one row per shift', idScheme: 'Date-based.', foreignKeys: 'Each shift posts two linked rows to Transactions (Wages, Tips) — see postShiftTransaction_() in Code.gs.', notes: 'Tip-out % and hourly rate live in named ranges on this sheet, not hardcoded — see getTipTrackerSettings_() in Code.gs.' },
  { sheet: 'Categorization Rules', idColumn: 'Rule_ID', idScheme: 'Schema exists, not currently used.', foreignKeys: 'Account_ID → Accounts.Account_ID. Suggested_Category_ID / Suggested_Subcategory_ID → Categories.Category_ID.', notes: '⚠ Not referenced anywhere in Code.gs — not wired into any tool yet.' },
  { sheet: 'Recurring Transactions', idColumn: 'Recurring_ID', idScheme: 'Schema exists, not currently used.', foreignKeys: 'Account_ID → Accounts.Account_ID. Member_ID → Household Members.Member_ID. Category_ID / Subcategory_ID → Categories.Category_ID.', notes: '⚠ Not referenced anywhere in Code.gs — not wired into any tool yet.' }
];
var DATA_DICTIONARY_SHEET_NAME = 'Data Dictionary';
// Creates the Data Dictionary sheet (header row, VISIBLE — unlike Change
// Log/Release Notes, this one is meant to be opened and read, not
// archival) the first time anything runs. Safe to call every time — a
// no-op if it already exists.
function getOrCreateDataDictionarySheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(DATA_DICTIONARY_SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(DATA_DICTIONARY_SHEET_NAME);
    sh.getRange(1, 1, 1, 5).setValues([['Sheet', 'ID Column', 'ID Scheme', 'Foreign Keys (→ other sheets)', 'Notes / Hidden Columns']]);
    sh.getRange(1, 1, 1, 5).setFontWeight('bold');
    sh.setColumnWidth(1, 150);
    sh.setColumnWidth(2, 160);
    sh.setColumnWidth(3, 260);
    sh.setColumnWidth(4, 320);
    sh.setColumnWidth(5, 420);
    sh.setFrozenRows(1);
  }
  return sh;
}
// Full rewrite of the data rows from DATA_DICTIONARY_ every call — simpler
// than Release Notes' diff/append approach, since this is a small hand-
// maintained reference table (not an ever-growing history) and should
// always reflect Code.gs exactly as shipped. Best-effort, same as
// syncReleaseNotes_() — never lets a sync failure break whatever called it.
function syncDataDictionary_() {
  try {
    var sh = getOrCreateDataDictionarySheet_();
    var lastRow = sh.getLastRow();
    if (lastRow > 1) {
      sh.getRange(2, 1, lastRow - 1, 5).clearContent();
    }
    var rows = DATA_DICTIONARY_.map(function (d) {
      return [d.sheet, d.idColumn, d.idScheme, d.foreignKeys, d.notes];
    });
    sh.getRange(2, 1, rows.length, 5).setValues(rows);
  } catch (e) {
    // Best-effort — never let this break the tool that called it.
  }
}
// Menu entry point — just activates the sheet so it's easy to find; the
// content itself is kept current by syncDataDictionary_() (called from
// onOpen() above), so there's nothing to compute here.
function viewDataDictionary() {
  syncDataDictionary_();
  sheet_(DATA_DICTIONARY_SHEET_NAME).activate();
}
// =================== VERSION & DIAGNOSTICS =============================
// A single place to check "is the pasted code actually current" and
// "does the script's view of the workbook's layout match reality" —
// three separate bugs this project hit (a truncated HTML paste, a
// truncated Code.gs paste, and a timezone mismatch that made Budget!B2
// look correct when it wasn't) all boiled down to some version of that
// question, and each one used to take a live data read to diagnose.
// This is entirely read-only — it never writes anything to the sheet.
// APP_VERSION follows v0.0.x — bump the trailing number by one, and add
// a matching entry to RELEASE_HISTORY_ just below, any time Code.gs
// changes in a way worth remembering. "Did you paste the latest version"
// becomes a one-glance check instead of a guess, and the Release Notes
// sheet (see syncReleaseNotes_() below) picks up the new entry
// automatically the next time anything runs.
var APP_VERSION = 'v0.0.28';
// ==================== RELEASE NOTES =====================================
// The full version history — one entry per shipped feature or fix,
// oldest first. This array is the single source of truth: add one entry
// here (and bump APP_VERSION above to match) every time this file
// changes in a way worth remembering. syncReleaseNotes_() below keeps a
// hidden "Release Notes" sheet in sync with this list automatically —
// nothing here needs to be typed into the spreadsheet by hand.
var RELEASE_HISTORY_ = [
  { version: 'v0.0.1', date: '2026-08-16', summary: 'Fixed Excel Table structural fragility — rewrote 272 structured-reference formulas (tblTransactions[...], tblBudgetPlan[...]) in Budget and Income History to plain ranges. Verified byte-for-byte identical output via LibreOffice recalculation.' },
  { version: 'v0.0.2', date: '2026-08-17', summary: 'Added Add Transaction quick-entry tool — a popup form that auto-generates the transaction ID, raw-record copy, import batch, dedupe key, and timestamps.' },
  { version: 'v0.0.3', date: '2026-08-17', summary: 'Fixed a truncated AddTransactionDialog.html paste that had broken the category dropdown.' },
  { version: 'v0.0.4', date: '2026-08-17', summary: 'Fixed the category dropdown silently resetting to the first item on a same-button reclick.' },
  { version: 'v0.0.5', date: '2026-08-17', summary: 'Added Add Category quick-entry tool — auto-generates category IDs and inserts a live-linked row on Budget (and Dashboard, for expenses).' },
  { version: 'v0.0.6', date: '2026-08-17', summary: 'Added View Category Spending — a read-only tool charting weekly totals for one category over the trailing 3/6/12 months.' },
  { version: 'v0.0.7', date: '2026-08-17', summary: 'Fixed a "script function not found" error, traced to an incomplete Code.gs paste.' },
  { version: 'v0.0.8', date: '2026-08-17', summary: 'Added Refresh This Week Snapshot — a 10-stat weekly panel on Dashboard (spending vs. last week, top movers, pace projection, weekly budget remaining, biggest transaction, essential/discretionary split, net cash flow, who spent what, a data-quality nudge).' },
  { version: 'v0.0.9', date: '2026-08-17', summary: 'Fixed Budget!B2 staleness with a 3-part fix: Jump to Current Month, an end-of-Sit-Down offer to advance it, and a staleness warning in This Week Snapshot.' },
  { version: 'v0.0.10', date: '2026-08-17', summary: 'Added Monthly Budget Sit-Down and Classify Fixed vs Fluctuating — replaced the old "copy everything forward" roll-forward with a real monthly review (fixed essentials copy silently, fluctuating essentials prompt for actual spend, discretionary left out).' },
  { version: 'v0.0.11', date: '2026-08-17', summary: 'Added Sync Category Names to Budget & Dashboard — live-links every category name on both sheets to the Categories sheet by ID instead of typed text.' },
  { version: 'v0.0.12', date: '2026-08-17', summary: 'Fixed a timezone bug where Jump to Current Month could falsely report "already correct" — added getTz_()/monthKey_()/monthStartFromKey_() to always use the spreadsheet\'s own timezone.' },
  { version: 'v0.0.13', date: '2026-08-17', summary: 'Refactored every data sheet (Transactions, Raw Transactions, Import Batches, Categories, Budget Plan, Household Members, Accounts) to a header-based column lookup (headerMap_/col_/colLetter_/rowFromHeaders_) instead of hardcoded column letters/numbers.' },
  { version: 'v0.0.14', date: '2026-08-17', summary: 'Added Show Version & Diagnostics — a one-click check of the code version, the timezone in effect, whether Budget!B2 matches the current month, and a layout check per sheet.' },
  { version: 'v0.0.15', date: '2026-08-17', summary: 'Added the Change Log — a hidden sheet every write-capable tool now logs to, surfaced as "Recent activity" inside Show Version & Diagnostics.' },
  { version: 'v0.0.16', date: '2026-08-17', summary: 'Added this Release Notes sheet and switched APP_VERSION to v0.0.x numbering — Show Version & Diagnostics now also surfaces the most recently shipped versions.' },
  { version: 'v0.0.17', date: '2026-08-17', summary: 'Fixed two bugs found in a full code review: (1) addCategory() was assigning new income categories the parent ID "INCOME" instead of the established "CAT-INCOME" convention used everywhere else in the data (predates this tool — confirmed against the original 2026-08-16 migration); (2) addTransaction() and getCategorySpendingData() built dates/month ranges using the Apps Script runtime\'s implicit timezone instead of the spreadsheet\'s own (via a new shiftMonthKey_() helper plus Utilities.parseDate()), matching the timezone-safety pattern already used elsewhere. Also corrected a stale comment in getCategorySpendingData() left over from before its header-based-lookup refactor.' },
  { version: 'v0.0.18', date: '2026-08-17', summary: 'Added Add Shift… — a tipped-employee income manager. Logs Sales/Cash Tips/CC Tips/Hours per shift to a new self-provisioning "Tip Tracker" sheet, auto-calculates tip-out (6% of Sales to floor, 1% of Sales to bar rounded up to the nearest $5, 2% of Credit Card Tips only) and Wages (Hours × an editable hourly rate, $17.60 to start) via named-range settings anyone can change without touching code, and posts two linked Transactions rows per shift (Wages, Tips) so shift income flows into Income History/Budget/Dashboard automatically. Includes a same-date duplicate-shift warn-and-confirm guard (not a hard block, since legitimate double shifts happen) and a live in-dialog preview of the tip-out breakdown as amounts are typed.' },
  { version: 'v0.0.19', date: '2026-08-17', summary: 'Corrected a data-integrity bug: reverted v0.0.17\'s change to addCategory() that assigned new income categories the parent ID "CAT-INCOME". Direct inspection of the live Categories sheet (prompted by a user-caught anomaly in two Add Shift-created rows) proved that assumption wrong — the real top-level Income category\'s Category_ID is the bare string "INCOME" (Income is a documented exception to the "CAT-" prefix convention used by every top-level Expense category), and all of its real subcategories correctly reference Parent_Category_ID = "INCOME". The "CAT-INCOME" value v0.0.17 relied on came from legacy Transaction rows\' Auto_Category_ID/Effective_Category_ID fields, which turned out to be an orphaned reference from the original 2026-08-16 migration, not a valid Categories-table ID. Also fixed the same hardcoded "CAT-INCOME" in ensureIncomeSubcategory_() and postShiftTransaction_() (both added in v0.0.18, so this never shipped to a released version before now). Lesson: verify IDs against the authoritative table directly, not derived/copied reference data.' },
  { version: 'v0.0.20', date: '2026-08-17', summary: 'Fixed the root cause of a critical bug found in a deep formula-level audit ("Finding 9"): Budget\'s expense "Budgeted" column was silently reading $0 for almost every category, almost every month, because insertBudgetRow_()\'s SUMIFS matched Budget Plan\'s Month_Start by EXACT equality against DATE(YEAR($B$2),MONTH($B$2),1) — but most Budget Plan rows aren\'t stored at a bit-for-bit-clean midnight-of-day-1, so the match silently failed. Root-caused to monthlyBudgetSitDown() (the tool that creates most Budget Plan rows going forward), which built its target/source month dates via new Date(year, month, 1) — midnight in the Apps Script runtime\'s own implicit timezone, not the spreadsheet\'s real one (getTz_()), the exact same class of bug fixed elsewhere in v0.0.12/v0.0.17 but previously left out of scope for this function specifically. Three-part fix: (1) monthlyBudgetSitDown() now builds every month date via the existing tz-safe monthKey_()/shiftMonthKey_()/monthStartFromKey_() helpers instead of new Date(y,m,1), so every Budget Plan row it writes from now on lands on a clean midnight in the spreadsheet\'s own timezone; (2) monthlyBudgetSitDown()\'s own row-matching (finding this month\'s / last month\'s Budget Plan rows) now compares tz-safe month-key strings instead of exact Date equality, so it correctly finds rows even if older, pre-fix data still has an unclean timestamp; (3) insertBudgetRow_()\'s Budgeted-column SUMIFS now matches Month_Start with a >=/< range instead of exact equality, so a category added via Add Category never reintroduces this bug even against imperfect historical data. Also made sameMonth_() (used by Refresh This Week Snapshot) timezone-safe the same way, on the same reasoning. This is a Code.gs-only fix — the spreadsheet-content side of Findings 1, 2, and 9 (the existing broken cells/values) was already fixed and delivered separately as a corrected workbook file; this release makes sure the bug cannot come back going forward.' },
  { version: 'v0.0.21', date: '2026-08-17', summary: 'Moved every "narrative" Budget/Dashboard metric off hand-picked spreadsheet cell references and onto the script, per Jonathan\'s request that nothing stay hardcoded. Previously, cells like NET, the Income vs Expenses recap, the Household Safety Number section, and Dashboard\'s Fixed/Variable Income (Actual) were live formulas naming SPECIFIC rows (e.g. "=Budget!D6+Budget!D10" for Fixed Income) — the exact failure class this project keeps hitting, where the formula looks fine until a new category lands in between and the hand-picked reference silently stops covering it. Confirmed twice: the Household Safety Number bug (Finding 3, fixed on the spreadsheet side earlier) and a newly-found live bug in Dashboard!C28 "Variable Income (Actual)", which had been excluding Wages/Tips ever since Add Shift (v0.0.18) added those rows, because it only ever summed Budget!D7. New recomputeBudgetSummaryMetrics_() replaces all of these: it sums Income Actual by Type ("Fixed"/"Variable", read fresh from Budget!B each run) instead of naming rows, reuses the existing Essential-flag SUMIFS for essential expenses, and writes plain values — the same compute-then-write pattern refreshThisWeekSnapshot() already uses. Runs automatically after Add Transaction, Add Category, Add Shift, Monthly Budget Sit-Down, Jump to Current Month, and on open; a new "Refresh Budget Summary" menu item covers manual sheet edits; a new "Enable Scheduled Budget Refresh (one-time setup)" menu item adds a 4-hour time-driven trigger as a floor under all of the above. Dashboard!C33 ("Fixed-Income Coverage Gap (Budgeted)" — Finding 4, an exact duplicate of Net (Actual) one row up) is cleared rather than migrated, per Jonathan\'s call. New validateBudgetSummaryAnchors_() is a read-only check (no writes) that confirms every section-anchor label these metrics depend on still exists — surfaced in Show Version & Diagnostics, along with how long ago the metrics last actually refreshed, as this project\'s self-check against the label-driven wrong-cell-reference bug class (Findings 3 and 4).' },
  { version: 'v0.0.22', date: '2026-08-18', summary: 'Full script-driven migration, per Jonathan\'s direction: "no more hardcoding into excel, all logic through the script." A 2026-08-18 full-formula audit found that v0.0.20\'s date-match fix and v0.0.21\'s metrics migration both only ever apply going forward — neither can reach back and repair a formula already sitting in a cell — which left two CRITICAL, currently-live gaps: Budget!C6/C7/C10 (Income Budgeted) still running the pre-fix exact-date-match SUMIFS, and every category present since the original migration (plus Income History\'s entire 361-formula surface) reading Transactions through a range hardcoded to rows 5:33, about 6 real transactions from silently freezing. Rather than patch those two spots again, recomputeBudgetSummaryMetrics_() now owns the ENTIRE Budget/Dashboard/Income History numeric surface — every category\'s Budgeted and Actual (Budget!C6:D10, C16:D33), the Income/Expense/Essential totals, NET, the Income vs Expenses recap, the Household Safety Number, Dashboard\'s per-category Budgeted/Actual/Remaining mirror (matched by Subcategory_ID, not row position), Dashboard\'s Total Income/Expenses (Actual)/Net/Savings Rate (previously a formula chain reading through cells this function already wrote — one less place for the two to disagree, closing audit Finding 5a), Budget\'s "suggested variable income estimate," and — via a new recomputeIncomeHistory_() — every month on Income History except the November 2025 row explicitly marked "Preserved from original workbook" in its Notes column (that one predates the transaction ledger and has nothing to derive it from; every other row already said "Derived from Transactions," which is exactly what this now does, in the script instead of a range-capped formula). Budget Plan and Transactions are read once per run via the existing getLastRow()-based readTable_() (no hardcoded row cap of any kind) and grouped into lookup maps, so every category/month is an O(1) lookup instead of a fresh table scan — the efficient script-side equivalent of what used to be dozens of separate SUMIFS. insertBudgetRow_()/addDashboardRow_() no longer write any Budgeted/Actual/Remaining formula text at all — those cells are left blank at insert time and filled in by the recompute that already runs immediately after, in every caller. Deliberately NOT converted: Transactions\' own row-level helper formulas (Effective_Category_ID/Subcategory_ID, Duplicate_Key, Potential_Duplicate_Flag) and the Categories-lookup name formulas (Budget!A, Dashboard!B) — both reference only their own row or an already-generously-capped lookup range, neither is the hardcoded-range-silently-drops-data failure class this migration exists to close, and converting them would trade an instant update (e.g. re-categorizing a transaction by hand takes effect immediately today) for a staleness window, for no bug-safety benefit. validateBudgetSummaryAnchors_() extended to cover the new anchors (Budget!"Category", Dashboard!"Total Income (Actual)"/"Total Expenses (Actual)"/"Net (Actual)"/"Savings Rate"). Verified via simulation against Jonathan\'s uploaded workbook plus a genuine pyuno recalculation before delivery — see the "Budgeting App" Claude project\'s full-formula-audit-2026-08-18.md for the audit this responds to.' },
  { version: 'v0.0.23', date: '2026-08-18', summary: 'Four additions, all confirmed by Jonathan right after the v0.0.22 delivery. (1) Pure compute layer: the Budget/Dashboard/Income History math (calcBudgetSummary_(), calcIncomeHistory_(), groupAmountsByKey_(), groupIncomeTxByMonth_()) is now split out from the sheet I/O (recomputeBudgetSummaryMetrics_(), recomputeIncomeHistory_()) — the compute functions take plain JS data in and return plain JS data out, with zero SpreadsheetApp calls inside, so this logic can port almost unchanged into a real app backend later; the I/O functions are now thin read-compute-write wrappers around them. Same numbers, same cells, purely a reorganization — verified via simulation to produce identical output to pre-refactor v0.0.22. (2) Freshness indicator: a one-cell, color-coded status badge (updateFreshnessIndicator_()) written to Budget!E2 and Dashboard!F2 every time the summary recomputes — green "✓ Refreshed Xm ago" or red "⚠ Stale"/"⚠ Never refreshed," visible right on the sheets Jonathan and Bianca are already looking at, not just inside Show Version & Diagnostics. Cell placement (Budget!E2, Dashboard!F2) was chosen by inspecting the real workbook\'s merged-cell ranges to find the first free, unmerged cell near each title. (3) Data Health Check (runDataHealthCheck_(), new "Data Health Check" menu item): a read-only scan for the orphaned-foreign-key and duplicate/drifted-name bug class this project has hit before (the CAT-INCOME/INCOME dangling reference from v0.0.19; the "2 Cat Litter subcategories" duplicate flagged in the roadmap) — checks orphaned Parent_Category_ID on Subcategory rows, duplicate active Category_IDs, duplicate/drifted category names, orphaned Effective_Subcategory_ID and Member_ID on Transactions, orphaned Subcategory_ID on Budget Plan rows, blank/orphaned Subcategory_ID on Budget/Dashboard, and Budget-vs-Dashboard category-set mismatches. Same read-only, never-calls-setValue contract as showDiagnostics(). (4) Data Dictionary (new visible "Data Dictionary" sheet, DATA_DICTIONARY_ + getOrCreateDataDictionarySheet_() + syncDataDictionary_(), new "View Data Dictionary" menu item): a self-generating reference sheet mapping every real sheet to its ID column, ID scheme, foreign-key relationships, and hidden/behind-the-scenes columns — same source-of-truth-array pattern as Release Notes, but a full rewrite each sync (not an append) and left visible by default rather than hidden, since it\'s meant to be opened and read.' },
  { version: 'v0.0.24', date: '2026-08-18', summary: 'Prepared a guarded development-only data-integrity migration for the verified v0.0.23 findings. A read-only preview locates rows by their stable IDs and real row-4 headers, validates exactly 13 expected cell corrections plus the America/Los_Angeles → America/Toronto spreadsheet-timezone correction, and refuses unexpected or duplicate targets. Apply requires an exact confirmation phrase, rechecks under a document lock, verifies every final value, and rolls back its own writes on failure before refreshing summaries and rerunning Data Health Check. The health check now also detects orphaned Transactions Manual_Category_ID and Effective_Category_ID values, and diagnostics now correctly treats a spreadsheet/project timezone mismatch as actionable rather than harmless.' },
  { version: 'v0.0.25', date: '2026-08-18', summary: 'Added a second guarded development-only migration for 14 legacy Add Shift transaction rows that still referenced the invalid top-level Category_ID "CAT-INCOME". The preview locates TXN-SHIFT-000006 through TXN-SHIFT-000019 by stable ID, validates their Manual_Category_ID cells, and proves each Effective_Category_ID remains a live formula connected to the same-row manual cell. Apply changes only the 14 direct Manual_Category_ID values to the authoritative Income ID "INCOME", preserves and verifies all 14 formulas after recalculation, supports repeat-safe no-op runs and rollback on failure, then refreshes summaries and reruns Data Health Check.' },
  { version: 'v0.0.26', date: '2026-08-18', summary: 'Removed the Potential_Duplicate_Flag formula ceiling at Transactions row 5,000. A pure calcPotentialDuplicateFlags_() engine now counts exact case-insensitive Duplicate_Key values in one O(n) pass, and a thin recomputePotentialDuplicateFlags_() adapter performs one real-extent column read and write. Add Transaction and Add Shift refresh the flags automatically; direct edits to duplicate-key inputs trigger the same recompute; a manual Refresh Duplicate Flags control provides recovery after bulk operations; and Data Health Check reports derived-flag drift. Duplicate_Key formulas and the separately reviewed Is_Duplicate field that controls financial totals are never changed.' },
  { version: 'v0.0.27', date: '2026-08-18', summary: 'Closed the concurrency gap found in Gemini\'s independent review of v0.0.26. recomputePotentialDuplicateFlags_() now acquires a document-scoped lock before reading the Transactions extent and holds it through the single batched Potential_Duplicate_Flag write, preventing overlapping script recalculations from allowing an older full-column result to overwrite a newer one. A 10-second timeout fails explicitly without writing, and finally always releases an acquired lock. The lock protects only this derived review column; Duplicate_Key, Is_Duplicate, transactions, and financial totals remain outside its write surface.' },
  { version: 'v0.0.28', date: '2026-08-18', summary: 'Added authoritative server validation for Add Transaction. A pure validateAndNormalizeTransactionInput_() boundary now accepts only Income/Expense, validates real YYYY-MM-DD calendar dates under the America/Toronto standard, normalizes positive whole-cent amounts, verifies the selected active subcategory belongs to the submitted type, verifies any nonblank member is active, and returns normalized plain data. addTransaction() completes all reference reads and date parsing before getOrCreateManualBatch_() or any other write-capable helper runs, so invalid, stale, or tampered requests make zero Sheet or batch changes. Write locking and rollback remain separately scoped to Issue #6.' }
];
var RELEASE_NOTES_SHEET_NAME = 'Release Notes';
// Creates the Release Notes sheet (header row, hidden) the first time
// anything runs. Safe to call every time — a no-op if it already exists.
function getOrCreateReleaseNotesSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(RELEASE_NOTES_SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(RELEASE_NOTES_SHEET_NAME);
    sh.getRange(1, 1, 1, 3).setValues([['Version', 'Date', 'Summary']]);
    sh.getRange(1, 1, 1, 3).setFontWeight('bold');
    sh.setColumnWidth(1, 70);
    sh.setColumnWidth(2, 90);
    sh.setColumnWidth(3, 650);
    try { sh.hideSheet(); } catch (e) { /* hiding is best-effort */ }
  }
  return sh;
}
// Appends any RELEASE_HISTORY_ entries not already on the Release Notes
// sheet (matched by Version), so this is safe to call on every open/run
// and never duplicates a row. This is what "incorporate the version
// history into future code" means in practice: add one entry to
// RELEASE_HISTORY_ above (and bump APP_VERSION to match) whenever
// Code.gs changes, and the sheet catches up automatically next time.
// Best-effort, same as logChange_ — never lets a sync failure break
// whatever called it.
function syncReleaseNotes_() {
  try {
    var sh = getOrCreateReleaseNotesSheet_();
    var lastRow = sh.getLastRow();
    var existingVersions = {};
    if (lastRow > 1) {
      var existing = sh.getRange(2, 1, lastRow - 1, 1).getValues();
      existing.forEach(function (r) { existingVersions[r[0]] = true; });
    }
    var toAppend = RELEASE_HISTORY_.filter(function (r) { return !existingVersions[r.version]; });
    if (toAppend.length) {
      var rows = toAppend.map(function (r) { return [r.version, r.date, r.summary]; });
      sh.getRange(sh.getLastRow() + 1, 1, rows.length, 3).setValues(rows);
    }
  } catch (e) {
    // Best-effort — never let this break the tool that called it.
  }
}
// The sheets whose column layout these tools depend on via col_()/
// colLetter_() (i.e. everything except Budget/Dashboard — see the
// COLUMN LOOKUPS note at the top of this file). A handful of headers
// each tool actually reads/writes are spot-checked here; not exhaustive,
// but enough to catch a renamed or missing column before it causes a
// confusing failure somewhere else.
var DIAGNOSTIC_EXPECTED_HEADERS_ = {
  'Transactions': ['Transaction_ID', 'Transaction_Date', 'Transaction_Type', 'Amount', 'Member_ID',
    'Original_Description', 'Manual_Category_ID', 'Manual_Subcategory_ID', 'Auto_Category_ID', 'Auto_Subcategory_ID',
    'Effective_Category_ID', 'Effective_Subcategory_ID', 'Reviewed_Flag', 'Duplicate_Key', 'Potential_Duplicate_Flag', 'Is_Duplicate'],
  'Raw Transactions': ['Raw_Record_ID', 'Import_Batch_ID', 'Account_ID', 'Raw_Transaction_Date', 'Raw_Type', 'Raw_Category'],
  'Import Batches': ['Import_Batch_ID', 'Record_Count'],
  'Categories': ['Category_ID', 'Parent_Category_ID', 'Record_Type', 'Category_Name', 'Transaction_Type',
    'Essential_Default', 'Income_Stability_Default', 'Active_Flag', 'Legacy_Budget_Label', 'Sort_Order'],
  'Budget Plan': ['Budget_ID', 'Month_Start', 'Member_ID', 'Account_ID', 'Transaction_Type', 'Subcategory_ID',
    'Budgeted_Amount', 'Essential_Flag', 'Income_Stability', 'Active_Flag'],
  'Household Members': ['Member_ID', 'Display_Name', 'Active_Flag'],
  'Accounts': ['Account_ID', 'Active_Flag']
};
function showDiagnostics() {
  syncReleaseNotes_(); // make sure the Release Notes sheet is current before reading it below
  var ui = SpreadsheetApp.getUi();
  var lines = [];
  lines.push('Version: ' + APP_VERSION);
  var tz = getTz_();
  var scriptTz = Session.getScriptTimeZone();
  lines.push('');
  lines.push('Timezone the tools actually use (spreadsheet\'s own): ' + tz);
  if (tz === EXPECTED_TIMEZONE_) {
    lines.push('✓ Spreadsheet timezone matches the household standard: ' + EXPECTED_TIMEZONE_ + '.');
  } else {
    lines.push('⚠ Spreadsheet timezone should be ' + EXPECTED_TIMEZONE_ +
      '. Date defaults, day boundaries, month keys, and refresh timestamps currently use ' + tz + '.');
  }
  if (scriptTz && scriptTz !== tz) {
    lines.push('⚠ Apps Script project timezone is ' + scriptTz +
      ', so the project and spreadsheet disagree. The spreadsheet timezone wins inside getTz_(); align both to ' + EXPECTED_TIMEZONE_ + '.');
  }
  lines.push('');
  var budgetMonthVal = sheet_('Budget').getRange('B2').getValue();
  if (budgetMonthVal instanceof Date) {
    var budgetKey = monthKey_(budgetMonthVal, tz);
    var todayKey = monthKey_(new Date(), tz);
    lines.push('Budget!B2: ' + Utilities.formatDate(budgetMonthVal, tz, 'MMMM yyyy') +
      (budgetKey === todayKey
        ? ' — matches the current calendar month.'
        : ' — ⚠ does NOT match the current calendar month (' + Utilities.formatDate(new Date(), tz, 'MMMM yyyy') + '). Run Jump to Current Month.'));
  } else {
    lines.push('⚠ Budget!B2 doesn\'t look like a date (raw value: "' + budgetMonthVal + '") — Budget/Dashboard Actual formulas and This Week Snapshot will misbehave until it\'s set to a real date.');
  }
  lines.push('');
  lines.push('Sheet layout check (columns these tools depend on, by header name):');
  Object.keys(DIAGNOSTIC_EXPECTED_HEADERS_).forEach(function (sheetName) {
    var expected = DIAGNOSTIC_EXPECTED_HEADERS_[sheetName];
    try {
      var map = headerMap_(sheetName);
      var missing = expected.filter(function (h) { return !map[h]; });
      if (missing.length) {
        lines.push('  ⚠ ' + sheetName + ' — missing expected column(s): ' + missing.join(', '));
      } else {
        lines.push('  ✓ ' + sheetName + ' — OK (' + Object.keys(map).length + ' columns found, row 4)');
      }
    } catch (e) {
      lines.push('  ⚠ ' + sheetName + ' — ' + e.message);
    }
  });
  lines.push('');
  try {
    var anchorCell = sheet_('Dashboard').getRange(THIS_WEEK_ANCHOR_ROW, THIS_WEEK_ANCHOR_COL).getA1Notation();
    lines.push('This Week Snapshot writes starting at Dashboard!' + anchorCell + ' (THIS_WEEK_ANCHOR_ROW/COL in Code.gs — change those two numbers if this ever overlaps something else on Dashboard).');
  } catch (e) {
    lines.push('⚠ Could not check the This Week Snapshot anchor cell: ' + e.message);
  }
  lines.push('');
  var ttSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TIP_TRACKER_SHEET_NAME);
  if (!ttSheet) {
    lines.push('Tip Tracker: not set up yet — the first use of Add Shift will create it automatically.');
  } else {
    try {
      var ttSettings = getTipTrackerSettings_();
      lines.push('Tip Tracker: ✓ set up. Floor ' + ttSettings.floorPct + '%, Bar ' + ttSettings.barPct +
        '% (round up to $' + ttSettings.barRound + '), CC ' + ttSettings.ccPct + '%, Hourly rate $' + ttSettings.hourlyRate.toFixed(2) + '.');
    } catch (e) {
      lines.push('Tip Tracker: ⚠ ' + e.message);
    }
  }
  // Budget summary metrics (every category's Budgeted/Actual, the Income/
  // Expense/Essential totals, NET, Income vs Expenses, Household Safety
  // Number, Dashboard's category mirror and summary figures, and Income
  // History) — see recomputeBudgetSummaryMetrics_() above. These are
  // script-computed values now, not live formulas, so "is this actually
  // current" is no longer something a glance at the sheet can answer on
  // its own. This
  // section is read-only (validateBudgetSummaryAnchors_() below only
  // looks things up, it never writes) so it doesn't break this
  // function's own "never writes anything" guarantee — it confirms the
  // section-anchor labels recomputeBudgetSummaryMetrics_() depends on
  // still exist, and reports when that function last actually ran. This
  // is this project's self-check against the label-driven wrong-cell-
  // reference bug class (Findings 3, 4): if Budget/Dashboard's layout
  // ever changes in a way the anchors below no longer match, that shows
  // up here immediately instead of as a silently wrong number.
  lines.push('');
  try {
    validateBudgetSummaryAnchors_();
    var summaryLastRun = PropertiesService.getScriptProperties().getProperty(BUDGET_SUMMARY_LAST_RUN_PROP_);
    if (!summaryLastRun) {
      lines.push('✓ Budget summary metrics — layout OK, but never refreshed yet. Run "Refresh Budget Summary" from the menu once.');
    } else {
      var lastRunDate = new Date(summaryLastRun);
      var hoursAgo = (new Date().getTime() - lastRunDate.getTime()) / 3600000;
      lines.push('✓ Budget summary metrics (Budget/Dashboard/Income History full numeric surface) — layout OK. Last refreshed ' +
        Utilities.formatDate(lastRunDate, tz, 'MMM d, h:mm a') + (hoursAgo > 24 ? ' — ⚠ over 24 hours ago.' : '.'));
    }
  } catch (e) {
    lines.push('⚠ Budget summary metrics — layout check failed: ' + e.message + ' (Budget/Dashboard\'s layout may have changed — see recomputeBudgetSummaryMetrics_() in Code.gs.)');
  }
  var scheduledOn = ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === 'recomputeBudgetSummaryMetrics_';
  });
  lines.push('  Scheduled refresh: ' + (scheduledOn ? '✓ enabled (every 4 hours).' : 'not set up — run "Enable Scheduled Budget Refresh (one-time setup)" from the menu.'));
  // Recent activity, from the hidden Change Log sheet (see logChange_
  // above) — every write-capable tool appends one row there. Showing
  // the last few here means "did my last action actually take, and
  // when" is answerable without leaving this dialog; the full history
  // is on the Change Log sheet itself (Sheet menu → unhide sheets).
  lines.push('');
  lines.push('Recent activity (Change Log):');
  try {
    var logSheet = getOrCreateChangeLogSheet_();
    var logLastRow = logSheet.getLastRow();
    if (logLastRow <= 1) {
      lines.push('  No changes logged yet.');
    } else {
      var showCount = Math.min(5, logLastRow - 1);
      var startRow = logLastRow - showCount + 1;
      var recent = logSheet.getRange(startRow, 1, showCount, 3).getValues();
      recent.reverse().forEach(function (row) {
        var ts = row[0] instanceof Date ? Utilities.formatDate(row[0], tz, 'MMM d, h:mm a') : String(row[0]);
        lines.push('  ' + ts + ' — ' + row[1] + ': ' + row[2]);
      });
      if (logLastRow - 1 > showCount) {
        lines.push('  (' + (logLastRow - 1) + ' total entries — see the hidden "Change Log" sheet for the full history.)');
      }
    }
  } catch (e) {
    lines.push('  ⚠ Could not read the Change Log: ' + e.message);
  }
  // Recent releases, from RELEASE_HISTORY_ (see the VERSION & DIAGNOSTICS
  // section above) — the last few entries answer "what shipped recently"
  // without needing to open the hidden Release Notes sheet. The full
  // history lives there (Sheet menu → unhide sheets).
  lines.push('');
  lines.push('Recent releases:');
  var recentReleases = RELEASE_HISTORY_.slice(-5).reverse();
  recentReleases.forEach(function (r) {
    lines.push('  ' + r.version + ' (' + r.date + ') — ' + r.summary);
  });
  if (RELEASE_HISTORY_.length > recentReleases.length) {
    lines.push('  (' + RELEASE_HISTORY_.length + ' total versions — see the hidden "Release Notes" sheet for the full history.)');
  }
  ui.alert('Budget Tools — Version & Diagnostics', lines.join('\n'), ui.ButtonSet.OK);
}

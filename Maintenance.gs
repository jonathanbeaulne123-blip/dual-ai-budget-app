// ================= v0.0.24 DATA-INTEGRITY MIGRATION ==================
// Development-only, one-time correction for the verified v0.0.23 data
// issues recorded in docs/LIVE_VERIFICATION_2026-08-18.md. The preview is
// read-only. The apply path validates every target and current value before
// writing, requires an explicit confirmation phrase, rechecks under a
// document lock, verifies the result, and rolls back its own cell/timezone
// writes if a correction fails.

var DATA_INTEGRITY_V0024_VERSION_ = 'v0.0.24';
var DATA_INTEGRITY_V0024_DEV_SHEET_NAME_ = 'devCopy of Budget_App__v 0.23';
var DATA_INTEGRITY_V0024_OLD_TIMEZONE_ = 'America/Los_Angeles';
var DATA_INTEGRITY_V0024_TARGET_TIMEZONE_ = 'America/Toronto';
var DATA_INTEGRITY_V0024_CONFIRMATION_ = 'APPLY V0.0.24 TO DEV';

// Exactly 13 verified cell corrections: seven parent links, one duplicate
// deactivation, four transaction category links, and one Budget Plan link.
// IDs locate rows; row numbers and column letters are never hardcoded.
var DATA_INTEGRITY_V0024_CORRECTIONS_ = [
  { sheet: 'Categories', keyHeader: 'Category_ID', key: 'SUB-HOUSING-RENT', targetHeader: 'Parent_Category_ID', oldValue: 'HOUSING', newValue: 'CAT-HOUSING', label: 'Rent / Mortgage parent category' },
  { sheet: 'Categories', keyHeader: 'Category_ID', key: 'SUB-HOUSING-GAS', targetHeader: 'Parent_Category_ID', oldValue: 'HOUSING', newValue: 'CAT-HOUSING', label: 'Household Gas parent category' },
  { sheet: 'Categories', keyHeader: 'Category_ID', key: 'SUB-HOUSING-ELECTRIC', targetHeader: 'Parent_Category_ID', oldValue: 'HOUSING', newValue: 'CAT-HOUSING', label: 'Electricity parent category' },
  { sheet: 'Categories', keyHeader: 'Category_ID', key: 'SUB-FOOD-GROCERIES', targetHeader: 'Parent_Category_ID', oldValue: 'FOOD', newValue: 'CAT-FOOD', label: 'Groceries parent category' },
  { sheet: 'Categories', keyHeader: 'Category_ID', key: 'SUB-TRANSPORT-PRIVATE', targetHeader: 'Parent_Category_ID', oldValue: 'TRANSPORT', newValue: 'CAT-TRANSPORT', label: 'Private Transportation parent category' },
  { sheet: 'Categories', keyHeader: 'Category_ID', key: 'SUB-TRANSPORT-PUBLIC', targetHeader: 'Parent_Category_ID', oldValue: 'TRANSPORT', newValue: 'CAT-TRANSPORT', label: 'Public Transportation parent category' },
  { sheet: 'Categories', keyHeader: 'Category_ID', key: 'SUB-TRANSPORT-FUEL', targetHeader: 'Parent_Category_ID', oldValue: 'TRANSPORT', newValue: 'CAT-TRANSPORT', label: 'Vehicle Fuel parent category' },
  { sheet: 'Categories', keyHeader: 'Category_ID', key: 'SUB-CAT-CAT-LITTER-2', targetHeader: 'Active_Flag', oldValue: 'Yes', newValue: 'No', label: 'Duplicate Cat Litter active flag' },
  { sheet: 'Transactions', keyHeader: 'Transaction_ID', key: 'TXN-MANUAL-000001', targetHeader: 'Manual_Category_ID', oldValue: 'HOUSING', newValue: 'CAT-HOUSING', label: 'Transaction category link' },
  { sheet: 'Transactions', keyHeader: 'Transaction_ID', key: 'TXN-MANUAL-000028', targetHeader: 'Manual_Category_ID', oldValue: 'HOUSING', newValue: 'CAT-HOUSING', label: 'Transaction category link' },
  { sheet: 'Transactions', keyHeader: 'Transaction_ID', key: 'TXN-MANUAL-000032', targetHeader: 'Manual_Category_ID', oldValue: 'HOUSING', newValue: 'CAT-HOUSING', label: 'Transaction category link' },
  { sheet: 'Transactions', keyHeader: 'Transaction_ID', key: 'TXN-MANUAL-000033', targetHeader: 'Manual_Category_ID', oldValue: 'HOUSING', newValue: 'CAT-HOUSING', label: 'Transaction category link' },
  { sheet: 'Budget Plan', keyHeader: 'Budget_ID', key: 'BUD-202601-034', targetHeader: 'Subcategory_ID', oldValue: 'SUB-CAT-CAT-LITTER-2', newValue: 'SUB-CAT-CAT-LITTER', label: 'January 2026 Cat Litter budget link' }
];

function isDataIntegrityV0024DevSpreadsheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return APP_VERSION === DATA_INTEGRITY_V0024_VERSION_ &&
    !!ss && ss.getName() === DATA_INTEGRITY_V0024_DEV_SHEET_NAME_;
}

function assertDataIntegrityV0024Environment_() {
  if (APP_VERSION !== DATA_INTEGRITY_V0024_VERSION_) {
    throw new Error('Safety abort: expected Apps Script ' + DATA_INTEGRITY_V0024_VERSION_ +
      ', but this project reports ' + APP_VERSION + '.');
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss || ss.getName() !== DATA_INTEGRITY_V0024_DEV_SHEET_NAME_) {
    throw new Error('Safety abort: this migration may run only in the development spreadsheet named "' +
      DATA_INTEGRITY_V0024_DEV_SHEET_NAME_ + '". Active spreadsheet: "' +
      (ss ? ss.getName() : '(none)') + '".');
  }
  if (DATA_INTEGRITY_V0024_CORRECTIONS_.length !== 13) {
    throw new Error('Safety abort: the v0.0.24 migration definition must contain exactly 13 cell corrections; found ' +
      DATA_INTEGRITY_V0024_CORRECTIONS_.length + '.');
  }
  return ss;
}

function dataIntegrityV0024Value_(value) {
  return String(value === null || value === undefined ? '' : value).trim();
}

// Creates a complete read-only plan. Every key must occur exactly once and
// every target must still hold either the verified old value or the intended
// final value. Any third value aborts before the user is offered Apply.
function buildDataIntegrityV0024Plan_() {
  var ss = assertDataIntegrityV0024Environment_();
  var tables = {};
  var cellChanges = DATA_INTEGRITY_V0024_CORRECTIONS_.map(function (spec) {
    if (!tables[spec.sheet]) tables[spec.sheet] = readTable_(spec.sheet);
    // Force both headers through the existing fail-fast row-4 lookup.
    col_(spec.sheet, spec.keyHeader);
    var targetCol = col_(spec.sheet, spec.targetHeader);
    var matches = tables[spec.sheet].filter(function (row) {
      return dataIntegrityV0024Value_(row[spec.keyHeader]) === spec.key;
    });
    if (matches.length !== 1) {
      throw new Error('Safety abort: expected exactly one ' + spec.sheet + ' row where ' +
        spec.keyHeader + ' = "' + spec.key + '", but found ' + matches.length + '.');
    }
    var row = matches[0];
    var current = dataIntegrityV0024Value_(row[spec.targetHeader]);
    var state;
    if (current === spec.oldValue) state = 'pending';
    else if (current === spec.newValue) state = 'already-applied';
    else {
      throw new Error('Safety abort: ' + spec.sheet + ' row ' + row._row + ' (' + spec.key +
        ') has unexpected ' + spec.targetHeader + ' value "' + current + '"; expected "' +
        spec.oldValue + '" or "' + spec.newValue + '".');
    }
    return {
      sheet: spec.sheet,
      a1: sheet_(spec.sheet).getRange(row._row, targetCol).getA1Notation(),
      keyHeader: spec.keyHeader,
      key: spec.key,
      targetHeader: spec.targetHeader,
      oldValue: spec.oldValue,
      newValue: spec.newValue,
      currentValue: current,
      state: state,
      label: spec.label
    };
  });

  var timezone = ss.getSpreadsheetTimeZone();
  var timezoneState;
  if (timezone === DATA_INTEGRITY_V0024_OLD_TIMEZONE_) timezoneState = 'pending';
  else if (timezone === DATA_INTEGRITY_V0024_TARGET_TIMEZONE_) timezoneState = 'already-applied';
  else {
    throw new Error('Safety abort: spreadsheet timezone is "' + timezone + '"; expected the verified old value "' +
      DATA_INTEGRITY_V0024_OLD_TIMEZONE_ + '" or final value "' + DATA_INTEGRITY_V0024_TARGET_TIMEZONE_ + '".');
  }

  return {
    version: DATA_INTEGRITY_V0024_VERSION_,
    spreadsheetName: ss.getName(),
    cellChanges: cellChanges,
    timezone: {
      oldValue: DATA_INTEGRITY_V0024_OLD_TIMEZONE_,
      newValue: DATA_INTEGRITY_V0024_TARGET_TIMEZONE_,
      currentValue: timezone,
      state: timezoneState
    }
  };
}

function formatDataIntegrityV0024Plan_(plan) {
  var pendingCells = plan.cellChanges.filter(function (c) { return c.state === 'pending'; }).length;
  var lines = [
    plan.version + ' development correction preview',
    'Spreadsheet: ' + plan.spreadsheetName,
    '',
    'Spreadsheet setting:',
    '  ' + (plan.timezone.state === 'pending' ? 'CHANGE' : 'OK') + ' Time zone: ' +
      plan.timezone.currentValue + ' → ' + plan.timezone.newValue,
    '',
    'Sheet cells (13 validated):'
  ];
  plan.cellChanges.forEach(function (c) {
    lines.push('  ' + (c.state === 'pending' ? 'CHANGE' : 'OK') + ' ' + c.sheet + '!' + c.a1 +
      ' — ' + c.label + ' [' + c.key + ']: ' + c.currentValue + ' → ' + c.newValue);
  });
  lines.push('');
  lines.push('Pending: ' + pendingCells + ' cell change(s)' +
    (plan.timezone.state === 'pending' ? ' plus the spreadsheet timezone.' : '; timezone already correct.'));
  return lines.join('\n');
}

function dataIntegrityV0024Fingerprint_(plan) {
  return plan.spreadsheetName + '|' + plan.timezone.currentValue + '|' + plan.cellChanges.map(function (c) {
    return c.sheet + '!' + c.a1 + '=' + c.currentValue;
  }).join('|');
}

// Low-level write step, separated so the migration behavior can be tested.
// It writes only pending items, verifies every final value, and attempts a
// reverse-order rollback if any write or verification fails.
function applyDataIntegrityV0024Plan_(plan) {
  var ss = assertDataIntegrityV0024Environment_();
  var pending = plan.cellChanges.filter(function (c) { return c.state === 'pending'; });
  var written = [];
  var timezoneChanged = false;
  try {
    pending.forEach(function (change) {
      var range = sheet_(change.sheet).getRange(change.a1);
      var current = dataIntegrityV0024Value_(range.getValue());
      if (current !== change.oldValue) {
        throw new Error(change.sheet + '!' + change.a1 + ' changed after preview; found "' + current +
          '" instead of "' + change.oldValue + '".');
      }
      range.setValue(change.newValue);
      written.push({ range: range, oldValue: change.oldValue });
    });

    if (plan.timezone.state === 'pending') {
      var currentTimezone = ss.getSpreadsheetTimeZone();
      if (currentTimezone !== plan.timezone.oldValue) {
        throw new Error('Spreadsheet timezone changed after preview; found "' + currentTimezone +
          '" instead of "' + plan.timezone.oldValue + '".');
      }
      ss.setSpreadsheetTimeZone(plan.timezone.newValue);
      timezoneChanged = true;
    }

    SpreadsheetApp.flush();
    plan.cellChanges.forEach(function (change) {
      var finalValue = dataIntegrityV0024Value_(sheet_(change.sheet).getRange(change.a1).getValue());
      if (finalValue !== change.newValue) {
        throw new Error('Verification failed for ' + change.sheet + '!' + change.a1 + ': found "' +
          finalValue + '" after writing "' + change.newValue + '".');
      }
    });
    if (ss.getSpreadsheetTimeZone() !== plan.timezone.newValue) {
      throw new Error('Verification failed for spreadsheet timezone after setting "' + plan.timezone.newValue + '".');
    }
  } catch (error) {
    var rollbackErrors = [];
    for (var i = written.length - 1; i >= 0; i--) {
      try { written[i].range.setValue(written[i].oldValue); }
      catch (rollbackError) { rollbackErrors.push(rollbackError.message); }
    }
    if (timezoneChanged) {
      try { ss.setSpreadsheetTimeZone(plan.timezone.oldValue); }
      catch (timezoneRollbackError) { rollbackErrors.push(timezoneRollbackError.message); }
    }
    try { SpreadsheetApp.flush(); }
    catch (flushError) { rollbackErrors.push(flushError.message); }
    throw new Error('v0.0.24 correction failed: ' + error.message +
      (rollbackErrors.length
        ? ' Rollback also reported: ' + rollbackErrors.join(' | ') + '. Inspect development before retrying.'
        : ' Its completed cell/timezone writes were rolled back.'));
  }

  return {
    changedCells: pending.length,
    changedTimezone: plan.timezone.state === 'pending'
  };
}

// Read-only menu entry point.
function previewDataIntegrityCorrections() {
  var ui = SpreadsheetApp.getUi();
  try {
    var plan = buildDataIntegrityV0024Plan_();
    ui.alert('Budget Tools — v0.0.24 Correction Preview', formatDataIntegrityV0024Plan_(plan), ui.ButtonSet.OK);
    return plan;
  } catch (error) {
    ui.alert('v0.0.24 correction preview failed: ' + error.message);
    return null;
  }
}

// Development-only, confirmation-gated menu entry point.
function applyDataIntegrityCorrections() {
  var ui = SpreadsheetApp.getUi();
  var lock;
  try {
    var previewPlan = buildDataIntegrityV0024Plan_();
    var pendingCells = previewPlan.cellChanges.filter(function (c) { return c.state === 'pending'; }).length;
    if (!pendingCells && previewPlan.timezone.state !== 'pending') {
      ui.alert('v0.0.24 corrections are already fully applied. No writes were made.');
      return;
    }

    var response = ui.prompt(
      'Apply v0.0.24 Development Corrections',
      formatDataIntegrityV0024Plan_(previewPlan) + '\n\nType exactly: ' + DATA_INTEGRITY_V0024_CONFIRMATION_,
      ui.ButtonSet.OK_CANCEL
    );
    if (response.getSelectedButton() !== ui.Button.OK) return;
    if (String(response.getResponseText() || '').trim() !== DATA_INTEGRITY_V0024_CONFIRMATION_) {
      ui.alert('Safety abort: confirmation text did not match. No writes were made.');
      return;
    }

    lock = LockService.getDocumentLock();
    if (!lock.tryLock(30000)) {
      throw new Error('Could not obtain the development spreadsheet lock within 30 seconds. No writes were made.');
    }
    var lockedPlan = buildDataIntegrityV0024Plan_();
    if (dataIntegrityV0024Fingerprint_(lockedPlan) !== dataIntegrityV0024Fingerprint_(previewPlan)) {
      throw new Error('Spreadsheet state changed after the confirmation preview. No writes were made; run Preview again.');
    }

    var result = applyDataIntegrityV0024Plan_(lockedPlan);
    SpreadsheetApp.flush();

    var refreshError = '';
    try { recomputeBudgetSummaryMetrics_(); }
    catch (error) { refreshError = error.message; }

    var findings = null;
    var healthError = '';
    try { findings = runDataHealthCheck_(); }
    catch (error) { healthError = error.message; }

    var details = 'Applied ' + result.changedCells + ' verified cell correction(s)' +
      (result.changedTimezone ? ' and changed the spreadsheet timezone to America/Toronto.' : '; timezone was already America/Toronto.');
    if (refreshError) details += ' Budget summary refresh warning: ' + refreshError;
    if (healthError) details += ' Health-check warning: ' + healthError;
    else details += ' Post-migration Data Health Check found ' + findings.length + ' remaining issue(s).';
    logChange_('Apply v0.0.24 Data Integrity Corrections', details);

    var lines = [
      '✓ v0.0.24 development corrections applied and verified.',
      result.changedCells + ' cell correction(s) written.',
      result.changedTimezone ? 'Spreadsheet timezone changed to America/Toronto.' : 'Spreadsheet timezone was already America/Toronto.'
    ];
    lines.push(refreshError ? '⚠ Budget summary refresh failed: ' + refreshError : '✓ Budget summary refreshed.');
    if (healthError) lines.push('⚠ Data Health Check failed to run: ' + healthError);
    else if (findings.length) lines.push('⚠ Data Health Check still reports ' + findings.length + ' issue(s). Run it from the menu for details.');
    else lines.push('✓ Data Health Check reports no issues.');

    // Commit pending summary/log writes before releasing exclusive access,
    // then release before showing the result dialog (prompts suspend the
    // server-side script and should never hold a document lock open).
    var finalFlushError = '';
    try { SpreadsheetApp.flush(); } catch (error) { finalFlushError = error.message; }
    if (finalFlushError) lines.push('⚠ Final spreadsheet flush warning: ' + finalFlushError);
    try { lock.releaseLock(); lock = null; }
    catch (error) { lines.push('⚠ Document-lock release warning: ' + error.message); }
    ui.alert('Budget Tools — v0.0.24 Correction Result', lines.join('\n'), ui.ButtonSet.OK);
  } catch (error) {
    ui.alert('v0.0.24 correction aborted: ' + error.message);
  } finally {
    if (lock) {
      try { lock.releaseLock(); } catch (ignored) { /* best-effort */ }
    }
  }
}

// =============== v0.0.25 LEGACY INCOME-ID MIGRATION ================
// Development-only follow-up to v0.0.24. Fourteen legacy shift rows still
// use CAT-INCOME, an invalid top-level Category_ID. Only their direct
// Manual_Category_ID cells are written. Each Effective_Category_ID cell is
// required to retain a live formula that references the corresponding
// manual cell, and is verified after recalculation rather than overwritten.

var LEGACY_INCOME_V0025_VERSION_ = 'v0.0.25';
var LEGACY_INCOME_V0025_DEV_SHEET_NAME_ = 'devCopy of Budget_App__v 0.23';
var LEGACY_INCOME_V0025_OLD_ID_ = 'CAT-INCOME';
var LEGACY_INCOME_V0025_NEW_ID_ = 'INCOME';
var LEGACY_INCOME_V0025_CONFIRMATION_ = 'APPLY V0.0.25 TO DEV';
var LEGACY_INCOME_V0025_TRANSACTION_IDS_ = [
  'TXN-SHIFT-000006',
  'TXN-SHIFT-000007',
  'TXN-SHIFT-000008',
  'TXN-SHIFT-000009',
  'TXN-SHIFT-000010',
  'TXN-SHIFT-000011',
  'TXN-SHIFT-000012',
  'TXN-SHIFT-000013',
  'TXN-SHIFT-000014',
  'TXN-SHIFT-000015',
  'TXN-SHIFT-000016',
  'TXN-SHIFT-000017',
  'TXN-SHIFT-000018',
  'TXN-SHIFT-000019'
];

function isLegacyIncomeV0025DevSpreadsheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return APP_VERSION === LEGACY_INCOME_V0025_VERSION_ &&
    !!ss && ss.getName() === LEGACY_INCOME_V0025_DEV_SHEET_NAME_;
}

function assertLegacyIncomeV0025Environment_() {
  if (APP_VERSION !== LEGACY_INCOME_V0025_VERSION_) {
    throw new Error('Safety abort: expected Apps Script ' + LEGACY_INCOME_V0025_VERSION_ +
      ', but this project reports ' + APP_VERSION + '.');
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss || ss.getName() !== LEGACY_INCOME_V0025_DEV_SHEET_NAME_) {
    throw new Error('Safety abort: this migration may run only in the development spreadsheet named "' +
      LEGACY_INCOME_V0025_DEV_SHEET_NAME_ + '". Active spreadsheet: "' +
      (ss ? ss.getName() : '(none)') + '".');
  }
  if (ss.getSpreadsheetTimeZone() !== 'America/Toronto') {
    throw new Error('Safety abort: spreadsheet timezone must already be America/Toronto before v0.0.25; found "' +
      ss.getSpreadsheetTimeZone() + '".');
  }
  if (LEGACY_INCOME_V0025_TRANSACTION_IDS_.length !== 14) {
    throw new Error('Safety abort: the v0.0.25 migration definition must contain exactly 14 transaction IDs; found ' +
      LEGACY_INCOME_V0025_TRANSACTION_IDS_.length + '.');
  }
  if (new Set(LEGACY_INCOME_V0025_TRANSACTION_IDS_).size !== 14) {
    throw new Error('Safety abort: the v0.0.25 migration definition contains duplicate transaction IDs.');
  }
  return ss;
}

function legacyIncomeV0025Value_(value) {
  return String(value === null || value === undefined ? '' : value).trim();
}

function legacyIncomeV0025FormulaReferences_(formula, a1) {
  var normalizedFormula = String(formula || '').toUpperCase().replace(/\$/g, '');
  var normalizedA1 = String(a1 || '').toUpperCase();
  var referencePattern = new RegExp('(^|[^A-Z0-9_])' + normalizedA1 + '([^0-9]|$)');
  return referencePattern.test(normalizedFormula);
}

// Builds a read-only plan from stable transaction IDs and row-4 headers.
// It accepts only a fully old or fully new state per row. A missing,
// replaced, or disconnected Effective_Category_ID formula aborts before
// Apply is offered.
function buildLegacyIncomeV0025Plan_() {
  var ss = assertLegacyIncomeV0025Environment_();
  var rows = readTable_('Transactions');
  col_('Transactions', 'Transaction_ID');
  var manualCol = col_('Transactions', 'Manual_Category_ID');
  var effectiveCol = col_('Transactions', 'Effective_Category_ID');
  var transactionsSheet = sheet_('Transactions');

  var directChanges = [];
  var derivedCells = [];
  LEGACY_INCOME_V0025_TRANSACTION_IDS_.forEach(function (transactionId) {
    var matches = rows.filter(function (row) {
      return legacyIncomeV0025Value_(row.Transaction_ID) === transactionId;
    });
    if (matches.length !== 1) {
      throw new Error('Safety abort: expected exactly one Transactions row where Transaction_ID = "' +
        transactionId + '", but found ' + matches.length + '.');
    }

    var row = matches[0];
    var manualRange = transactionsSheet.getRange(row._row, manualCol);
    var effectiveRange = transactionsSheet.getRange(row._row, effectiveCol);
    var manualA1 = manualRange.getA1Notation();
    var effectiveA1 = effectiveRange.getA1Notation();
    var manualValue = legacyIncomeV0025Value_(manualRange.getValue());
    var effectiveValue = legacyIncomeV0025Value_(effectiveRange.getValue());
    var formula = effectiveRange.getFormula();

    if (manualValue !== LEGACY_INCOME_V0025_OLD_ID_ && manualValue !== LEGACY_INCOME_V0025_NEW_ID_) {
      throw new Error('Safety abort: Transactions!' + manualA1 + ' (' + transactionId +
        ') has unexpected Manual_Category_ID "' + manualValue + '"; expected "' +
        LEGACY_INCOME_V0025_OLD_ID_ + '" or "' + LEGACY_INCOME_V0025_NEW_ID_ + '".');
    }
    if (!formula) {
      throw new Error('Safety abort: Transactions!' + effectiveA1 + ' (' + transactionId +
        ') has no Effective_Category_ID formula. No writes were made.');
    }
    if (!legacyIncomeV0025FormulaReferences_(formula, manualA1)) {
      throw new Error('Safety abort: Transactions!' + effectiveA1 + ' (' + transactionId +
        ') formula does not reference its Manual_Category_ID cell ' + manualA1 + '. No writes were made.');
    }
    if (effectiveValue !== manualValue) {
      throw new Error('Safety abort: Transactions!' + effectiveA1 + ' (' + transactionId +
        ') currently evaluates to "' + effectiveValue + '" while ' + manualA1 + ' is "' + manualValue +
        '". Refresh/recalculate before retrying; no writes were made.');
    }

    directChanges.push({
      sheet: 'Transactions',
      a1: manualA1,
      transactionId: transactionId,
      oldValue: LEGACY_INCOME_V0025_OLD_ID_,
      newValue: LEGACY_INCOME_V0025_NEW_ID_,
      currentValue: manualValue,
      state: manualValue === LEGACY_INCOME_V0025_OLD_ID_ ? 'pending' : 'already-applied'
    });
    derivedCells.push({
      sheet: 'Transactions',
      a1: effectiveA1,
      transactionId: transactionId,
      manualA1: manualA1,
      currentValue: effectiveValue,
      expectedValue: LEGACY_INCOME_V0025_NEW_ID_,
      formula: formula
    });
  });

  return {
    version: LEGACY_INCOME_V0025_VERSION_,
    spreadsheetName: ss.getName(),
    timezone: ss.getSpreadsheetTimeZone(),
    directChanges: directChanges,
    derivedCells: derivedCells
  };
}

function formatLegacyIncomeV0025Plan_(plan) {
  var pending = plan.directChanges.filter(function (change) { return change.state === 'pending'; }).length;
  var lines = [
    plan.version + ' legacy income-ID correction preview',
    'Spreadsheet: ' + plan.spreadsheetName,
    'Time zone: ' + plan.timezone,
    '',
    'Direct sheet cells (14 validated):'
  ];
  plan.directChanges.forEach(function (change) {
    lines.push('  ' + (change.state === 'pending' ? 'CHANGE' : 'OK') + ' Transactions!' + change.a1 +
      ' [' + change.transactionId + ']: ' + change.currentValue + ' → ' + change.newValue);
  });
  lines.push('');
  lines.push('Formula-derived cells (14 verified, never overwritten):');
  plan.derivedCells.forEach(function (cell) {
    lines.push('  VERIFY Transactions!' + cell.a1 + ' [' + cell.transactionId +
      '] follows ' + cell.manualA1 + ' and will evaluate to ' + cell.expectedValue);
  });
  lines.push('');
  lines.push('Pending: ' + pending + ' direct cell change(s). No amounts, dates, tips, wages, or subcategories will change.');
  return lines.join('\n');
}

function legacyIncomeV0025Fingerprint_(plan) {
  return plan.spreadsheetName + '|' + plan.timezone + '|' + plan.directChanges.map(function (change, index) {
    var derived = plan.derivedCells[index];
    return change.sheet + '!' + change.a1 + '=' + change.currentValue + '|' +
      derived.sheet + '!' + derived.a1 + '=' + derived.currentValue + '|' + derived.formula;
  }).join('|');
}

// Writes only the 14 direct manual-category cells, then verifies both those
// cells and their untouched formula-derived effective-category cells.
function applyLegacyIncomeV0025Plan_(plan) {
  assertLegacyIncomeV0025Environment_();
  var pending = plan.directChanges.filter(function (change) { return change.state === 'pending'; });
  var written = [];
  try {
    pending.forEach(function (change) {
      var range = sheet_(change.sheet).getRange(change.a1);
      var current = legacyIncomeV0025Value_(range.getValue());
      if (current !== change.oldValue) {
        throw new Error(change.sheet + '!' + change.a1 + ' changed after preview; found "' + current +
          '" instead of "' + change.oldValue + '".');
      }
      range.setValue(change.newValue);
      written.push({ range: range, oldValue: change.oldValue });
    });

    SpreadsheetApp.flush();
    plan.directChanges.forEach(function (change) {
      var finalValue = legacyIncomeV0025Value_(sheet_(change.sheet).getRange(change.a1).getValue());
      if (finalValue !== change.newValue) {
        throw new Error('Verification failed for ' + change.sheet + '!' + change.a1 + ': found "' +
          finalValue + '" after writing "' + change.newValue + '".');
      }
    });
    plan.derivedCells.forEach(function (cell) {
      var range = sheet_(cell.sheet).getRange(cell.a1);
      var finalFormula = range.getFormula();
      var finalValue = legacyIncomeV0025Value_(range.getValue());
      if (finalFormula !== cell.formula) {
        throw new Error('Verification failed for ' + cell.sheet + '!' + cell.a1 +
          ': its formula changed during correction.');
      }
      if (finalValue !== cell.expectedValue) {
        throw new Error('Verification failed for ' + cell.sheet + '!' + cell.a1 + ': formula evaluates to "' +
          finalValue + '" instead of "' + cell.expectedValue + '".');
      }
    });
  } catch (error) {
    var rollbackErrors = [];
    for (var i = written.length - 1; i >= 0; i--) {
      try { written[i].range.setValue(written[i].oldValue); }
      catch (rollbackError) { rollbackErrors.push(rollbackError.message); }
    }
    try { SpreadsheetApp.flush(); }
    catch (flushError) { rollbackErrors.push(flushError.message); }
    throw new Error('v0.0.25 correction failed: ' + error.message +
      (rollbackErrors.length
        ? ' Rollback also reported: ' + rollbackErrors.join(' | ') + '. Inspect development before retrying.'
        : ' Its completed direct-cell writes were rolled back.'));
  }

  return { changedCells: pending.length, verifiedFormulaCells: plan.derivedCells.length };
}

function previewLegacyIncomeCorrections() {
  var ui = SpreadsheetApp.getUi();
  try {
    var plan = buildLegacyIncomeV0025Plan_();
    ui.alert('Budget Tools — v0.0.25 Correction Preview', formatLegacyIncomeV0025Plan_(plan), ui.ButtonSet.OK);
    return plan;
  } catch (error) {
    ui.alert('v0.0.25 correction preview failed: ' + error.message);
    return null;
  }
}

function applyLegacyIncomeCorrections() {
  var ui = SpreadsheetApp.getUi();
  var lock;
  try {
    var previewPlan = buildLegacyIncomeV0025Plan_();
    var pendingCells = previewPlan.directChanges.filter(function (change) { return change.state === 'pending'; }).length;
    if (!pendingCells) {
      ui.alert('v0.0.25 corrections are already fully applied. All 14 formula-derived cells were also verified. No writes were made.');
      return;
    }

    var response = ui.prompt(
      'Apply v0.0.25 Development Corrections',
      formatLegacyIncomeV0025Plan_(previewPlan) + '\n\nType exactly: ' + LEGACY_INCOME_V0025_CONFIRMATION_,
      ui.ButtonSet.OK_CANCEL
    );
    if (response.getSelectedButton() !== ui.Button.OK) return;
    if (String(response.getResponseText() || '').trim() !== LEGACY_INCOME_V0025_CONFIRMATION_) {
      ui.alert('Safety abort: confirmation text did not match. No writes were made.');
      return;
    }

    lock = LockService.getDocumentLock();
    if (!lock.tryLock(30000)) {
      throw new Error('Could not obtain the development spreadsheet lock within 30 seconds. No writes were made.');
    }
    var lockedPlan = buildLegacyIncomeV0025Plan_();
    if (legacyIncomeV0025Fingerprint_(lockedPlan) !== legacyIncomeV0025Fingerprint_(previewPlan)) {
      throw new Error('Spreadsheet state changed after the confirmation preview. No writes were made; run Preview again.');
    }

    var result = applyLegacyIncomeV0025Plan_(lockedPlan);
    SpreadsheetApp.flush();

    var refreshError = '';
    try { recomputeBudgetSummaryMetrics_(); }
    catch (error) { refreshError = error.message; }

    var findings = null;
    var healthError = '';
    try { findings = runDataHealthCheck_(); }
    catch (error) { healthError = error.message; }

    var details = 'Corrected ' + result.changedCells + ' legacy Manual_Category_ID cell(s) from CAT-INCOME to INCOME and verified ' +
      result.verifiedFormulaCells + ' untouched Effective_Category_ID formula cell(s).';
    if (refreshError) details += ' Budget summary refresh warning: ' + refreshError;
    if (healthError) details += ' Health-check warning: ' + healthError;
    else details += ' Post-migration Data Health Check found ' + findings.length + ' remaining issue(s).';
    logChange_('Apply v0.0.25 Legacy Income-ID Corrections', details);

    var lines = [
      '✓ v0.0.25 development corrections applied and verified.',
      result.changedCells + ' direct Manual_Category_ID cell correction(s) written.',
      '✓ ' + result.verifiedFormulaCells + ' Effective_Category_ID formulas preserved and recalculated to INCOME.'
    ];
    lines.push(refreshError ? '⚠ Budget summary refresh failed: ' + refreshError : '✓ Budget summary refreshed.');
    if (healthError) lines.push('⚠ Data Health Check failed to run: ' + healthError);
    else if (findings.length) lines.push('⚠ Data Health Check still reports ' + findings.length + ' issue(s). Run it from the menu for details.');
    else lines.push('✓ Data Health Check reports no issues.');

    var finalFlushError = '';
    try { SpreadsheetApp.flush(); } catch (error) { finalFlushError = error.message; }
    if (finalFlushError) lines.push('⚠ Final spreadsheet flush warning: ' + finalFlushError);
    try { lock.releaseLock(); lock = null; }
    catch (error) { lines.push('⚠ Document-lock release warning: ' + error.message); }
    ui.alert('Budget Tools — v0.0.25 Correction Result', lines.join('\n'), ui.ButtonSet.OK);
  } catch (error) {
    ui.alert('v0.0.25 correction aborted: ' + error.message);
  } finally {
    if (lock) {
      try { lock.releaseLock(); } catch (ignored) { /* best-effort */ }
    }
  }
}

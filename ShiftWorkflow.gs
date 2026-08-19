// ================= ADD SHIFT END-TO-END (v0.0.31) =====================
// One shift is a recoverable unit: one Tip Tracker source row, one batch
// count increment, two Raw Transactions rows, and two Transactions rows.
// Browser input is untrusted. Preview and posting both call the same pure
// calculation function; the authoritative commit revalidates under one
// document lock and reverses every attempted write on failure.

var TIP_TRACKER_SHEET_NAME = 'Tip Tracker';
var TIP_TRACKER_HEADER_ROW = 9;
var TIP_TRACKER_DATA_START_ROW = 10;
var TIP_TRACKER_HEADERS_ = [
  'Date', 'Member', 'Sales', 'Cash Tips', 'CC Tips', 'Hours',
  'Floor Tip-Out', 'Bar Tip-Out', 'CC Tip-Out', 'Net Tips', 'Wages',
  'Logged At', 'Shift ID', 'Calculation Settings'
];
var SHIFT_BATCH_ID_ = 'BATCH-SHIFT-ENTRY';
var SHIFT_LOCK_TIMEOUT_MS_ = 10000;
var SHIFT_CALCULATION_VERSION_ = 'v1-cent-rounded';

function ensureIncomeSubcategory_(name) {
  var existing = readTable_('Categories');
  var matches = existing.filter(function (c) {
    return c.Record_Type === 'Subcategory' && c.Parent_Category_ID === 'INCOME' &&
      String(c.Category_Name || '').trim().toLowerCase() === name.toLowerCase();
  });
  if (matches.length > 1) {
    throw new Error('More than one Income subcategory named "' + name + '" exists. Run Data Health Check before adding a shift.');
  }
  if (matches.length === 1) {
    if (matches[0].Active_Flag !== 'Yes') {
      throw new Error('Income subcategory "' + name + '" is inactive. Reactivate it before adding a shift.');
    }
    return matches[0].Category_ID;
  }

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
    Income_Stability_Default: 'Variable',
    Active_Flag: 'Yes',
    Legacy_Budget_Label: name,
    Sort_Order: maxSort + 1
  }));
  insertBudgetRow_('Income', name, '', 'Variable', subId);
  logChange_('Add Category', subId + ' "' + name + '" (Income) — auto-created by Add Shift setup');
  return subId;
}

function ensureTipTrackerLayout_(sh) {
  var existing = sh.getRange(TIP_TRACKER_HEADER_ROW, 1, 1, TIP_TRACKER_HEADERS_.length).getValues()[0];
  for (var i = 0; i < 12; i++) {
    if (existing[i] !== TIP_TRACKER_HEADERS_[i]) {
      throw new Error('Tip Tracker header ' + (i + 1) + ' must be "' + TIP_TRACKER_HEADERS_[i] + '"; found "' +
        String(existing[i] || '(blank)') + '". No shift was added.');
    }
  }
  for (var j = 12; j < TIP_TRACKER_HEADERS_.length; j++) {
    if (existing[j] && existing[j] !== TIP_TRACKER_HEADERS_[j]) {
      throw new Error('Tip Tracker column ' + (j + 1) + ' is already used by "' + existing[j] +
        '". The v0.0.31 Shift ID audit columns were not installed.');
    }
  }
  if (!existing[12] || !existing[13]) {
    sh.getRange(TIP_TRACKER_HEADER_ROW, 13, 1, 2)
      .setValues([[TIP_TRACKER_HEADERS_[12], TIP_TRACKER_HEADERS_[13]]])
      .setFontWeight('bold');
  }
  return sh;
}

function requireTipTrackerLayout_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TIP_TRACKER_SHEET_NAME);
  if (!sh) throw new Error('Tip Tracker is not set up. Close and reopen Add Shift.');
  var headers = sh.getRange(TIP_TRACKER_HEADER_ROW, 1, 1, TIP_TRACKER_HEADERS_.length).getValues()[0];
  TIP_TRACKER_HEADERS_.forEach(function (header, index) {
    if (headers[index] !== header) {
      throw new Error('Tip Tracker is missing required header "' + header + '". Close and reopen Add Shift.');
    }
  });
  return sh;
}

function getOrCreateTipTrackerSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(TIP_TRACKER_SHEET_NAME);
  if (sh) return ensureTipTrackerLayout_(sh);

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
  sh.getRange(3, 2, settingsRows.length, 1).setBackground('#fff2cc');
  ss.setNamedRange('TT_FLOOR_PCT', sh.getRange('B3'));
  ss.setNamedRange('TT_BAR_PCT', sh.getRange('B4'));
  ss.setNamedRange('TT_BAR_ROUND', sh.getRange('B5'));
  ss.setNamedRange('TT_CC_PCT', sh.getRange('B6'));
  ss.setNamedRange('TT_HOURLY_RATE', sh.getRange('B7'));
  sh.getRange(TIP_TRACKER_HEADER_ROW, 1, 1, TIP_TRACKER_HEADERS_.length)
    .setValues([TIP_TRACKER_HEADERS_]).setFontWeight('bold');
  sh.setColumnWidth(1, 100);
  sh.autoResizeColumns(2, 13);
  return sh;
}

function roundShiftMoney_(value) {
  var scaled = Number(value) * 100;
  var rounded = scaled < 0 ? -Math.round(-scaled + 1e-9) : Math.round(scaled + 1e-9);
  return rounded / 100;
}

function normalizeShiftSettings_(settings) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    throw new Error('Tip Tracker settings are unavailable.');
  }
  function number_(field, label, min, max, wholeCents) {
    var value = Number(settings[field]);
    if (!isFinite(value) || value < min || (max !== null && value > max)) {
      throw new Error(label + ' must be between ' + min + (max === null ? ' and a valid number.' : ' and ' + max + '.'));
    }
    if (wholeCents && Math.abs(value * 100 - Math.round(value * 100)) > 0.0000001) {
      throw new Error(label + ' must use no more than two decimal places.');
    }
    return wholeCents ? Math.round(value * 100) / 100 : value;
  }
  return {
    floorPct: number_('floorPct', 'Floor tip-out percentage', 0, 100, false),
    barPct: number_('barPct', 'Bar tip-out percentage', 0, 100, false),
    barRound: number_('barRound', 'Bar tip-out rounding', 0, null, true),
    ccPct: number_('ccPct', 'Credit-card tip-out percentage', 0, 100, false),
    hourlyRate: number_('hourlyRate', 'Hourly wage rate', 0.01, null, true)
  };
}

function getTipTrackerSettings_() {
  requireTipTrackerLayout_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  function readNamed_(name) {
    var range = ss.getRangeByName(name);
    if (!range) throw new Error('Missing named range "' + name + '" on Tip Tracker.');
    var value = range.getValue();
    if (typeof value !== 'number' || !isFinite(value)) {
      throw new Error('The value for "' + name + '" on Tip Tracker must be a number.');
    }
    return value;
  }
  return normalizeShiftSettings_({
    floorPct: readNamed_('TT_FLOOR_PCT'),
    barPct: readNamed_('TT_BAR_PCT'),
    barRound: readNamed_('TT_BAR_ROUND'),
    ccPct: readNamed_('TT_CC_PCT'),
    hourlyRate: readNamed_('TT_HOURLY_RATE')
  });
}

function shiftSettingsFingerprint_(settings) {
  var normalized = normalizeShiftSettings_(settings);
  return [SHIFT_CALCULATION_VERSION_, normalized.floorPct, normalized.barPct,
    normalized.barRound, normalized.ccPct, normalized.hourlyRate].join('|');
}

function normalizeShiftDecimal_(value, label, options) {
  options = options || {};
  if ((value === '' || value === null || typeof value === 'undefined') && options.blankAsZero) return 0;
  if (typeof value !== 'string' && typeof value !== 'number') throw new Error(label + ' must be a number.');
  var text = typeof value === 'string' ? value.trim() : String(value);
  var decimals = options.decimals;
  var pattern = decimals === 2 ? /^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/ : /^\d+(?:\.\d+)?$/;
  if (!pattern.test(text)) throw new Error(label + ' must use no more than ' + decimals + ' decimal places.');
  var number = Number(text);
  if (!isFinite(number) || number < 0 || (options.positive && number <= 0)) {
    throw new Error(label + (options.positive ? ' must be greater than zero.' : ' cannot be negative.'));
  }
  if (options.max !== null && typeof options.max !== 'undefined' && number > options.max) {
    throw new Error(label + ' cannot exceed ' + options.max + '.');
  }
  var scale = Math.pow(10, decimals);
  if (Math.abs(number * scale - Math.round(number * scale)) > 0.0000001) {
    throw new Error(label + ' must use no more than ' + decimals + ' decimal places.');
  }
  if (Math.abs(number * scale) > 9007199254740991) throw new Error(label + ' is too large to represent safely.');
  return Math.round(number * scale) / scale;
}

function normalizeShiftCalculationInput_(form, requireHours) {
  if (!form || typeof form !== 'object' || Array.isArray(form)) throw new Error('Shift input is missing or invalid.');
  var hoursBlank = form.hours === '' || form.hours === null || typeof form.hours === 'undefined';
  return {
    sales: normalizeShiftDecimal_(form.sales, 'Sales', { decimals: 2, blankAsZero: true }),
    cashTips: normalizeShiftDecimal_(form.cashTips, 'Cash tips', { decimals: 2, blankAsZero: true }),
    ccTips: normalizeShiftDecimal_(form.ccTips, 'Credit-card tips', { decimals: 2, blankAsZero: true }),
    hours: hoursBlank && !requireHours ? 0 : normalizeShiftDecimal_(form.hours, 'Hours worked', {
      decimals: 2, blankAsZero: false, positive: true, max: 24
    })
  };
}

function calcShiftAmounts_(input, settings) {
  var normalizedSettings = normalizeShiftSettings_(settings);
  var floorTipOut = roundShiftMoney_(input.sales * normalizedSettings.floorPct / 100);
  var barRaw = input.sales * normalizedSettings.barPct / 100;
  var barTipOut = normalizedSettings.barRound > 0 && barRaw > 0 ?
    roundShiftMoney_(Math.ceil((barRaw - 1e-9) / normalizedSettings.barRound) * normalizedSettings.barRound) :
    roundShiftMoney_(barRaw);
  var ccTipOut = roundShiftMoney_(input.ccTips * normalizedSettings.ccPct / 100);
  return {
    floorTipOut: floorTipOut,
    barTipOut: barTipOut,
    ccTipOut: ccTipOut,
    netTips: roundShiftMoney_(input.cashTips + input.ccTips - floorTipOut - barTipOut - ccTipOut),
    wages: roundShiftMoney_(input.hours * normalizedSettings.hourlyRate)
  };
}

function validateShiftDateKey_(value, timeZone) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    throw new Error('Date must use YYYY-MM-DD format.');
  }
  var dateKey = value.trim();
  var parts = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  var year = Number(parts[1]), month = Number(parts[2]), day = Number(parts[3]);
  var leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  var lengths = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1000 || month < 1 || month > 12 || day < 1 || day > lengths[month - 1]) {
    throw new Error('Date must be a valid Toronto calendar date.');
  }
  if (timeZone !== EXPECTED_TIMEZONE_) throw new Error('Spreadsheet timezone must be ' + EXPECTED_TIMEZONE_ + '.');
  return dateKey;
}

function getShiftCategories_() {
  var rows = readTable_('Categories');
  function findUniqueShiftCategory_(name) {
    var matches = rows.filter(function (row) {
      return row.Record_Type === 'Subcategory' && row.Parent_Category_ID === 'INCOME' &&
        row.Active_Flag === 'Yes' && String(row.Category_Name || '').trim().toLowerCase() === name.toLowerCase();
    });
    if (matches.length !== 1 || !matches[0].Category_ID) {
      throw new Error('Expected exactly one active Income subcategory named "' + name + '". Close and reopen Add Shift.');
    }
    return { id: matches[0].Category_ID, name: name };
  }
  return {
    wages: findUniqueShiftCategory_('Wages'),
    tips: findUniqueShiftCategory_('Tips')
  };
}

function getShiftReferenceData_() {
  var account = getActiveAccount_();
  return {
    members: getHouseholdMembersList_(),
    accountId: account.id,
    accountCurrency: account.currency,
    timeZone: getTz_(),
    categories: getShiftCategories_()
  };
}

function validateAndNormalizeShiftInput_(form, referenceData, settings) {
  if (!referenceData || typeof referenceData !== 'object' || Array.isArray(referenceData)) {
    throw new Error('Shift reference data is unavailable.');
  }
  var calculationInput = normalizeShiftCalculationInput_(form, true);
  var dateKey = validateShiftDateKey_(form.date, String(referenceData.timeZone || '').trim());
  if (typeof form.memberId !== 'string' || !form.memberId.trim()) throw new Error('Who worked this shift is required.');
  var memberId = form.memberId.trim();
  var members = Array.isArray(referenceData.members) ? referenceData.members : [];
  if (!members.some(function (member) { return member && member.id === memberId; })) {
    throw new Error('Household member is no longer active — reopen Add Shift.');
  }
  if (typeof form.confirmed !== 'boolean') throw new Error('Duplicate-shift confirmation is invalid.');
  var accountId = String(referenceData.accountId || '').trim();
  if (!accountId) throw new Error('No active account is available for this shift.');
  var currency = requireAuthoritativeCurrency_(referenceData.accountCurrency, 'Active account ' + accountId);
  if (!referenceData.categories || !referenceData.categories.wages || !referenceData.categories.tips) {
    throw new Error('Wages or Tips category configuration is incomplete.');
  }
  var normalizedSettings = normalizeShiftSettings_(settings);
  return {
    dateKey: dateKey,
    timeZone: referenceData.timeZone,
    memberId: memberId,
    accountId: accountId,
    currency: currency,
    confirmed: form.confirmed,
    settingsFingerprint: typeof form.settingsFingerprint === 'string' ? form.settingsFingerprint : '',
    sales: calculationInput.sales,
    cashTips: calculationInput.cashTips,
    ccTips: calculationInput.ccTips,
    hours: calculationInput.hours,
    settings: normalizedSettings,
    calculation: calcShiftAmounts_(calculationInput, normalizedSettings),
    categories: referenceData.categories
  };
}

function parseShiftDate_(input) {
  var date = Utilities.parseDate(input.dateKey, input.timeZone, 'yyyy-MM-dd');
  if (!(date instanceof Date) || isNaN(date.getTime()) ||
      Utilities.formatDate(date, input.timeZone, 'yyyy-MM-dd') !== input.dateKey) {
    throw new Error('Shift date could not be represented safely in ' + input.timeZone + '.');
  }
  return date;
}

function buildShiftPreviewWithSettings_(form, settings) {
  var normalizedSettings = normalizeShiftSettings_(settings);
  var input = normalizeShiftCalculationInput_(form || {}, false);
  return {
    ready: input.hours > 0,
    calculation: calcShiftAmounts_(input, normalizedSettings),
    settings: normalizedSettings,
    settingsFingerprint: shiftSettingsFingerprint_(normalizedSettings),
    calculationVersion: SHIFT_CALCULATION_VERSION_
  };
}

function buildShiftPreview_(form) {
  return buildShiftPreviewWithSettings_(form, getTipTrackerSettings_());
}

function getShiftPreview(form) {
  return buildShiftPreview_(form);
}

function showAddShiftDialog() {
  getOrCreateTipTrackerSheet_();
  ensureIncomeSubcategory_('Wages');
  ensureIncomeSubcategory_('Tips');
  var template = HtmlService.createTemplateFromFile('AddShiftDialog');
  template.members = getHouseholdMembersList_();
  template.today = todayStr_();
  var html = template.evaluate().setWidth(440).setHeight(650);
  SpreadsheetApp.getUi().showModalDialog(html, 'Add a shift');
}

function readTipTrackerRows_() {
  var sh = requireTipTrackerLayout_();
  var lastRow = sh.getLastRow();
  if (lastRow < TIP_TRACKER_DATA_START_ROW) return [];
  var values = sh.getRange(TIP_TRACKER_DATA_START_ROW, 1,
    lastRow - TIP_TRACKER_DATA_START_ROW + 1, TIP_TRACKER_HEADERS_.length).getValues();
  return values.map(function (row, index) {
    var result = { _row: TIP_TRACKER_DATA_START_ROW + index };
    TIP_TRACKER_HEADERS_.forEach(function (header, column) { result[header] = row[column]; });
    return result;
  }).filter(function (row) { return row.Date || row['Shift ID']; });
}

function calcShiftLinkHealthFindings_(tipRows, rawRows, transactionRows, categoryRows) {
  if (!Array.isArray(tipRows) || !Array.isArray(rawRows) || !Array.isArray(transactionRows) ||
      !Array.isArray(categoryRows)) throw new Error('Shift health inputs must be arrays.');
  var findings = [];
  function shiftHealthFlag_(message) { findings.push({ section: 'Shift linkage', msg: message }); }
  function groupShiftRows_(rows, field) {
    var groups = {};
    rows.forEach(function (row) {
      var id = String(row && row[field] || '').trim();
      if (!/^SHIFT-\d{6}$/.test(id)) return;
      if (!groups[id]) groups[id] = [];
      groups[id].push(row);
    });
    return groups;
  }
  function activeIncomeSubcategoryId_(name) {
    var matches = categoryRows.filter(function (row) {
      return row.Record_Type === 'Subcategory' && row.Parent_Category_ID === 'INCOME' &&
        row.Active_Flag === 'Yes' && String(row.Category_Name || '').trim().toLowerCase() === name.toLowerCase();
    });
    return matches.length === 1 ? String(matches[0].Category_ID || '').trim() : '';
  }
  function sameShiftHealthAmount_(left, right) {
    return typeof left === 'number' && isFinite(left) && typeof right === 'number' && isFinite(right) &&
      Math.abs(left - right) < 0.0000001;
  }
  function sameShiftHealthDate_(left, right) {
    return left instanceof Date && right instanceof Date && left.getTime() === right.getTime();
  }

  var tipByShift = groupShiftRows_(tipRows, 'Shift ID');
  var rawByShift = groupShiftRows_(rawRows, 'Source_Transaction_ID');
  var txByShift = groupShiftRows_(transactionRows, 'Source_Transaction_ID');
  var wagesSubcategoryId = activeIncomeSubcategoryId_('Wages');
  var tipsSubcategoryId = activeIncomeSubcategoryId_('Tips');

  tipRows.forEach(function (row) {
    var id = String(row && row['Shift ID'] || '').trim();
    if (id && !/^SHIFT-\d{6}$/.test(id)) {
      shiftHealthFlag_('Tip Tracker row ' + (row._row || '?') + ' has invalid Shift ID "' + id + '".');
    }
  });
  Object.keys(rawByShift).forEach(function (id) {
    if (!tipByShift[id]) shiftHealthFlag_(id + ' appears in Raw Transactions but has no Tip Tracker source row.');
  });
  Object.keys(txByShift).forEach(function (id) {
    if (!tipByShift[id]) shiftHealthFlag_(id + ' appears in Transactions but has no Tip Tracker source row.');
  });

  Object.keys(tipByShift).sort().forEach(function (shiftId) {
    var sources = tipByShift[shiftId];
    var raw = rawByShift[shiftId] || [];
    var transactions = txByShift[shiftId] || [];
    if (sources.length !== 1) {
      shiftHealthFlag_(shiftId + ' has ' + sources.length + ' Tip Tracker source rows; expected exactly one.');
      return;
    }
    if (raw.length !== 2) shiftHealthFlag_(shiftId + ' has ' + raw.length + ' Raw Transactions rows; expected Wages and Tips.');
    if (transactions.length !== 2) shiftHealthFlag_(shiftId + ' has ' + transactions.length + ' Transactions rows; expected Wages and Tips.');

    var source = sources[0];
    var snapshotText = String(source['Calculation Settings'] || '').trim();
    try {
      var snapshot = JSON.parse(snapshotText);
      if (!snapshot || typeof snapshot.version !== 'string' || !snapshot.version.trim()) {
        throw new Error('missing calculation version');
      }
      normalizeShiftSettings_(snapshot);
    } catch (snapshotError) {
      shiftHealthFlag_(shiftId + ' has missing or invalid Calculation Settings metadata.');
    }

    var rawByCategory = {};
    raw.forEach(function (row) {
      var category = String(row.Raw_Category || '').trim();
      if (!rawByCategory[category]) rawByCategory[category] = [];
      rawByCategory[category].push(row);
    });
    ['Wages', 'Tips'].forEach(function (category) {
      var matchingRaw = rawByCategory[category] || [];
      if (matchingRaw.length !== 1) {
        shiftHealthFlag_(shiftId + ' has ' + matchingRaw.length + ' Raw Transactions rows categorized as ' + category + '; expected one.');
        return;
      }
      var rawRow = matchingRaw[0];
      var linkedTransactions = transactions.filter(function (row) { return row.Raw_Record_ID === rawRow.Raw_Record_ID; });
      if (linkedTransactions.length !== 1) {
        shiftHealthFlag_(shiftId + ' Raw record ' + rawRow.Raw_Record_ID + ' has ' + linkedTransactions.length +
          ' linked Transactions rows; expected one.');
        return;
      }
      var transaction = linkedTransactions[0];
      var expectedAmount = category === 'Wages' ? source.Wages : source['Net Tips'];
      var expectedSubcategoryId = category === 'Wages' ? wagesSubcategoryId : tipsSubcategoryId;
      if (!sameShiftHealthAmount_(rawRow.Raw_Amount, expectedAmount) ||
          !sameShiftHealthAmount_(transaction.Amount, expectedAmount)) {
        shiftHealthFlag_(shiftId + ' ' + category + ' amount does not agree across Tip Tracker, Raw Transactions, and Transactions.');
      }
      if (rawRow.Raw_Type !== 'Income' || transaction.Transaction_Type !== 'Income' ||
          !sameShiftHealthDate_(rawRow.Raw_Transaction_Date, source.Date) ||
          !sameShiftHealthDate_(transaction.Transaction_Date, source.Date) ||
          transaction.Member_ID !== source.Member ||
          transaction.Account_ID !== rawRow.Account_ID || transaction.Currency !== rawRow.Raw_Currency ||
          (expectedSubcategoryId && transaction.Effective_Subcategory_ID !== expectedSubcategoryId)) {
        shiftHealthFlag_(shiftId + ' ' + category + ' date, account, member, currency, type, or subcategory linkage is inconsistent.');
      }
    });
  });
  return findings;
}

function readShiftCommitState_() {
  var transactionSheet = sheet_('Transactions');
  var rawSheet = sheet_('Raw Transactions');
  var batchSheet = sheet_('Import Batches');
  var tipSheet = requireTipTrackerLayout_();
  var transactions = readTable_('Transactions');
  var rawTransactions = readTable_('Raw Transactions');
  var tipRows = readTipTrackerRows_();
  return {
    transactionIds: transactions.map(function (row) { return row.Transaction_ID; }),
    rawRecordIds: rawTransactions.map(function (row) { return row.Raw_Record_ID; }),
    shiftIds: tipRows.map(function (row) { return row['Shift ID']; }).filter(String),
    importBatches: readTable_('Import Batches'),
    tipTrackerRows: tipRows,
    nextTransactionRow: transactionSheet.getLastRow() + 1,
    nextRawRow: rawSheet.getLastRow() + 1,
    nextBatchRow: batchSheet.getLastRow() + 1,
    nextTipTrackerRow: tipSheet.getLastRow() + 1,
    now: new Date()
  };
}

function planShiftCommit_(input, shiftDate, state) {
  if (!input || !state || !Array.isArray(state.transactionIds) || !Array.isArray(state.rawRecordIds) ||
      !Array.isArray(state.shiftIds) || !Array.isArray(state.importBatches)) {
    throw new Error('Shift commit state is incomplete. No changes were made.');
  }
  ['nextTransactionRow', 'nextRawRow', 'nextBatchRow', 'nextTipTrackerRow'].forEach(function (field) {
    var value = Number(state[field]);
    if (!isFinite(value) || Math.floor(value) !== value || value < 5) {
      throw new Error('Shift commit state has an invalid ' + field + '.');
    }
  });
  var batches = state.importBatches.filter(function (row) { return row.Import_Batch_ID === SHIFT_BATCH_ID_; });
  if (batches.length > 1) throw new Error('More than one ' + SHIFT_BATCH_ID_ + ' row exists.');
  var existingBatch = batches[0] || null;
  var previousCount = existingBatch ? Number(existingBatch.Record_Count) : 0;
  if (!isFinite(previousCount) || previousCount < 0 || Math.floor(previousCount) !== previousCount) {
    throw new Error(SHIFT_BATCH_ID_ + ' has an invalid Record_Count.');
  }
  if (existingBatch && existingBatch.Account_ID && existingBatch.Account_ID !== input.accountId) {
    throw new Error(SHIFT_BATCH_ID_ + ' belongs to a different account.');
  }

  var shiftId = 'SHIFT-' + pad_(nextSequenceFromIds_(state.shiftIds), 6);
  var transactionSeq = nextSequenceFromIds_(state.transactionIds);
  var rawSeq = nextSequenceFromIds_(state.rawRecordIds);
  var transactionIds = ['TXN-SHIFT-' + pad_(transactionSeq, 6), 'TXN-SHIFT-' + pad_(transactionSeq + 1, 6)];
  var rawRecordIds = ['RAW-SHIFT-' + pad_(rawSeq, 6), 'RAW-SHIFT-' + pad_(rawSeq + 1, 6)];
  if (state.shiftIds.indexOf(shiftId) !== -1 || transactionIds.some(function (id) { return state.transactionIds.indexOf(id) !== -1; }) ||
      rawRecordIds.some(function (id) { return state.rawRecordIds.indexOf(id) !== -1; })) {
    throw new Error('Could not allocate unique Shift/Transaction IDs.');
  }

  var now = state.now;
  var dateLabel = input.dateKey;
  var settingsSnapshot = JSON.stringify({
    version: SHIFT_CALCULATION_VERSION_,
    floorPct: input.settings.floorPct,
    barPct: input.settings.barPct,
    barRound: input.settings.barRound,
    ccPct: input.settings.ccPct,
    hourlyRate: input.settings.hourlyRate
  });
  var batchValues = {
    Import_Batch_ID: SHIFT_BATCH_ID_, Imported_At: now,
    Source_System: 'Manual entry (Add Shift tool)', Source_File: '', Account_ID: input.accountId,
    Record_Count: previousCount + 1, Status: 'Completed',
    Notes: 'Counts submitted shifts; each shift creates one Wages and one Tips raw/transaction pair.'
  };
  var kinds = [
    { name: 'Wages', amount: input.calculation.wages, category: input.categories.wages,
      note: shiftId + ' — Shift ' + dateLabel + ' — ' + input.hours + ' hrs' },
    { name: 'Tips', amount: input.calculation.netTips, category: input.categories.tips,
      note: shiftId + ' — Shift ' + dateLabel + ' — net tips after tip-out' }
  ];
  var rawPlans = kinds.map(function (kind, index) {
    return { row: state.nextRawRow + index, id: rawRecordIds[index], values: {
      Raw_Record_ID: rawRecordIds[index], Import_Batch_ID: SHIFT_BATCH_ID_,
      Source_System: 'Manual entry (Add Shift tool)', Account_ID: input.accountId, Imported_At: now,
      Source_Transaction_ID: shiftId, Raw_Transaction_Date: shiftDate, Raw_Type: 'Income',
      Raw_Category: kind.name, Raw_Description: kind.note, Raw_Amount: kind.amount,
      Raw_Currency: input.currency, Raw_Notes: kind.note, Normalization_Status: 'Normalized'
    }};
  });
  var transactionPlans = kinds.map(function (kind, index) {
    return { row: state.nextTransactionRow + index, id: transactionIds[index], values: {
      Transaction_ID: transactionIds[index], Raw_Record_ID: rawRecordIds[index], Import_Batch_ID: SHIFT_BATCH_ID_,
      Account_ID: input.accountId, Member_ID: input.memberId, Transaction_Date: shiftDate,
      Transaction_Type: 'Income', Amount: kind.amount, Currency: input.currency,
      Original_Description: kind.note, Income_Stability: 'Variable', Manual_Category_ID: 'INCOME',
      Manual_Subcategory_ID: kind.category.id, Reviewed_Flag: 'Yes', Review_Status: 'Confirmed',
      Is_Duplicate: 'No', Source_Transaction_ID: shiftId, User_Notes: kind.note,
      Created_At: now, Updated_At: now
    }};
  });
  return {
    shiftId: shiftId,
    input: input,
    batch: { id: SHIFT_BATCH_ID_, existed: !!existingBatch,
      row: existingBatch ? existingBatch._row : state.nextBatchRow,
      previousRecordCount: previousCount, nextRecordCount: previousCount + 1, values: batchValues },
    tipTracker: { row: state.nextTipTrackerRow, values: [
      shiftDate, input.memberId, input.sales, input.cashTips, input.ccTips, input.hours,
      input.calculation.floorTipOut, input.calculation.barTipOut, input.calculation.ccTipOut,
      input.calculation.netTips, input.calculation.wages, now, shiftId, settingsSnapshot
    ]},
    raw: rawPlans,
    transactions: transactionPlans,
    rawRecordIds: rawRecordIds,
    transactionIds: transactionIds
  };
}

function shiftErrorMessage_(error) {
  return error && error.message ? error.message : String(error);
}

function createShiftSheetAdapter_(plan) {
  var batchSheet = sheet_('Import Batches');
  var tipSheet = requireTipTrackerLayout_();
  var rawSheet = sheet_('Raw Transactions');
  var txSheet = sheet_('Transactions');
  var batchCountCol = col_('Import Batches', 'Record_Count');
  var batchRowValues = plan.batch.existed ? null : rowFromHeaders_('Import Batches', plan.batch.values);
  var rawRows = plan.raw.map(function (item) { return rowFromHeaders_('Raw Transactions', item.values); });
  var txRows = plan.transactions.map(function (item) {
    return rowFromHeaders_('Transactions', addManualTransactionFormulaValues_(item.values, item.row));
  });

  function appendRows_(sheet, expectedRow, rows, label) {
    var nextRow = sheet.getLastRow() + 1;
    if (nextRow !== expectedRow) throw new Error(label + ' changed before commit. Expected row ' + expectedRow + ', found ' + nextRow + '.');
    sheet.getRange(expectedRow, 1, rows.length, rows[0].length).setValues(rows);
  }
  function findUniqueShiftRow_(sheetName, idHeader, id, purpose) {
    var rows = findRowsByStableId_(sheetName, idHeader, id);
    if (rows.length !== 1) throw new Error(purpose + ' expected one ' + id + ' row but found ' + rows.length + '.');
    return rows[0];
  }
  function removeStableRows_(sheet, sheetName, idHeader, ids, shiftId) {
    var rows = [];
    ids.forEach(function (id) {
      var matches = findRowsByStableId_(sheetName, idHeader, id);
      if (!matches.length) return;
      if (matches.length !== 1 || matches[0].Source_Transaction_ID !== shiftId) {
        throw new Error('Refused to remove ' + id + ' because it no longer belongs uniquely to ' + shiftId + '.');
      }
      rows.push(matches[0]._row);
    });
    rows.sort(function (a, b) { return b - a; }).forEach(function (row) { sheet.deleteRow(row); });
  }
  function tipRows_() {
    return readTipTrackerRows_().filter(function (row) { return row['Shift ID'] === plan.shiftId; });
  }
  function sameCommittedShiftValue_(actual, expected) {
    if (actual instanceof Date || expected instanceof Date) {
      return actual instanceof Date && expected instanceof Date && actual.getTime() === expected.getTime();
    }
    if (typeof actual === 'number' || typeof expected === 'number') {
      return typeof actual === 'number' && typeof expected === 'number' &&
        isFinite(actual) && isFinite(expected) && Math.abs(actual - expected) < 0.0000001;
    }
    return actual === expected;
  }
  function assertCommittedShiftFields_(row, expected, fields, label) {
    fields.forEach(function (field) {
      if (!sameCommittedShiftValue_(row[field], expected[field])) {
        throw new Error(label + ' verification failed for ' + field + '.');
      }
    });
  }
  return {
    applyBatch: function () {
      var matches = findRowsByStableId_('Import Batches', 'Import_Batch_ID', plan.batch.id);
      if (plan.batch.existed) {
        if (matches.length !== 1 || Number(matches[0].Record_Count) !== plan.batch.previousRecordCount) {
          throw new Error('The shift batch changed before its count could be updated.');
        }
        batchSheet.getRange(matches[0]._row, batchCountCol).setValue(plan.batch.nextRecordCount);
      } else {
        if (matches.length || batchSheet.getLastRow() + 1 !== plan.batch.row) throw new Error('The shift batch changed before commit.');
        batchSheet.appendRow(batchRowValues);
      }
    },
    writeTipTracker: function () {
      if (tipRows_().length) throw new Error(plan.shiftId + ' already exists on Tip Tracker.');
      appendRows_(tipSheet, plan.tipTracker.row, [plan.tipTracker.values], 'Tip Tracker');
    },
    writeRawPair: function () {
      plan.rawRecordIds.forEach(function (id) {
        if (findRowsByStableId_('Raw Transactions', 'Raw_Record_ID', id).length) throw new Error(id + ' already exists.');
      });
      appendRows_(rawSheet, plan.raw[0].row, rawRows, 'Raw Transactions');
    },
    writeTransactionPair: function () {
      plan.transactionIds.forEach(function (id) {
        if (findRowsByStableId_('Transactions', 'Transaction_ID', id).length) throw new Error(id + ' already exists.');
      });
      appendRows_(txSheet, plan.transactions[0].row, txRows, 'Transactions');
    },
    verify: function () {
      SpreadsheetApp.flush();
      var batch = findUniqueShiftRow_('Import Batches', 'Import_Batch_ID', plan.batch.id, 'Shift verification');
      if (Number(batch.Record_Count) !== plan.batch.nextRecordCount) throw new Error('Shift batch count verification failed.');
      var tipMatches = tipRows_();
      if (tipMatches.length !== 1) throw new Error('Shift verification did not find exactly one Tip Tracker source row.');
      var expectedTip = {};
      TIP_TRACKER_HEADERS_.forEach(function (header, index) { expectedTip[header] = plan.tipTracker.values[index]; });
      assertCommittedShiftFields_(tipMatches[0], expectedTip, TIP_TRACKER_HEADERS_, 'Tip Tracker ' + plan.shiftId);
      plan.raw.forEach(function (item) {
        var row = findUniqueShiftRow_('Raw Transactions', 'Raw_Record_ID', item.id, 'Shift verification');
        assertCommittedShiftFields_(row, item.values, [
          'Import_Batch_ID', 'Account_ID', 'Source_Transaction_ID', 'Raw_Transaction_Date',
          'Raw_Type', 'Raw_Category', 'Raw_Amount', 'Raw_Currency'
        ], 'Raw Transactions ' + item.id);
      });
      plan.transactions.forEach(function (item, index) {
        var row = findUniqueShiftRow_('Transactions', 'Transaction_ID', item.id, 'Shift verification');
        assertCommittedShiftFields_(row, item.values, [
          'Raw_Record_ID', 'Import_Batch_ID', 'Account_ID', 'Member_ID', 'Transaction_Date',
          'Transaction_Type', 'Amount', 'Currency', 'Manual_Category_ID',
          'Manual_Subcategory_ID', 'Is_Duplicate', 'Source_Transaction_ID'
        ], 'Transactions ' + item.id);
        if (row.Raw_Record_ID !== plan.raw[index].id) throw new Error('Transaction/raw pairing failed for ' + item.id + '.');
        ['Effective_Category_ID', 'Effective_Subcategory_ID', 'Duplicate_Key'].forEach(function (header) {
          var formula = txSheet.getRange(row._row, col_('Transactions', header)).getFormula();
          if (!formula || formula.charAt(0) !== '=') throw new Error('Missing ' + header + ' formula for ' + item.id + '.');
        });
      });
    },
    rollbackTransactionPair: function () {
      removeStableRows_(txSheet, 'Transactions', 'Transaction_ID', plan.transactionIds, plan.shiftId);
    },
    rollbackRawPair: function () {
      removeStableRows_(rawSheet, 'Raw Transactions', 'Raw_Record_ID', plan.rawRecordIds, plan.shiftId);
    },
    rollbackTipTracker: function () {
      var rows = tipRows_();
      if (!rows.length) return;
      if (rows.length !== 1) throw new Error('Refused to remove ambiguous Tip Tracker rows for ' + plan.shiftId + '.');
      tipSheet.deleteRow(rows[0]._row);
    },
    rollbackBatch: function () {
      var matches = findRowsByStableId_('Import Batches', 'Import_Batch_ID', plan.batch.id);
      if (plan.batch.existed) {
        if (matches.length !== 1) throw new Error('Could not locate the original shift batch during rollback.');
        var count = Number(matches[0].Record_Count);
        if (count === plan.batch.previousRecordCount) return;
        if (count !== plan.batch.nextRecordCount) throw new Error('Shift batch count no longer belongs to this attempt.');
        batchSheet.getRange(matches[0]._row, batchCountCol).setValue(plan.batch.previousRecordCount);
      } else {
        if (!matches.length) return;
        if (matches.length !== 1 || Number(matches[0].Record_Count) !== 1 || matches[0].Account_ID !== plan.input.accountId) {
          throw new Error('Refused to remove the new shift batch because it no longer matches this attempt.');
        }
        batchSheet.deleteRow(matches[0]._row);
      }
    },
    verifyRollback: function () {
      SpreadsheetApp.flush();
      if (tipRows_().length) throw new Error('Recovery still found Tip Tracker row ' + plan.shiftId + '.');
      plan.rawRecordIds.forEach(function (id) {
        if (findRowsByStableId_('Raw Transactions', 'Raw_Record_ID', id).length) throw new Error('Recovery still found ' + id + '.');
      });
      plan.transactionIds.forEach(function (id) {
        if (findRowsByStableId_('Transactions', 'Transaction_ID', id).length) throw new Error('Recovery still found ' + id + '.');
      });
      var batches = findRowsByStableId_('Import Batches', 'Import_Batch_ID', plan.batch.id);
      if (plan.batch.existed) {
        if (batches.length !== 1 || Number(batches[0].Record_Count) !== plan.batch.previousRecordCount) {
          throw new Error('Recovery found an incorrect original shift batch count.');
        }
      } else if (batches.length) throw new Error('Recovery still found the new shift batch.');
    }
  };
}

function executeShiftCommit_(plan, adapter) {
  var attempted = { batch: false, tip: false, raw: false, transactions: false };
  try {
    attempted.batch = true; adapter.applyBatch(plan);
    attempted.tip = true; adapter.writeTipTracker(plan);
    attempted.raw = true; adapter.writeRawPair(plan);
    attempted.transactions = true; adapter.writeTransactionPair(plan);
    adapter.verify(plan);
    return plan;
  } catch (error) {
    var rollbackErrors = [];
    if (attempted.transactions) try { adapter.rollbackTransactionPair(plan); }
    catch (e1) { rollbackErrors.push('Transactions: ' + shiftErrorMessage_(e1)); }
    if (attempted.raw) try { adapter.rollbackRawPair(plan); }
    catch (e2) { rollbackErrors.push('Raw Transactions: ' + shiftErrorMessage_(e2)); }
    if (attempted.tip) try { adapter.rollbackTipTracker(plan); }
    catch (e3) { rollbackErrors.push('Tip Tracker: ' + shiftErrorMessage_(e3)); }
    if (attempted.batch) try { adapter.rollbackBatch(plan); }
    catch (e4) { rollbackErrors.push('Import Batches: ' + shiftErrorMessage_(e4)); }
    try { adapter.verifyRollback(plan); }
    catch (e5) { rollbackErrors.push('Recovery verification: ' + shiftErrorMessage_(e5)); }
    if (rollbackErrors.length) {
      throw new Error('CRITICAL: Add Shift failed and automatic recovery was incomplete. Original error: ' +
        shiftErrorMessage_(error) + ' Recovery errors: ' + rollbackErrors.join(' | ') +
        '. Do not retry until development data is inspected.');
    }
    throw new Error('Shift was not saved. Any partial changes were rolled back. Original error: ' + shiftErrorMessage_(error));
  }
}

function shiftSettingsChangedResult_(form, settings) {
  var preview = buildShiftPreviewWithSettings_(form, settings);
  return {
    settingsChanged: true,
    message: 'Tip Tracker settings changed after the preview. Review the updated amounts, then press Log shift again.',
    preview: preview
  };
}

function addShift(form) {
  // Fast read-only preflight. The same authoritative reads and validation
  // repeat after the lock is acquired before any commit state is read.
  var settings = getTipTrackerSettings_();
  var preflight = validateAndNormalizeShiftInput_(form, getShiftReferenceData_(), settings);
  parseShiftDate_(preflight);
  if (preflight.settingsFingerprint !== shiftSettingsFingerprint_(settings)) {
    return shiftSettingsChangedResult_(form, settings);
  }

  var lock = LockService.getDocumentLock();
  if (!lock.tryLock(SHIFT_LOCK_TIMEOUT_MS_)) {
    throw new Error('Another budget update is still finishing. No shift was saved; wait a moment and try again.');
  }
  var plan;
  var committed = false;
  var earlyResult = null;
  var lockReleaseWarning = '';
  try {
    var lockedSettings = getTipTrackerSettings_();
    var input = validateAndNormalizeShiftInput_(form, getShiftReferenceData_(), lockedSettings);
    var shiftDate = parseShiftDate_(input);
    if (input.settingsFingerprint !== shiftSettingsFingerprint_(lockedSettings)) {
      earlyResult = shiftSettingsChangedResult_(form, lockedSettings);
    } else {
      var state = readShiftCommitState_();
      var duplicateCount = state.tipTrackerRows.filter(function (row) {
        return row.Member === input.memberId && row.Date instanceof Date &&
          Utilities.formatDate(row.Date, input.timeZone, 'yyyy-MM-dd') === input.dateKey;
      }).length;
      if (!input.confirmed && duplicateCount) {
        earlyResult = {
          duplicate: true,
          message: duplicateCount + ' shift' + (duplicateCount === 1 ? ' is' : 's are') +
            ' already logged for this household member on ' + input.dateKey +
            '. Log this as an additional shift for the same day?'
        };
      } else {
        plan = planShiftCommit_(input, shiftDate, state);
        executeShiftCommit_(plan, createShiftSheetAdapter_(plan));
        committed = true;
      }
    }
  } finally {
    try { lock.releaseLock(); }
    catch (releaseError) {
      if (committed) lockReleaseWarning = 'the write lock could not be released explicitly';
      else Logger.log('Add Shift lock release warning: ' + shiftErrorMessage_(releaseError));
    }
  }

  if (earlyResult) return earlyResult;

  var warnings = [];
  if (lockReleaseWarning) warnings.push(lockReleaseWarning);
  try { recomputePotentialDuplicateFlags_(); }
  catch (duplicateError) { warnings.push('duplicate flags need a manual refresh'); }
  try { recomputeBudgetSummaryMetrics_(); }
  catch (summaryError) { warnings.push('budget summary needs a manual refresh'); }

  var calc = plan.input.calculation;
  var dateLabel = plan.input.dateKey;
  try {
    logChange_('Add Shift', plan.shiftId + ' on ' + dateLabel + ': ' + plan.transactionIds[0] +
      ' Wages $' + calc.wages.toFixed(2) + ', ' + plan.transactionIds[1] + ' Tips $' + calc.netTips.toFixed(2) +
      ' (Sales $' + plan.input.sales.toFixed(2) + ', tip-out: floor $' + calc.floorTipOut.toFixed(2) +
      ' + bar $' + calc.barTipOut.toFixed(2) + ' + CC $' + calc.ccTipOut.toFixed(2) + ')');
  } catch (changeLogError) {
    warnings.push('Change Log needs a manual entry');
  }

  var message = 'Logged ' + dateLabel + ' as ' + plan.shiftId + ': $' + calc.wages.toFixed(2) +
    ' wages (' + plan.input.hours + ' hrs), $' + calc.netTips.toFixed(2) + ' net tips ' +
    '(after $' + calc.floorTipOut.toFixed(2) + ' floor + $' + calc.barTipOut.toFixed(2) +
    ' bar + $' + calc.ccTipOut.toFixed(2) + ' CC tip-out).';
  if (calc.netTips < 0) message += ' ⚠ Net tips are negative — confirm the entered amounts.';
  if (warnings.length) message += ' Saved successfully; ' + warnings.join(' and ') + '.';
  return {
    ok: true,
    shiftId: plan.shiftId,
    transactionIds: plan.transactionIds,
    rawRecordIds: plan.rawRecordIds,
    calculation: calc,
    warnings: warnings,
    message: message
  };
}

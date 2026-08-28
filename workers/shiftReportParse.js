/**
 * Deterministic parser for Toast-style EMPLOYEE SHIFT REPORT text.
 * Invent-nothing: only fills fields when labeled amounts are present.
 * Prefer Tip Summary over incomplete Credit Card Payments tip totals.
 */

function moneyToCents(raw) {
  if (raw == null) return null;
  const text = String(raw).replace(/[^0-9.-]/g, "");
  if (!text) return null;
  const dollars = Number(text);
  if (!Number.isFinite(dollars) || dollars < 0) return null;
  return Math.round(dollars * 100);
}

function matchMoney(text, patterns) {
  for (const pattern of patterns) {
    const hit = text.match(pattern);
    if (!hit) continue;
    const cents = moneyToCents(hit[1]);
    if (cents != null) return cents;
  }
  return null;
}

function matchNumber(text, patterns) {
  for (const pattern of patterns) {
    const hit = text.match(pattern);
    if (!hit) continue;
    const value = Number(hit[1]);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function normalizeDate(raw) {
  const text = String(raw || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const mdy = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (!mdy) return null;
  const month = Number(mdy[1]);
  const day = Number(mdy[2]);
  const year = Number(mdy[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** True when OCR transcript looks like a Toast / close-out tip sheet. */
export function looksLikeEmployeeShiftReport(ocrText) {
  const compact = String(ocrText || "").replace(/\s+/g, " ");
  if (compact.length < 24) return false;
  const hits = [
    /EMPLOYEE\s+SHIFT\s+REPORT/i,
    /TIP\s+SUMMARY/i,
    /NET\s+SALES/i,
    /GROSS\s+SALES/i,
    /\bHEADCOUNT\b/i,
    /MERCHANT\s+OWES\s+EMPLOYEE/i,
    /TOTAL\s+PAID\s+HOURS/i,
  ].filter((pattern) => pattern.test(compact)).length;
  return hits >= 2;
}

/**
 * @param {string} ocrText
 * @returns {{ draft: Record<string, number|string>|null, warnings: string[], confidence: "high"|"medium"|"low" }}
 */
export function parsePosEmployeeShiftReport(ocrText) {
  const text = String(ocrText || "").replace(/\r/g, "\n");
  const compact = text.replace(/[ \t]+/g, " ");
  const warnings = [];
  if (!looksLikeEmployeeShiftReport(compact) && !/EMPLOYEE\s+SHIFT\s+REPORT|TIP\s+SUMMARY|NET\s+SALES|GROSS\s+SALES|HEADCOUNT/i.test(compact)) {
    return { draft: null, warnings: ["OCR text did not look like an Employee Shift Report."], confidence: "low" };
  }

  const draft = {};

  const clockIn = compact.match(/Clock\s*In[:\s]+(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/i)
    || compact.match(/(\d{1,2}[/.-]\d{1,2}[/.-]\d{4}).{0,40}Clock\s*In/i);
  const reportDate = compact.match(/Report(?:ed)?\s*(?:Date|Start)?[:\s]+(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/i);
  const date = normalizeDate(clockIn?.[1] || reportDate?.[1] || "");
  if (date) draft.date = date;

  const hours = matchNumber(compact, [
    /Total\s+Paid\s+Hours?\s*[:=]?\s*([0-9]+(?:\.[0-9]+)?)\s*H?R?/i,
    /Total\s+Hours?\s*[:=]?\s*([0-9]+(?:\.[0-9]+)?)\s*H?R?/i,
    /Regular\s+Hours?\s*[:=]?\s*([0-9]+(?:\.[0-9]+)?)\s*H?R?/i,
  ]);
  if (hours != null && hours > 0 && hours <= 24) draft.workedHours = Math.round(hours * 100) / 100;

  const netSales = matchMoney(compact, [/Net\s+Sales\s*[:=]?\s*\$?\s*([0-9,]+\.[0-9]{2})/i]);
  const grossSales = matchMoney(compact, [/Gross\s+Sales\s*[:=]?\s*\$?\s*([0-9,]+\.[0-9]{2})/i]);
  const totalSales = matchMoney(compact, [/Total\s+(?:Gross\s+)?Sales\s*[:=]?\s*\$?\s*([0-9,]+\.[0-9]{2})/i]);
  const sales = netSales ?? grossSales ?? totalSales;
  if (sales != null) draft.salesCents = sales;

  const food = matchMoney(compact, [/\bFood\b[^\n$]{0,40}\$?\s*([0-9,]+\.[0-9]{2})/i]);
  if (food != null) draft.foodSalesCents = food;

  const liquor = matchMoney(compact, [/\bLiquor\b[^\n$]{0,40}\$?\s*([0-9,]+\.[0-9]{2})/i]) ?? 0;
  const beverage = matchMoney(compact, [/\bBeverage\b[^\n$]{0,40}\$?\s*([0-9,]+\.[0-9]{2})/i]) ?? 0;
  const wine = matchMoney(compact, [/\bWine\b[^\n$]{0,40}\$?\s*([0-9,]+\.[0-9]{2})/i]) ?? 0;
  const beer = matchMoney(compact, [/\bBeer\b[^\n$]{0,40}\$?\s*([0-9,]+\.[0-9]{2})/i]) ?? 0;
  const alcoholParts = [liquor, beverage, wine, beer].filter((value) => value > 0);
  if (alcoholParts.length) draft.alcoholSalesCents = alcoholParts.reduce((sum, value) => sum + value, 0);

  const tipBlock = compact.match(/TIP\s+SUMMARY([\s\S]{0,1200}?)(?:EXCEPTIONS|DISCOUNT|EMPLOYEE\s+BANK|SIGNATURE|$)/i)?.[1] || compact;
  const cashTips = matchMoney(tipBlock, [/Cash\s+Tips?\s*[^\n$]{0,20}\$?\s*([0-9,]+\.[0-9]{2})/i]);
  if (cashTips != null) draft.cashTipsCents = cashTips;

  const debitTips = matchMoney(tipBlock, [/Debit\s+Tips?\s*[^\n$]{0,20}\$?\s*([0-9,]+\.[0-9]{2})/i]) ?? 0;
  const amexTips = matchMoney(tipBlock, [/Amex\s+Tips?\s*[^\n$]{0,20}\$?\s*([0-9,]+\.[0-9]{2})/i]) ?? 0;
  const visaTips = matchMoney(tipBlock, [/Visa\s+Tips?\s*[^\n$]{0,20}\$?\s*([0-9,]+\.[0-9]{2})/i]) ?? 0;
  const mcTips = matchMoney(tipBlock, [/(?:Mastercard|Master\s*Card)\s+Tips?\s*[^\n$]{0,20}\$?\s*([0-9,]+\.[0-9]{2})/i]) ?? 0;
  const creditTips = matchMoney(tipBlock, [/Credit\s+Tips?\s*[^\n$]{0,20}\$?\s*([0-9,]+\.[0-9]{2})/i]);
  const cardFromParts = debitTips + amexTips + visaTips + mcTips + (creditTips != null && amexTips + visaTips + mcTips === 0 ? creditTips : 0);
  const totalTips = matchMoney(tipBlock, [/Total\s+Tips?\s*[^\n$]{0,20}\$?\s*([0-9,]+\.[0-9]{2})/i]);
  if (cardFromParts > 0) {
    draft.cardTipsCents = cardFromParts;
  } else if (totalTips != null) {
    draft.cardTipsCents = Math.max(0, totalTips - (draft.cashTipsCents ?? 0));
  }

  if (totalTips != null && draft.cashTipsCents != null && draft.cardTipsCents != null) {
    const sum = draft.cashTipsCents + draft.cardTipsCents;
    if (Math.abs(sum - totalTips) > 1) {
      warnings.push("Tip Summary parts did not add to Total Tips; kept labeled Tip Summary lines.");
    }
  }

  // Prefer Tip Summary; ignore Credit Card Payments "Total Tips" which is often incomplete.
  const owes = matchMoney(compact, [/Merchant\s+Owes\s+Employee\s*[:=]?\s*\$?\s*([0-9,]+\.[0-9]{2})/i]);
  if (owes != null && draft.cardTipsCents == null && (draft.cashTipsCents ?? 0) === 0) {
    draft.cardTipsCents = owes;
  }

  const headcountStrict = compact.match(/\bHeadcount\s*[:=]?\s*([0-9]+)/i);
  if (headcountStrict) {
    const covers = Number(headcountStrict[1]);
    if (Number.isInteger(covers) && covers >= 0 && covers <= 5000) draft.customersServed = covers;
  }

  if (draft.foodSalesCents != null && draft.alcoholSalesCents != null && draft.salesCents != null) {
    const classSum = draft.foodSalesCents + draft.alcoholSalesCents;
    if (Math.abs(classSum - draft.salesCents) > 100) {
      warnings.push("Food + alcohol classes do not match Net/Gross Sales; kept labeled class lines and sales total.");
    }
  }

  const keys = Object.keys(draft);
  if (!keys.length) return { draft: null, warnings, confidence: "low" };
  const strong = ["salesCents", "cardTipsCents", "workedHours", "customersServed"].filter((key) => draft[key] != null).length;
  const confidence = strong >= 3 ? "high" : strong >= 2 ? "medium" : "low";
  return { draft, warnings, confidence };
}

/**
 * Merge model shiftDraft with labeled POS parse.
 * Labeled OCR fields always win for keys they matched; model-only keys (e.g. staffingCount)
 * are kept. Never wipe a whole model draft when the parser only matched a subset.
 */
export function mergeShiftDraftFromOcr(modelDraft, ocrText) {
  const parsed = parsePosEmployeeShiftReport(ocrText);
  const model = modelDraft && typeof modelDraft === "object" ? { ...modelDraft } : null;
  if (!parsed.draft) {
    return {
      draft: model && Object.keys(model).length ? model : null,
      warnings: parsed.warnings,
      source: model ? "model" : "none",
    };
  }

  const merged = { ...(model || {}) };
  for (const [key, value] of Object.entries(parsed.draft)) {
    if (value != null) merged[key] = value;
  }

  const hadModel = Boolean(model && Object.keys(model).length);
  let source = "pos-parser";
  if (hadModel && parsed.confidence === "low") source = "model+pos-parser";
  else if (hadModel) source = "pos-parser+model";

  return {
    draft: Object.keys(merged).length ? merged : null,
    warnings: parsed.warnings,
    source,
  };
}

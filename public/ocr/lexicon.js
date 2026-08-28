/* POS / thermal-receipt spelling repair. Mirror of toast_ocr.ocr.lexicon. */
(() => {
  const PHRASES = [
    "EMPLOYEE SHIFT REPORT",
    "EMPLOYEE ACTIVITY SUMMARY",
    "EMPLOYEE SHIFT SUMMARY",
    "EMPLOYEE PAYMENT TOTALS",
    "EMPLOYEE BANK SUMMARY",
    "GROSS SALES BY REVENUE CLASS",
    "NET SALES BY REVENUE CLASS",
    "GROSS SALES BY DEPARTMENT",
    "GIFT & NON-REVENUE DISCOUNT SUMMARY",
    "SALES DISCOUNT SUMMARY",
    "CREDIT CARD PAYMENTS",
    "TOTAL TIPS & TICKETS",
    "TOTAL GROSS SALES",
    "TOTAL NET SALES",
    "TOTAL SALES DISCOUNTS",
    "TOTALS PAYMENTS",
    "PAYMENT SUMMARY",
    "SALES SUMMARY",
    "TIP SUMMARY",
    "CASH SUMMARY",
    "BUSINESS TRENDS",
    "EMPLOYEE OWES MERCHANT",
    "CASH RECEIVED",
    "VOIDED PAYMENTS",
    "VOIDED ITEMS",
    "NO SALES",
    "REGULAR HOURS",
    "OVERTIME HOURS",
    "TOTAL PAID HOURS",
    "UNPAID BREAK",
    "TOTAL HOURS",
    "CLOSED TICKETS",
    "OPEN TICKETS",
    "AVG TICKET",
    "AVG HEAD",
    "GROSS SALES",
    "NET SALES",
    "CLOCK IN",
    "CLOCK OUT",
    "REPORT START",
    "REPORT END",
    "REPORT PRINTED",
    "PHYSICAL DRAWER",
    "CASH EXPECTED",
    "TILL COUNT",
  ];

  const WORDS = [
    "EMPLOYEE", "SHIFT", "REPORT", "ACTIVITY", "SUMMARY", "BUSINESS", "TRENDS",
    "HEADCOUNT", "TICKET", "TICKETS", "GROSS", "NET", "SALES", "REVENUE", "CLASS",
    "DEPARTMENT", "CREDIT", "CARD", "PAYMENTS", "PAYMENT", "TOTAL", "TOTALS",
    "TIPS", "TIP", "CASH", "EXCEPTIONS", "VOIDED", "ITEMS", "REFUNDS", "DISCOUNT",
    "DISCOUNTS", "MERCHANT", "OWES", "RECEIVED", "EXPECTED", "TESTING", "FOOD",
    "CLOCK", "HOURS", "OVERTIME", "REGULAR", "UNPAID", "BREAK", "PRINTED",
    "STILL", "CLOCKED", "DRAWER", "PHYSICAL", "BANK", "TENDER", "COUNT",
    "AVERAGE", "CLOSED", "OPEN",
  ];

  const TOKEN_FIXES = {
    BROSS: "GROSS",
    BROS: "GROSS",
    BRCES: "GROSS",
    REVEME: "REVENUE",
    REVEMUE: "REVENUE",
    FEVENUE: "REVENUE",
    SUMWRY: "SUMMARY",
    SINURY: "SUMMARY",
    SUNARY: "SUMMARY",
    SUNNARY: "SUMMARY",
    SUMARY: "SUMMARY",
    SUMNARY: "SUMMARY",
    SADLY: "SUMMARY",
    TIO: "TIP",
    EPLOYEE: "EMPLOYEE",
    EMPLOTEE: "EMPLOYEE",
    EMPOYEE: "EMPLOYEE",
    REPORI: "REPORT",
    REPORL: "REPORT",
    RECELVED: "RECEIVED",
    CASY: "CASH",
    PAYMEMT: "PAYMENT",
    PAYNENT: "PAYMENT",
    EXCAPTIONS: "EXCEPTIONS",
    EXCEPIIONS: "EXCEPTIONS",
    DISCOUMT: "DISCOUNT",
    DISCOUNI: "DISCOUNT",
    MERCHAMT: "MERCHANT",
    TOTAI: "TOTAL",
    TOTA: "TOTAL",
    OTA: "TOTAL",
  };

  function letters(s) {
    return String(s || "").toUpperCase().replace(/[^A-Z]/g, "");
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let prev = [];
    for (let j = 0; j <= b.length; j += 1) prev[j] = j;
    for (let i = 1; i <= a.length; i += 1) {
      const cur = [i];
      for (let j = 1; j <= b.length; j += 1) {
        const ins = cur[j - 1] + 1;
        const del = prev[j] + 1;
        const sub = prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
        cur[j] = Math.min(ins, del, sub);
      }
      prev = cur;
    }
    return prev[b.length];
  }

  function matchCase(original, replacement) {
    if (original === original.toUpperCase()) return replacement.toUpperCase();
    if (original === original.toLowerCase()) return replacement.toLowerCase();
    if (original[0] === original[0].toUpperCase()) {
      return replacement.charAt(0).toUpperCase() + replacement.slice(1).toLowerCase();
    }
    return replacement;
  }

  function bestPhrase(label) {
    const key = letters(label);
    if (key.length < 8) return null;
    let best = "";
    let bestDist = 1e9;
    for (const phrase of PHRASES) {
      const pkey = letters(phrase);
      if (Math.abs(key.length - pkey.length) > Math.max(8, Math.floor(pkey.length / 3))) continue;
      const dist = levenshtein(key, pkey);
      const limit = Math.max(3, Math.floor(pkey.length * 0.35));
      if (dist < bestDist && dist <= limit) {
        bestDist = dist;
        best = phrase;
      }
    }
    return best || null;
  }

  function fixToken(token) {
    if (!/[A-Za-z]/.test(token)) return token;
    const prefix = (token.match(/^[^A-Za-z]*/) || [""])[0];
    const suffix = (token.match(/[^A-Za-z]*$/) || [""])[0];
    const core = token.slice(prefix.length, token.length - suffix.length || token.length);
    if (!core) return token;
    const upper = core.toUpperCase();
    if (TOKEN_FIXES[upper]) {
      return prefix + matchCase(core, TOKEN_FIXES[upper]) + suffix;
    }
    if (upper.length < 4) return token;
    let best = upper;
    let bestDist = 1e9;
    for (const word of WORDS) {
      if (Math.abs(word.length - upper.length) > 2) continue;
      const dist = levenshtein(upper, word);
      if (dist < bestDist) {
        bestDist = dist;
        best = word;
      }
    }
    if (bestDist === 0) return token;
    if (bestDist <= 2 && bestDist / Math.max(best.length, 1) <= 0.4) {
      return prefix + matchCase(core, best) + suffix;
    }
    return token;
  }

  function splitLabelTail(line) {
    const m = String(line).match(/(\s*(?::\s*)?(?:\$\s*)?-?\d[\d,]*(?:\.\d{2})?(?:\s+[H%])?)\s*$/);
    if (m && m.index >= 4) return [line.slice(0, m.index), m[1]];
    const m2 = String(line).match(/(\s+\$\s*-?[\d,]+\.\d{2})\s*$/);
    if (m2) return [line.slice(0, m2.index), m2[1]];
    return [line, ""];
  }

  function correctLine(line) {
    const raw = String(line || "").replace(/\u00a0/g, " ").replace(/\s+$/g, "");
    if (!raw.trim()) return line;
    let cleaned = raw
      .replace(/\bota\]/gi, "Total")
      .replace(/\bTota\]/gi, "Total")
      .replace(/\bMo\s+Sales\b/gi, "No Sales")
      .replace(/\bTotal\s+Bet\s+Sales\b/gi, "Total Net Sales")
      .replace(/\bExp\s+oyes\b/gi, "Employee")
      .replace(/\bje\s+Received\b/gi, "Cash Received")
      .replace(/D\.\.\.venue/g, "Discount Revenue")
      .replace(/D\.\.\.verue/g, "Discount Revenue")
      .replace(/G\.\.\.e/g, "Gift/Non-Revenue");
    const [label, tail] = splitLabelTail(cleaned);
    const phrase = bestPhrase(label.trim() ? label : cleaned);
    if (phrase) {
      const colon = label.includes(":") && !phrase.includes(":") ? ":" : "";
      return tail ? `${phrase}${colon}${tail}` : `${phrase}${colon}`;
    }
    const source = tail ? label : cleaned;
    const rebuilt = source.replace(/[A-Za-z]+|\d+(?:\.\d+)?|\$|[^A-Za-z0-9$\s]+|\s+/g, (tok) => {
      if (!/[A-Za-z]/.test(tok) || /^\s+$/.test(tok)) return tok;
      return fixToken(tok);
    });
    return tail ? rebuilt + tail : rebuilt;
  }

  function correctText(text) {
    if (!text) return text;
    return String(text)
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .map(correctLine)
      .join("\n");
  }

  window.ToastLexicon = { correctLine, correctText };
})();

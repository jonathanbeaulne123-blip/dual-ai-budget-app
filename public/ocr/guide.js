/* Per-snippet guide: letters / numbers / format. Mirrors toast_ocr.guide. */
(() => {
  const KEY = "toast-ocr-guide-v1";
  const QUESTIONS = [
    { id: "letters", question: "Are the letters good?" },
    { id: "numbers", question: "Are the numbers good?" },
    { id: "format", question: "Is the format good?" },
  ];

  function loadMemory() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { letter_fixes: {}, samples: 0, votes: {} };
      const data = JSON.parse(raw);
      data.letter_fixes = data.letter_fixes || {};
      data.votes = data.votes || {};
      return data;
    } catch {
      return { letter_fixes: {}, samples: 0, votes: {} };
    }
  }

  function saveMemory(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      /* quota / private mode */
    }
  }

  function lettersOf(s) {
    return String(s || "").toUpperCase().replace(/[^A-Z]/g, "");
  }

  function alphaTokens(text) {
    return String(text || "").match(/[A-Za-z']+/g) || [];
  }

  function scoreLetters(text) {
    const tokens = alphaTokens(text).filter((t) => t.length >= 2);
    if (!tokens.length) return { score: 1, reasons: [] };
    const reasons = [];
    let good = 0;
    tokens.forEach((tok) => {
      const up = tok.toUpperCase();
      const mem = loadMemory().letter_fixes || {};
      if (mem[up]) good += 1;
      else if (["AM", "PM", "NO", "IN", "H", "BY", "TIP", "CASH"].includes(up)) good += 1;
      else {
        const vowels = (up.match(/[AEIOUY]/g) || []).length;
        if (up.length >= 4 && vowels >= 1 && vowels < up.length) good += 0.55;
      }
    });
    let ratio = good / Math.max(tokens.length, 1);
    const garbage = tokens.filter((t) => t.length <= 2 && !["AM", "PM", "NO", "IN", "H", "BY"].includes(t.toUpperCase())).length;
    if (garbage / tokens.length > 0.28) {
      reasons.push("Too many 1–2 letter fragments.");
      ratio *= 0.7;
    }
    if (ratio < 0.62) reasons.push("Letter shapes still look off (headers/words).");
    return { score: Math.min(1, ratio), reasons };
  }

  function scoreNumbers(text) {
    const reasons = [];
    if (!/\d/.test(text)) return { score: 1, reasons };
    if (/\d\s+[.,]\s*\d|\d[.,]\s+[A-Za-z]|\$\s*\d+\.\s*[A-Za-z]/.test(text)) {
      reasons.push("A dollar amount looks split or mixed with letters.");
      return { score: 0.25, reasons };
    }
    const money = text.match(/\$?\s*-?\d{1,6}[.,]\d{2}/g) || [];
    const dates = text.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/g) || [];
    const hours = text.match(/\d+(?:\.\d{1,2})?\s*H\b/gi) || [];
    const digits = text.match(/\d+(?:[.,]\d+)?/g) || [];
    if (!digits.length) return { score: 1, reasons };
    let ratio = (money.length + dates.length + hours.length) / digits.length;
    if (/[A-Za-z]\d|\d[A-Za-z]{2,}/.test(text)) {
      ratio *= 0.6;
      reasons.push("Digits are stuck to letters.");
    }
    if (ratio < 0.4) reasons.push("Counts and money are not lining up as $N.NN.");
    return { score: Math.min(1, ratio + 0.15 * Math.min(money.length, 3)), reasons };
  }

  function scoreFormat(text) {
    const lines = String(text || "").split(/\n/).map((ln) => ln.trim()).filter(Boolean);
    if (!lines.length) return { score: 1, reasons: [] };
    const reasons = [];
    const junkRe = /^[\s;:~}{@»|§£\-–—_.=*'"`\\/]+$/;
    const junk = lines.filter((ln) => junkRe.test(ln) || (ln.length <= 2 && /[;:~}{@»|§]/.test(ln))).length;
    const lone = lines.filter((ln) => ln.length === 1 && /[A-Za-z]/.test(ln)).length;
    let dups = 0;
    for (let i = 1; i < lines.length; i += 1) {
      if (lines[i].toUpperCase() === lines[i - 1].toUpperCase() && lines[i].length > 8) dups += 1;
    }
    let score = 1;
    if (junk / lines.length > 0.12) {
      score -= 0.4;
      reasons.push("Stray symbols where a receipt line should be.");
    }
    if (lone / lines.length > 0.12) {
      score -= 0.25;
      reasons.push("Single-letter lines (format broke).");
    }
    if (dups) {
      score -= 0.15;
      reasons.push("Repeated section headers.");
    }
    return { score: Math.max(0, Math.min(1, score)), reasons };
  }

  function scoreSnippet(text) {
    const L = scoreLetters(text);
    const N = scoreNumbers(text);
    const F = scoreFormat(text);
    return {
      letters_good: L.score >= 0.62,
      numbers_good: N.score >= 0.45,
      format_good: F.score >= 0.7,
      letter_score: L.score,
      number_score: N.score,
      format_score: F.score,
      reasons: [].concat(L.reasons, N.reasons, F.reasons),
    };
  }

  function repairLetters(text, extra) {
    const fixes = Object.assign({}, loadMemory().letter_fixes || {}, extra || {});
    const lines = String(text || "").split(/\n/).map((raw) => {
      let line = raw;
      Object.keys(fixes).forEach((src) => {
        if (!src) return;
        line = line.replace(new RegExp(`\\b${src.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), fixes[src]);
      });
      if (/^[A-Za-z]$/.test(line.trim()) && !["I", "A"].includes(line.trim().toUpperCase())) return null;
      return line;
    }).filter((ln) => ln !== null);
    const joined = lines.join("\n");
    return window.ToastLexicon && window.ToastLexicon.correctText
      ? window.ToastLexicon.correctText(joined)
      : joined;
  }

  function repairNumbers(text) {
    let t = String(text || "").replace(/[§£]/g, "$");
    t = t.replace(/\$\s+/g, "$");
    t = t.replace(/(\d)\s*[.,]\s*(\d{2})\b/g, "$1.$2");
    t = t.replace(/(\d)\s+\.\s*(\d)/g, "$1.$2");
    t = t.replace(/(\$\d+\.)\s*[A-Za-z]{1,3}\b/g, "$1");
    return t;
  }

  function repairFormat(text) {
    const junkRe = /^[\s;:~}{@»|§£\-–—_.=*'"`\\/[\]()]+$/;
    const floatRe = /^(?:\[(\d+)\]|(\d{1,4})|(\$\s*-?\d[\d,]*(?:\.\d{2})?))\s*$/;
    const out = [];
    String(text || "").split(/\n/).forEach((line) => {
      const stripped = line.trim();
      if (!stripped) {
        if (out.length && out[out.length - 1] !== "") out.push("");
        return;
      }
      if (junkRe.test(stripped) || [";", ":", "~", "-"].includes(stripped)) return;
      if (stripped.length === 1 && !/\d/.test(stripped)) return;
      const fm = stripped.match(floatRe);
      if (fm && out.length) {
        const prev = out[out.length - 1];
        if (!/\d/.test(prev.slice(-8))) {
          const piece = fm[1] || fm[2] || fm[3];
          out[out.length - 1] = `${prev} ${piece}`.trim();
          return;
        }
      }
      if (out.length && stripped.toUpperCase() === out[out.length - 1].toUpperCase() && stripped.length > 8) return;
      out.push(stripped);
    });
    return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  function lexicon(text) {
    return window.ToastLexicon && window.ToastLexicon.correctText
      ? window.ToastLexicon.correctText(text)
      : text;
  }

  function total(s) {
    return (s.letter_score || 0) + (s.number_score || 0) + (s.format_score || 0);
  }

  function improve(text) {
    let current = lexicon(text || "");
    const before = current;
    let last = scoreSnippet(current);
    for (let i = 0; i < 3; i += 1) {
      let nxt = current;
      if (!last.letters_good) nxt = repairLetters(nxt);
      if (!last.numbers_good) nxt = repairNumbers(nxt);
      if (!last.format_good) nxt = repairFormat(nxt);
      nxt = lexicon(nxt);
      const nxtScore = scoreSnippet(nxt);
      if (nxt === current || total(nxtScore) < total(last)) break;
      current = nxt;
      last = nxtScore;
    }
    if (last.letters_good && before !== current) {
      record({
        letters_good: true,
        numbers_good: null,
        format_good: null,
        before,
        after: current,
      });
    }
    return {
      text: current,
      guide: {
        letters_good: last.letters_good,
        numbers_good: last.numbers_good,
        format_good: last.format_good,
        letter_score: last.letter_score,
        number_score: last.number_score,
        format_score: last.format_score,
        reasons: last.reasons,
        prompts: QUESTIONS.map((q) => ({
          id: q.id,
          question: q.question,
          good: last[`${q.id}_good`],
        })),
      },
    };
  }

  function tokenPairs(before, after) {
    const b = (before.toUpperCase().match(/[A-Z]{3,}/g) || []);
    const a = (after.toUpperCase().match(/[A-Z]{3,}/g) || []);
    const fixes = {};
    const n = Math.min(b.length, a.length);
    for (let i = 0; i < n; i += 1) {
      if (b[i] !== a[i] && b[i].length <= 16 && a[i].length <= 16) fixes[b[i]] = a[i];
    }
    return fixes;
  }

  function record(opts) {
    const data = loadMemory();
    data.samples = (data.samples || 0) + 1;
    data.votes = data.votes || {};
    ["letters", "numbers", "format"].forEach((key) => {
      const val = opts[`${key}_good`];
      if (val === null || val === undefined) return;
      data.votes[key] = data.votes[key] || { good: 0, bad: 0 };
      data.votes[key][val ? "good" : "bad"] += 1;
    });
    if (opts.letters_good && opts.before && opts.after && opts.before !== opts.after) {
      data.letter_fixes = Object.assign(data.letter_fixes || {}, tokenPairs(opts.before, opts.after));
    }
    saveMemory(data);
    return data;
  }

  window.ToastGuide = {
    QUESTIONS,
    scoreSnippet,
    improve,
    record,
    loadMemory,
    repairLetters,
    repairNumbers,
    repairFormat,
  };
})();

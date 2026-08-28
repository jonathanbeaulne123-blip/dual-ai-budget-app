/* Per-snippet guide + scoring packet. Mirrors toast_ocr.guide. */
(() => {
  const KEY = "toast-ocr-guide-v2";
  const KEY_V1 = "toast-ocr-guide-v1";
  const SCHEMA = "toast-ocr-guide-packet.v2";
  const MAX_SNIPPETS = 80;
  const CATEGORIES = [
    ["letters", "Are the letters good?", 0.62],
    ["headers", "Are section headers good?", 0.55],
    ["garbage", "Is letter-fragment noise low?", 0.65],
    ["money", "Are dollar amounts good?", 0.5],
    ["dates", "Are dates good?", 0.5],
    ["times", "Are times good?", 0.5],
    ["counts", "Are counts good?", 0.45],
    ["hours", "Are hour figures good?", 0.5],
    ["punctuation", "Is punctuation good ($ : / %)?", 0.6],
    ["columns", "Are labels and amounts on the same line?", 0.55],
    ["stray_symbols", "Is the line free of junk symbols?", 0.7],
    ["duplicates", "Are section headers listed once?", 0.7],
    ["completeness", "Are words complete (not cut off)?", 0.6],
    ["format", "Is the format good?", 0.7],
  ];
  const QUESTIONS = CATEGORIES.map((row) => ({ id: row[0], question: row[1], floor: row[2] }));
  const PRIMARY = ["letters", "money", "format"];

  function emptyMem() {
    return { letter_fixes: {}, samples: 0, votes: {}, snippets: [] };
  }

  function loadMemory() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const data = JSON.parse(raw);
        return Object.assign(emptyMem(), data);
      }
      const v1 = localStorage.getItem(KEY_V1);
      if (v1) {
        const old = JSON.parse(v1);
        const migrated = Object.assign(emptyMem(), { letter_fixes: old.letter_fixes || {}, votes: old.votes || {}, samples: old.samples || 0 });
        saveMemory(migrated);
        return migrated;
      }
    } catch {
      /* ignore */
    }
    return emptyMem();
  }

  function saveMemory(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      /* quota */
    }
  }

  function cat(id, score, reasons, evidence, applicable) {
    const meta = QUESTIONS.find((q) => q.id === id) || { question: id, floor: 0.5 };
    const clamped = Math.max(0, Math.min(1, score));
    const appl = applicable !== false;
    return {
      id,
      question: meta.question,
      score: clamped,
      confidence: Math.round(clamped * 100),
      good: appl ? clamped >= meta.floor : true,
      applicable: appl,
      reasons: reasons || [],
      evidence: evidence || {},
    };
  }

  function alphaTokens(text) {
    return String(text || "").match(/[A-Za-z']+/g) || [];
  }

  function linesOf(text) {
    return String(text || "").split(/\n/).map((ln) => ln.trim()).filter(Boolean);
  }

  function scoreAll(text) {
    const tokens = alphaTokens(text).filter((t) => t.length >= 2);
    const lines = linesOf(text);
    const mem = loadMemory().letter_fixes || {};
    const moneyRe = /\$\s*-?\d{1,6}[.,]\d{2}|-?\d{1,6}[.,]\d{2}/g;
    const brokenRe = /\d\s+[.,]\s*\d|\d[.,]\s+[A-Za-z]|\$\s*\d+\.\s*[A-Za-z]/;
    const dateRe = /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g;
    const timeRe = /\b\d{1,2}:\d{2}\s*(?:AM|PM)\b/gi;
    const hoursRe = /\b\d+(?:\.\d{1,2})?\s*H\b/gi;
    const junkLine = /^[\s;:~}{@»|§£\-–—_.=*'"`\\/]+$/;

    let letterGood = 0;
    tokens.forEach((tok) => {
      const up = tok.toUpperCase();
      if (mem[up]) letterGood += 1;
      else if (["AM", "PM", "NO", "IN", "H", "BY", "TIP", "CASH"].includes(up)) letterGood += 1;
      else {
        const vowels = (up.match(/[AEIOUY]/g) || []).length;
        if (up.length >= 4 && vowels >= 1 && vowels < up.length) letterGood += 0.55;
      }
    });
    const letterScore = tokens.length ? letterGood / tokens.length : 1;
    const letters = cat("letters", letterScore, letterScore < 0.62 ? ["Letter shapes still look off (headers/words)."] : [], { tokens: tokens.length }, tokens.length > 0);

    const headerish = lines.filter((ln) => ln === ln.toUpperCase() && ln.length >= 8);
    const headers = headerish.length
      ? cat("headers", headerish.filter((ln) => /SHIFT|SALES|SUMMARY|PAYMENT|TIP|EXCEPT|BANK|TREND|REVENUE|DISCOUNT|CLOCK|HOURS/.test(ln)).length / headerish.length, [], { header_lines: headerish.length })
      : cat("headers", 1, [], {}, false);

    const okShort = ["AM", "PM", "NO", "IN", "H", "BY", "A", "I"];
    const allTok = alphaTokens(text);
    const frag = allTok.filter((t) => t.length <= 2 && !okShort.includes(t.toUpperCase())).length;
    const garbage = allTok.length >= 4
      ? cat("garbage", 1 - frag / allTok.length, frag / allTok.length > 0.35 ? ["Too many 1–2 letter fragments."] : [], { fragments: frag })
      : cat("garbage", 1, [], {}, false);

    const moneyHits = text.match(moneyRe) || [];
    const broken = brokenRe.test(text);
    let moneyScore = 1;
    let moneyApp = true;
    if (!/\d/.test(text) || (!moneyHits.length && !broken)) {
      moneyApp = /\d/.test(text) && broken;
      if (!moneyHits.length && !broken) moneyApp = false;
    }
    if (broken) moneyScore = moneyHits.length ? 0.3 : 0.2;
    else if (moneyHits.length) moneyScore = 1;
    else moneyScore = 1;
    const money = cat("money", moneyScore, broken ? ["Dollar amounts look split or mixed with letters."] : [], { amounts: moneyHits.length }, moneyApp || moneyHits.length > 0 || broken);

    const dates = text.match(dateRe) || [];
    const datesC = dates.length ? cat("dates", 1, [], { dates: dates.slice(0, 8) }) : cat("dates", 1, [], {}, false);
    const times = text.match(timeRe) || [];
    const bareTime = text.match(/\b\d{1,2}:\d{2}\b/g) || [];
    const timesC = (times.length || bareTime.length)
      ? cat("times", times.length ? 1 : 0.45, times.length ? [] : ["Times are missing AM/PM or are garbled."], { times: times.slice(0, 8) })
      : cat("times", 1, [], {}, false);

    const labeled = lines.filter((ln) => /\b(Count|Tickets|Items|Sales|Tips|Payments)\b/i.test(ln));
    const counts = labeled.length
      ? cat("counts", labeled.filter((ln) => /\b\d{1,4}\b/.test(ln)).length / labeled.length, [], { lines: labeled.length })
      : cat("counts", 1, [], {}, false);

    const hourRows = /\bHours?\b/i.test(text);
    const hourTok = text.match(hoursRe) || [];
    const hours = hourRows
      ? cat("hours", hourTok.length ? 1 : 0.3, hourTok.length ? [] : ["Hour rows are missing N.NN H."], { hour_tokens: hourTok.slice(0, 8) })
      : cat("hours", 1, [], {}, false);

    const weird = (text.match(/[§£»{@~|]/g) || []).length;
    let punc = 1;
    const pReasons = [];
    if (/[§£]/.test(text)) {
      punc -= 0.35;
      pReasons.push("§ or £ where $ belongs.");
    }
    if (weird) punc -= Math.min(0.4, 0.08 * weird);
    const punctuation = cat("punctuation", punc, pReasons, { weird, dollars: (text.match(/\$/g) || []).length });

    const moneyLines = lines.filter((ln) => moneyRe.test(ln) || /\b\d{1,4}\b/.test(ln));
    const paired = moneyLines.filter((ln) => /[A-Za-z]{3,}/.test(ln)).length;
    const columns = moneyLines.length >= 1
      ? cat("columns", paired / moneyLines.length, paired / moneyLines.length < 0.55 ? ["Amounts sit on their own line instead of next to the label."] : [], { money_lines: moneyLines.length, paired })
      : cat("columns", 1, [], {}, false);

    const junk = lines.filter((ln) => junkLine.test(ln) || (ln.length <= 2 && /[;:~}{@»|§]/.test(ln))).length;
    const stray = lines.length
      ? cat("stray_symbols", 1 - junk / lines.length, junk / lines.length > 0.3 ? ["Stray symbols where a receipt line should be."] : [], { junk_lines: junk })
      : cat("stray_symbols", 1, [], {}, false);

    let dups = 0;
    for (let i = 1; i < lines.length; i += 1) {
      if (lines[i].toUpperCase() === lines[i - 1].toUpperCase() && lines[i].length > 8) dups += 1;
    }
    const duplicates = cat("duplicates", dups ? Math.max(0.2, 1 - 0.2 * dups) : 1, dups ? ["Repeated section headers."] : [], { duplicate_pairs: dups });

    const trunc = text.match(/\b[A-Za-z]\.{2,}[A-Za-z]/g) || [];
    const ell = (text.match(/\.{3}|…/g) || []).length;
    const completeness = cat("completeness", (!trunc.length && !ell) ? 1 : Math.max(0.2, 1 - 0.2 * (trunc.length + ell)), trunc.length || ell ? ["Words look truncated (D...venue style)."] : [], { truncated: trunc.slice(0, 8) });

    const lone = lines.filter((ln) => ln.length === 1 && /[A-Za-z]/.test(ln)).length;
    let fmt = 1;
    const fReasons = [];
    if (lines.length && lone / lines.length > 0.12) {
      fmt -= 0.25;
      fReasons.push("Single-letter lines (format broke).");
    }
    if (junk) fmt -= Math.min(0.4, 0.1 * junk);
    const format = cat("format", fmt, fReasons, { lines: lines.length, lone_letters: lone });

    const categories = [letters, headers, garbage, money, datesC, timesC, counts, hours, punctuation, columns, stray, duplicates, completeness, format];
    const applicable = categories.filter((c) => c.applicable);
    const overall = applicable.length ? applicable.reduce((s, c) => s + c.score, 0) / applicable.length : 1;
    const numParts = [money, datesC, timesC, counts, hours].filter((c) => c.applicable);
    const number_score = numParts.length ? numParts.reduce((s, c) => s + c.score, 0) / numParts.length : 1;
    return {
      letters_good: letters.good,
      numbers_good: number_score >= 0.45,
      format_good: format.good && stray.good,
      letter_score: letters.score,
      number_score,
      format_score: (format.score + stray.score) / 2,
      overall,
      confidence: Math.round(overall * 100),
      text_confidence: Math.round(overall * 100),
      engine_confidence: 0,
      reasons: categories.flatMap((c) => c.reasons),
      categories,
    };
  }

  function withConfidence(scored, engine01) {
    const textC = Math.round((Number(scored.overall) || 0) * 100);
    const eng = Math.max(0, Math.min(1, Number(engine01) || 0));
    const engC = Math.round(eng * 100);
    scored.text_confidence = textC;
    scored.engine_confidence = engC;
    scored.confidence = engC ? Math.round(0.65 * textC + 0.35 * engC) : textC;
    (scored.categories || []).forEach((c) => {
      c.confidence = Math.round((Number(c.score) || 0) * 100);
    });
    return scored;
  }

  function scoreSnippet(text) {
    return scoreAll(text);
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

  function improve(text, meta) {
    let current = lexicon(text || "");
    const before = current;
    let last = scoreAll(current);
    for (let i = 0; i < 3; i += 1) {
      let nxt = current;
      if (!last.letters_good) nxt = repairLetters(nxt);
      if (!last.numbers_good) nxt = repairNumbers(nxt);
      if (!last.format_good) nxt = repairFormat(nxt);
      nxt = lexicon(nxt);
      const nxtScore = scoreAll(nxt);
      if (nxt === current || nxtScore.overall < last.overall) break;
      current = nxt;
      last = nxtScore;
    }
    last = withConfidence(last, meta && meta.engine_confidence);
    const guide = Object.assign({}, last, {
      prompts: last.categories.map((c) => ({
        id: c.id,
        question: c.question,
        good: c.good,
        applicable: c.applicable,
        score: Math.round(c.score * 1000) / 1000,
        confidence: c.confidence,
      })),
    });
    appendSnippet({
      raw_text: before,
      text: current,
      scores: last,
      cut_reason: (meta && meta.cut_reason) || "",
      slice_index: meta && typeof meta.slice_index === "number" ? meta.slice_index : null,
      votes: {},
    });
    if (last.letters_good && before !== current) {
      record({ letters_good: true, before, after: current, scores: last });
    }
    return { text: current, guide };
  }

  function tokenPairs(before, after) {
    const b = (String(before).toUpperCase().match(/[A-Z]{3,}/g) || []);
    const a = (String(after).toUpperCase().match(/[A-Z]{3,}/g) || []);
    const fixes = {};
    const n = Math.min(b.length, a.length);
    for (let i = 0; i < n; i += 1) {
      if (b[i] !== a[i] && b[i].length <= 16 && a[i].length <= 16) fixes[b[i]] = a[i];
    }
    return fixes;
  }

  function appendSnippet(snip) {
    const data = loadMemory();
    data.snippets = data.snippets || [];
    data.snippets.push({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      ts: new Date().toISOString(),
      slice_index: snip.slice_index,
      cut_reason: snip.cut_reason || "",
      raw_text: String(snip.raw_text || "").slice(0, 8000),
      text: String(snip.text || "").slice(0, 8000),
      scores: snip.scores || {},
      votes: snip.votes || {},
    });
    data.snippets = data.snippets.slice(-MAX_SNIPPETS);
    saveMemory(data);
  }

  function record(opts) {
    const data = loadMemory();
    data.samples = (data.samples || 0) + 1;
    data.votes = data.votes || {};
    const voteMap = Object.assign({}, opts.votes || {});
    ["letters", "numbers", "format"].forEach((key) => {
      if (opts[`${key}_good`] !== null && opts[`${key}_good`] !== undefined) voteMap[key] = opts[`${key}_good`];
    });
    if (opts.axis && typeof opts.good === "boolean") voteMap[opts.axis] = opts.good;
    Object.keys(voteMap).forEach((key) => {
      const val = voteMap[key];
      if (val === null || val === undefined) return;
      data.votes[key] = data.votes[key] || { good: 0, bad: 0 };
      data.votes[key][val ? "good" : "bad"] += 1;
    });
    if (voteMap.letters && opts.before && opts.after && opts.before !== opts.after) {
      data.letter_fixes = Object.assign(data.letter_fixes || {}, tokenPairs(opts.before, opts.after));
    }
    const snippets = data.snippets || [];
    const last = snippets[snippets.length - 1];
    if (last && (last.text === opts.after || last.raw_text === opts.before)) {
      last.votes = Object.assign({}, last.votes || {}, voteMap);
      if (opts.scores) last.scores = opts.scores;
    }
    saveMemory(data);
    pushSharedSoon();
    return data;
  }

  function interpret(data) {
    const mem = data || loadMemory();
    const sums = {};
    (mem.snippets || []).forEach((snip) => {
      const cats = (snip.scores && snip.scores.categories) || [];
      cats.forEach((c) => {
        if (!c || c.applicable === false) return;
        sums[c.id] = sums[c.id] || [];
        sums[c.id].push(Number(c.score) || 0);
      });
    });
    const averages = {};
    Object.keys(sums).forEach((k) => {
      averages[k] = Math.round((sums[k].reduce((a, b) => a + b, 0) / sums[k].length) * 1000) / 1000;
    });
    const names = {};
    QUESTIONS.forEach((q) => { names[q.id] = q.question; });
    const weakest = Object.keys(averages).sort((a, b) => averages[a] - averages[b]).slice(0, 6)
      .map((id) => ({ id, score: averages[id], question: names[id] || id }));
    const voteLines = Object.keys(mem.votes || {}).map((k) => {
      const b = mem.votes[k] || {};
      return `${k}: ${b.good || 0} yes / ${b.bad || 0} no`;
    });
    const weakTxt = weakest.map((w) => `${w.question} ${w.score.toFixed(2)}`).join(", ") || "none yet";
    const summary = [
      `${mem.samples || 0} guide samples stored.`,
      `${Object.keys(mem.letter_fixes || {}).length} learned letter maps.`,
      `Weakest categories: ${weakTxt}.`,
      voteLines.length ? `Votes — ${voteLines.slice(0, 12).join("; ")}.` : "",
    ].filter(Boolean).join(" ");
    return {
      averages,
      weakest,
      summary,
      snippet_count: (mem.snippets || []).length,
      learned_fix_count: Object.keys(mem.letter_fixes || {}).length,
    };
  }

  function buildPacket() {
    const mem = loadMemory();
    return {
      schema: SCHEMA,
      exported_at: new Date().toISOString(),
      product: "toast-ocr-pipeline",
      href: String(location.href || ""),
      categories: QUESTIONS.map((q) => ({ id: q.id, question: q.question, floor: q.floor })),
      memory: {
        letter_fixes: mem.letter_fixes || {},
        votes: mem.votes || {},
        samples: mem.samples || 0,
      },
      snippets: (mem.snippets || []).slice(-MAX_SNIPPETS),
      interpretation: interpret(mem),
      for_agent: {
        skill: "ocr-packet-teach",
        instruction: "Merge proposed_token_fixes into TOKEN_FIXES in src/toast_ocr/ocr/lexicon.py and src/toast_ocr/web/static/lexicon.js. Keep Python and JS in sync. Never invent dollar amounts or dates. Do not change Hearth /documents/scan. Run pytest tests/test_lexicon.py tests/test_guide.py tests/test_learn.py.",
        proposed_token_fixes: mem.letter_fixes || {},
        weakest: interpret(mem).weakest,
        summary: interpret(mem).summary,
        do_not: ["invent money or dates", "call paid OCR APIs", "delete or replace Hearth", "edit /documents/scan Confirm path"],
        files: ["src/toast_ocr/ocr/lexicon.py", "src/toast_ocr/web/static/lexicon.js"],
      },
    };
  }

  function exportPacket() {
    const packet = buildPacket();
    const blob = new Blob([JSON.stringify(packet, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `toast-ocr-score-packet-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
    return packet;
  }

  function learnEndpoint() {
    const base = (document.documentElement.dataset.base || "").replace(/\/$/, "");
    const engine = document.documentElement.dataset.engine || "server";
    return engine === "browser" ? `${base}/learn` : `${base}/api/learn`;
  }

  function deviceId() {
    const key = "toast-ocr-device";
    try {
      let id = localStorage.getItem(key);
      if (!id) {
        id = (crypto.randomUUID && crypto.randomUUID()) || `d-${Date.now()}`;
        localStorage.setItem(key, id);
      }
      return id;
    } catch {
      return "anon";
    }
  }

  function ingestBrain(brain) {
    if (!brain || typeof brain !== "object") return loadMemory();
    const data = loadMemory();
    const hive = brain.letter_fixes || {};
    data.letter_fixes = Object.assign({}, data.letter_fixes || {}, hive);
    saveMemory(data);
    if (window.ToastLexicon && typeof window.ToastLexicon.addFixes === "function") {
      window.ToastLexicon.addFixes(data.letter_fixes);
    }
    return data;
  }

  async function syncShared() {
    try {
      const res = await fetch(learnEndpoint(), { method: "GET" });
      if (!res.ok) return null;
      const brain = await res.json();
      ingestBrain(brain);
      return brain;
    } catch {
      return null;
    }
  }

  let pushTimer = 0;
  function pushSharedSoon() {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      pushShared().catch(() => undefined);
    }, 800);
  }

  async function pushShared() {
    const mem = loadMemory();
    const body = {
      schema: "toast-ocr-learn.v1",
      letter_fixes: mem.letter_fixes || {},
      votes: mem.votes || {},
      samples: mem.samples || 0,
      device_id: deviceId(),
      interpretation: interpret(mem),
    };
    const res = await fetch(learnEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const brain = await res.json();
    ingestBrain(brain);
    return brain;
  }

  async function copyForAgent() {
    await syncShared();
    const packet = buildPacket();
    const text =
      "Apply this OCR learn packet using skill ocr-packet-teach.\n\n" + JSON.stringify(packet, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      exportPacket();
      return false;
    }
  }

  window.ToastGuide = {
    QUESTIONS,
    PRIMARY,
    CATEGORIES,
    scoreSnippet,
    improve,
    record,
    loadMemory,
    repairLetters,
    repairNumbers,
    repairFormat,
    interpret,
    buildPacket,
    exportPacket,
    copyForAgent,
    syncShared,
    pushShared,
    ingestBrain,
    withConfidence,
  };
})();

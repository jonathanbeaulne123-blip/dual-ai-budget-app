/** Pure evaluator shared by browser automation and exported physical-device trials. */
export const LEDGER_BUDGETS = Object.freeze({ paint: 16, ack: 120, partner: 250, coldOpen: 500 });

export function percentiles(values) {
  if (!values.length || values.some(x => !Number.isFinite(x) || x < 0)) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return Object.fromEntries([['p50', .5], ['p95', .95], ['p99', .99], ['max', 1]]
    .map(([key, fraction]) => [key, sorted[Math.ceil(sorted.length * fraction) - 1]]));
}

/** Offsets are device-minus-cloud. Never require receiver paint to follow sender ACK. */
export function correctedTime(at, calibration) {
  const { before, after } = calibration ?? {};
  if (![before, after].every(x => x && [x.at, x.offsetMs, x.uncertaintyMs].every(Number.isFinite)
    && x.uncertaintyMs >= 0 && x.uncertaintyMs <= 50)
    || Math.abs(after.offsetMs - before.offsetMs) > 100
    || !Number.isFinite(at) || after.at <= before.at || at < before.at || at > after.at) throw new Error('INVALID_CALIBRATION');
  const fraction = (at - before.at) / (after.at - before.at);
  return { at: at - (before.offsetMs + fraction * (after.offsetMs - before.offsetMs)),
    uncertainty: Math.max(before.uncertaintyMs, after.uncertaintyMs) };
}

export function evaluateLedgerTrial(trial) {
  const failures = [], samples = trial.samples ?? [], wanted = trial.requestedSamples;
  if (trial.errors?.length) failures.push(...trial.errors);
  const metrics = { paint: [], ack: [], saved: [], partner: [], partnerUpper: [], bytes: [] };
  const ids = new Set();
  if (!Number.isInteger(wanted) || wanted < 100) failures.push('At least 100 requested samples are required.');
  if (samples.length !== wanted) failures.push('Missing samples.');
  if (!Number.isInteger(trial.transactionCount) || trial.transactionCount < 5000) failures.push('The baseline must contain at least 5000 transactions.');
  if (!trial.release || !trial.url || !['warm', 'cold'].includes(trial.condition)) failures.push('Missing release, URL or trial condition.');
  const participants = trial.participants ?? [];
  if (participants.length !== 2 || new Set(participants.map(p=>p.id)).size !== 2
    || new Set(participants.map(p=>p.memberHash)).size !== 2 || new Set(participants.map(p=>p.subjectHash)).size !== 2
    || participants.some(p=>![p.memberHash,p.subjectHash].every(value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value))))
    failures.push('Two distinct authenticated member identities are required.');
  for (const sample of samples) {
    try {
      if (!sample.id || ids.has(sample.id)) throw new Error('DUPLICATE_COMMAND_SAMPLE');
      ids.add(sample.id);
      if (sample.author === sample.partner) throw new Error('SAME_DEVICE');
      if (![sample.author,sample.partner].every(id=>participants.some(p=>p.id===id))) throw new Error('UNKNOWN_PARTICIPANT');
      if (!Number.isFinite(sample.confirmAt)) throw new Error('MISSING_CONFIRM');
      const duration = at => Number.isFinite(at) ? at - sample.confirmAt : NaN;
      const values = { paint: duration(sample.authorPaintAt), ack: duration(sample.ackAt),
        saved: duration(sample.savedPaintAt), bytes: sample.bytes };
      // Retain measured ACKs even when the UI never paints. Missing metrics
      // still fail; they must not erase the diagnostic timings that did exist.
      for (const [key, value] of Object.entries(values)) {
        if (Number.isFinite(value) && value >= 0) metrics[key].push(value);
        else failures.push(`Missing or invalid ${key} measurement.`);
      }
      if (Number.isFinite(sample.savedPaintAt) && sample.savedPaintAt < sample.ackAt) failures.push('SAVED_BEFORE_ACK');
      if (sample.visibleRowMatches !== 1 || sample.receiptMatches !== 1) failures.push('ROW_OR_RECEIPT_IDENTITY');
      const source = correctedTime(sample.confirmAt, trial.clocks?.[sample.author]);
      const receiver = correctedTime(sample.partnerPaintAt, trial.clocks?.[sample.partner]);
      const partner = receiver.at - source.at;
      if (partner < 0) throw new Error('INVALID_PARTNER_TIMING');
      metrics.partner.push(partner);
      metrics.partnerUpper.push(partner + receiver.uncertainty + source.uncertainty);
    } catch (error) { failures.push(error.message); }
  }
  const summary = Object.fromEntries(Object.entries(metrics).map(([key, values]) => [key, percentiles(values)]));
  for (const key of ['paint', 'ack', 'partner']) {
    const metric = summary[key === 'partner' ? 'partnerUpper' : key];
    const percentile = key === 'partner' ? 'p95' : 'max';
    if (!metric || metric[percentile] > LEDGER_BUDGETS[key]) failures.push(`${key} ${percentile} budget missed.`);
  }
  if (!summary.saved || summary.saved.max > LEDGER_BUDGETS.ack) failures.push("Saved paint max budget missed.");
  const coldOpen = percentiles(trial.coldOpenMs ?? []);
  if (!coldOpen || coldOpen.max > LEDGER_BUDGETS.coldOpen) failures.push('Cold-open interactive budget missed or unmeasured.');
  for (const key of ['conflictDialogs', 'lostOperations', 'duplicatedOperations', 'privacyLeaks']) {
    if (trial[key] !== 0) failures.push(`${key} must be explicitly measured as zero.`);
  }
  try {
    if (trial.concurrentCommandIds?.length !== 2 || new Set(trial.concurrentCommandIds).size !== 2) throw new Error();
    const pair = trial.concurrentCommandIds.map(id=>samples.find(s=>s.id===id));
    if (pair.some(s=>!s) || pair[0].author===pair[1].author) throw new Error();
    const times = pair.map(s=>correctedTime(s.confirmAt,trial.clocks?.[s.author]));
    if (Math.abs(times[0].at-times[1].at)+times[0].uncertainty+times[1].uncertainty>200) throw new Error();
  } catch { failures.push('No valid simultaneous-Confirm trial.'); }
  return { pass: failures.length === 0, sampleCount: samples.length, measuredSamples: Object.fromEntries(Object.entries(metrics).map(([key, values]) => [key, values.length])), metrics: summary, coldOpen,
    failures: [...new Set(failures)],
    evidenceClass: trial.evidenceClass ?? 'unspecified',
    // A manually supplied label cannot establish physical network provenance.
    g4: 'Requires independently recorded physical Toronto LTE conditions, warm and cold trials.' };
}

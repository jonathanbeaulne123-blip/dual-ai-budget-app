// Every free-mode caller shares the Google project's durable quota authority.
export const FLASH_LITE_MODEL = 'gemini-3.1-flash-lite';
export const FLASH_MODEL = 'gemini-3.8-flash';
export const freeGeminiOnly = env => env.HERCULES_GEMINI_FREE_ONLY === 'true';
export function conversationModel(text, thorough = false) {
  return thorough || text.length > 1200 || /\b(research|compare|analy[sz]e|itinerary|spreadsheet|presentation|study plan|teach me|step.by.step|think (?:hard|carefully)|complex)\b/i.test(text)
    ? FLASH_MODEL : FLASH_LITE_MODEL;
}
export async function requestDigest(value) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(b => b.toString(16).padStart(2, '0')).join('');
}
export function pacificDay(now) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));
}
export function nextPacificDay(now) {
  // Search the actual civil-day transition, including both DST changes.
  const day = pacificDay(now); let low = now, high = now + 26 * 60 * 60 * 1000;
  while (high - low > 1) { const middle = Math.floor((low + high) / 2); if (pacificDay(middle) === day) low = middle; else high = middle; }
  return high;
}
export function readFreeQuotaConfig(env, now = Date.now()) {
  let config; try { config = JSON.parse(env.HERCULES_GEMINI_FREE_QUOTAS || ''); } catch { throw Error('GEMINI_FREE_CONFIGURATION_REQUIRED'); }
  if (config.version !== 1 || config.tier !== 'free' || config.exclusive !== true || !/^[a-z][a-z0-9-]{5,62}$/.test(config.projectId || '')
    || !/^[a-f0-9]{64}$/.test(config.keySha256 || '') || !Number.isFinite(Date.parse(config.verifiedAt))
    || Date.parse(config.verifiedAt) > now || Date.parse(config.expiresAt) <= now || !Number.isFinite(Date.parse(config.expiresAt))
    || Date.parse(config.expiresAt) - Date.parse(config.verifiedAt) > 31 * 86400000) throw Error('GEMINI_FREE_CONFIGURATION_REQUIRED');
  for (const model of [FLASH_LITE_MODEL, FLASH_MODEL]) {
    const limits = config.models?.[model];
    if (!limits || !['rpm', 'tpm', 'rpd'].every(k => Number.isSafeInteger(limits[k]) && limits[k] > 0)
      || !Number.isSafeInteger(limits.usedOnVerificationDay) || limits.usedOnVerificationDay < 0) throw Error('GEMINI_FREE_CONFIGURATION_REQUIRED');
  }
  return config;
}
export function quotaDecision(config, model, tokens, recent, dailyCount, now = Date.now()) {
  const limits = [FLASH_LITE_MODEL, FLASH_MODEL].includes(model) ? config.models[model] : null;
  if (!limits || !Number.isSafeInteger(tokens) || tokens < 0) return { ok: false, code: 'GEMINI_FREE_INVALID_REQUEST' };
  const seed = pacificDay(now) === pacificDay(Date.parse(config.verifiedAt)) ? limits.usedOnVerificationDay : 0;
  if (dailyCount + seed + 1 > Math.floor(limits.rpd * 0.8)) return { ok: false, code: 'GEMINI_FREE_DAILY_LIMIT', retryAt: nextPacificDay(now) };
  const minute = recent.filter(r => r.at > now - 65000);
  if (minute.length + 1 > Math.floor(limits.rpm * 0.8) || minute.reduce((sum, r) => sum + r.tokens, 0) + tokens > Math.floor(limits.tpm * 0.8))
    return { ok: false, code: 'GEMINI_FREE_MINUTE_LIMIT', retryAt: (minute[0]?.at ?? now) + 65000 };
  return { ok: true };
}
export async function generateFreeGemini(env, model, body, reserveRun, identity = String(crypto.randomUUID())) {
  const config = readFreeQuotaConfig(env);
  if (!freeGeminiOnly(env) || !env.HERCULES_GEMINI_FREE_KEY || !env.HERCULES_GEMINI_QUOTA || ![FLASH_LITE_MODEL, FLASH_MODEL].includes(model)) throw Error('GEMINI_FREE_CONFIGURATION_REQUIRED');
  if (await requestDigest(env.HERCULES_GEMINI_FREE_KEY) !== config.keySha256) throw Error('GEMINI_FREE_KEY_CHANGED');
  const serialized = JSON.stringify(body);
  if (serialized.length > 20_000_000) throw Error('GEMINI_FREE_INPUT_LIMIT');
  const quota = env.HERCULES_GEMINI_QUOTA.get(env.HERCULES_GEMINI_QUOTA.idFromName(config.projectId));
  const digest = await requestDigest(serialized);
  const logicalId = await requestDigest(identity);
  const started = await quota.begin(logicalId);
  if (!started.ok) throw Error(started.code);
  const attemptId = await requestDigest(logicalId + ':' + started.attempt);
  const admit = async (phase, tokens) => {
    const receipt = await quota.reserve({ id: attemptId + ':' + phase, model, tokens, digest });
    if (!receipt.ok) throw Error(receipt.code + (receipt.retryAt ? ':' + new Date(receipt.retryAt).toISOString() : ''));
  };
  const send = async (method, payload) => {
    // Native fetch makes exactly one HTTP attempt: no SDK/provider retry or fallback.
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:${method}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.HERCULES_GEMINI_FREE_KEY },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(60000), redirect: 'error',
    });
    if (response.status === 429) { await quota.pauseUntilReset(); throw Error('GEMINI_FREE_PROVIDER_LIMIT'); }
    if (!response.ok) throw Error('GEMINI_FREE_PROVIDER_UNAVAILABLE');
    return response.json();
  };
  // CountTokens itself consumes an admission. Debit both HTTP requests against
  // RPM/RPD conservatively; only generation consumes the input-token allowance.
  try {
  await admit('count', 0);
  const counted = await send('countTokens', { generateContentRequest: { ...body, model: 'models/' + model } });
  if (!Number.isSafeInteger(counted.totalTokens) || counted.totalTokens < 0) throw Error('TOKEN_COUNT_UNAVAILABLE');
  await admit('generate', Math.ceil(counted.totalTokens * 1.05) + 64);
  if (reserveRun) await reserveRun(counted.totalTokens, body.generationConfig.maxOutputTokens);
  return await send('generateContent', body);
  } catch (error) {
    // A retry receives a new, fully accounted attempt. An active duplicate is
    // excluded; failed or uncertain HTTP attempts retain their quota debits.
    await quota.release(logicalId, started.attempt);
    throw error;
  }
}

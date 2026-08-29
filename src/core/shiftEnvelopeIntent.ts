const KEY = "hearth:shift-envelope-intent";

export function requestShiftEnvelope(envelopeId: string, storage: Storage = sessionStorage): void {
  if (!/^[A-Za-z0-9._:-]{1,180}$/.test(envelopeId)) return;
  storage.setItem(KEY, envelopeId);
}

export function takeShiftEnvelopeIntent(storage: Storage = sessionStorage): string | null {
  const value = storage.getItem(KEY);
  storage.removeItem(KEY);
  return value && /^[A-Za-z0-9._:-]{1,180}$/.test(value) ? value : null;
}

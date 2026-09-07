/** Row-level projections. Authoritative events only; never client write admission. */
export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json };
export type ProjectionPatch = {
  set: Record<string, Json>;
  unset: string[];
  rows: Record<string, { put: Record<string, Json>[]; remove: string[] }>;
};
export function canonical(value: unknown): string {
  if (value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  if (typeof value === "number" && !Number.isFinite(value))
    throw new Error("INVALID_NUMBER");
  return JSON.stringify(value);
}
function keyed(value: unknown): value is Record<string, Json>[] {
  return (
    Array.isArray(value) &&
    value.every(
      (r) =>
        r &&
        typeof r === "object" &&
        !Array.isArray(r) &&
        typeof r.id === "string",
    ) &&
    new Set(value.map((r) => r.id)).size === value.length
  );
}
export function difference(before: object, after: object): ProjectionPatch {
  const a = before as Record<string, Json>,
    b = after as Record<string, Json>;
  const patch: ProjectionPatch = { set: {}, unset: [], rows: {} };
  for (const field of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const old = a[field],
      next = b[field];
    if (canonical(old) === canonical(next)) continue;
    if (next === undefined) {
      patch.unset.push(field);
      continue;
    }
    if (keyed(old) && keyed(next)) {
      const previous = new Map(old.map((r) => [String(r.id), r]));
      const ids = new Set(next.map((r) => String(r.id)));
      patch.rows[field] = {
        put: next.filter(
          (r) => canonical(previous.get(String(r.id))) !== canonical(r),
        ),
        remove: old
          .filter((r) => !ids.has(String(r.id)))
          .map((r) => String(r.id)),
      };
    } else patch.set[field] = next;
  }
  return patch;
}
export function project<T extends object>(
  before: T,
  patch: ProjectionPatch,
): T {
  const next = { ...before } as Record<string, unknown>;
  for (const key of patch.unset) delete next[key];
  for (const [key, value] of Object.entries(patch.set)) {
    if (["__proto__", "prototype", "constructor"].includes(key))
      throw new Error("INVALID_PATCH");
    next[key] = value;
  }
  for (const [key, delta] of Object.entries(patch.rows)) {
    if (!keyed(next[key])) throw new Error("PROJECTION_GAP");
    const rows = new Map(next[key].map((row) => [String(row.id), row]));
    for (const id of delta.remove) rows.delete(id);
    for (const row of delta.put) rows.set(String(row.id), row);
    next[key] = [...rows.values()];
  }
  return next as T;
}
export async function digest(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonical(value));
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}

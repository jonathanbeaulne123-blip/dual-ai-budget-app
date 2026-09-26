/**
 * A Loft route's bank request: `bank/<id>`, `bank/<id>/studio`, or `studio` (the first bank, on its studio page).
 * K12 (Tool Atlas §7): the Pottery Studio merged into each Kitty Bank's studio tab; the Kiln stays a world place.
 */
export function bankRoomRequest(object: string | undefined): { bankId?: string; studio: boolean } {
  if (!object) return { studio: false };
  if (object === "studio") return { studio: true };
  if (!object.startsWith("bank/")) return { studio: false };
  const rest = object.slice(5), studio = rest.endsWith("/studio");
  const bankId = studio ? rest.slice(0, -7) : rest;
  return bankId ? { bankId, studio } : { studio };
}

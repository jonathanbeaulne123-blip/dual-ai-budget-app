export type PersonalFolioKind = "wish" | "experience" | "note" | "memory";
export type PersonalFolioObject = Readonly<{ kind: PersonalFolioKind; id: string }>;

const KINDS = new Set<PersonalFolioKind>(["wish", "experience", "note", "memory"]);

/** Decodes only the private folio object forms. Other house objects remain owned by their rooms. */
export function personalFolioObject(value: string | undefined): PersonalFolioObject | null {
  if (!value) return null;
  const [kind, id, extra] = value.split("/");
  if (extra !== undefined || !kind || !id || !KINDS.has(kind as PersonalFolioKind) || id.length > 160 || /[\u0000-\u001f]/.test(id)) return null;
  return { kind: kind as PersonalFolioKind, id };
}

export const personalFolioObjectPath = (kind: PersonalFolioKind, id: string) => `${kind}/${id}`;

/** Preserves the original unaddressed folio key while isolating every addressed private page. */
export function personalFolioDraftObject(identity: string, object: PersonalFolioObject | null): string {
  return object ? `object:${personalFolioObjectPath(object.kind, object.id)}` : `folio:${identity}`;
}

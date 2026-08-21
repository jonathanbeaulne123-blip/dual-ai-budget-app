/** Hosted books live in project tykhocwacaxwquhynkok (us-east-1). */

export const PROJECT_REF = "tykhocwacaxwquhynkok";
export const POOLER_HOST = "aws-0-us-east-1.pooler.supabase.com";
export const DIRECT_HOST = `db.${PROJECT_REF}.supabase.co`;
export const SQL_EDITOR = `https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new`;

export function decodePassword(raw) {
  if (!raw) return "";
  try {
    return decodeURIComponent(String(raw));
  } catch {
    return String(raw);
  }
}

export function isPlaceholderPassword(password) {
  const normalized = decodePassword(password)
    .trim()
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .replace(/[_\s]+/g, "-")
    .toLowerCase();
  return !normalized || normalized === "your-password";
}

export function placeholderError() {
  return [
    "The Connect URI still has [YOUR-PASSWORD] — that is the dashboard placeholder, not the database password.",
    "Replace it with the password after postgres: in Connect → Session pooler (or Direct connection).",
    "The database name is postgres. The dashboard URI sometimes shows postgresz; that is a typo.",
    `db.${PROJECT_REF}.supabase.co is IPv6-only; this environment has no IPv6, so apply uses the IPv4 session pooler on port 5432.`,
    `Fastest path with no password: paste supabase/migrations/001_hearth_books.sql into ${SQL_EDITOR} and Run.`,
  ].join(" ");
}

/**
 * Build the URI this agent can actually open.
 * Direct `db.*.supabase.co` has no A record. Session pooler is IPv4 :5432.
 */
export function resolveApplyUrl(env = process.env) {
  const fromUrl = String(env.DATABASE_URL || env.POSTGRES_URL || "").trim();
  let password = String(env.SUPABASE_DB_PASSWORD || "").trim();
  if (fromUrl) {
    let parsed;
    try {
      parsed = new URL(fromUrl);
    } catch {
      throw new Error("DATABASE_URL is not a valid postgres URI.");
    }
    const fromUri = decodePassword(parsed.password);
    if (fromUri) password = fromUri;
  }
  if (isPlaceholderPassword(password)) {
    throw new Error(placeholderError());
  }
  return `postgresql://postgres.${PROJECT_REF}:${encodeURIComponent(password)}@${POOLER_HOST}:5432/postgres`;
}

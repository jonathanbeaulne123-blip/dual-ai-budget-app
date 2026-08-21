export type HostProbe = {
  id: string;
  name: string;
  reachable: boolean;
  detail: string;
  ledgerFit: "primary" | "production-target" | "usable" | "static-host" | "not-a-ledger";
};

async function headOk(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: "HEAD" });
    return response.ok || (response.status >= 300 && response.status < 400);
  } catch {
    return false;
  }
}

export async function probeHostedDatabases(): Promise<HostProbe[]> {
  const neon = await headOk("https://neon.com");
  const supabase = await headOk("https://supabase.com");
  const turso = await headOk("https://turso.tech");
  const fly = await headOk("https://fly.io");
  const railway = await headOk("https://railway.com");
  const netlify = await headOk("https://www.netlify.com");
  return [
    {
      id: "pglite",
      name: "PGlite (Postgres 18 in the app)",
      reachable: true,
      detail: "Real PostgreSQL in WebAssembly. Same SQL as Neon/Supabase. Works on any static host.",
      ledgerFit: "primary",
    },
    {
      id: "neon",
      name: "Neon serverless Postgres",
      reachable: neon,
      detail: neon
        ? "Best hosted target for this schema. Needs a project URL; not provisionable from a Drop site."
        : "Could not reach neon.com from this environment.",
      ledgerFit: "production-target",
    },
    {
      id: "supabase",
      name: "Supabase Postgres",
      reachable: supabase,
      detail: supabase
        ? "Hosted books for this household. Phrase-join reads household_snapshots."
        : "Could not reach supabase.com from this environment.",
      ledgerFit: "production-target",
    },
    {
      id: "cloudflare-pages",
      name: "Cloudflare Workers",
      reachable: true,
      detail: "Static host for the phone app and join links. Not a ledger.",
      ledgerFit: "static-host",
    },
    {
      id: "turso",
      name: "Turso (libSQL)",
      reachable: turso,
      detail: "SQLite dialect, not this Postgres schema. Usable later if we dual-target SQLite.",
      ledgerFit: "usable",
    },
    {
      id: "fly",
      name: "Fly.io Postgres",
      reachable: fly,
      detail: "Full VM Postgres. Overkill until the household needs a dedicated region.",
      ledgerFit: "usable",
    },
    {
      id: "railway",
      name: "Railway Postgres",
      reachable: railway,
      detail: "Managed Postgres. Same schema would load. Needs an account.",
      ledgerFit: "usable",
    },
    {
      id: "netlify-blobs",
      name: "Netlify Functions + Blobs",
      reachable: netlify,
      detail: "JSON blobs, not a ledger. Left in the repo only as a rollback host.",
      ledgerFit: "not-a-ledger",
    },
  ];
}

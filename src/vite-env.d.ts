/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_SUPABASE_LIVE?: string;
  readonly VITE_SUPABASE_AUTH_ENABLED?: string;
  readonly VITE_CONTINUITY_REALTIME?: string;
  readonly VITE_CONTINUITY_COMMAND_LOG?: string;
  readonly VITE_CLOUD_LEDGER_ONLINE_REQUIRED?: string;
  /** Temporary compatibility fallback for older local Development env files. */
  readonly VITE_SHARED_ONLINE_REQUIRED?: string;
  readonly VITE_PRODUCTION_CONTINUITY?: string;
  readonly VITE_SYNC_PILOT_DIAGNOSTICS?: string;
  readonly VITE_HERCULES_PRO_URL?: string;
  readonly VITE_PLAN_SYSTEM_V2?: string;
  readonly VITE_HOUSEHOLD_HOME_V2?: string;
  readonly VITE_QUEENS_NEST?: string;
  readonly VITE_CELLAR_V3?: string;
  /** Plan Studio v3 (D-274): opt-in; anything but "1"/"true" keeps the current studio. */
  readonly VITE_PLAN_STUDIO_V3?: string;
  readonly VITE_FUND_STANDING_BOOK?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  /** Money model release N+1 (D-269): stamps commands with fundModelVersion 2 and runs the migration. Default off. */
  readonly VITE_FUND_MODEL_V2?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "node:sqlite" {
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): { get: (...params: unknown[]) => unknown; all: (...params: unknown[]) => Array<Record<string, unknown>> };
    close(): void;
  }
}

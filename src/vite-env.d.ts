/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_SUPABASE_LIVE?: string;
  readonly VITE_SUPABASE_AUTH_ENABLED?: string;
  readonly VITE_CONTINUITY_REALTIME?: string;
  readonly VITE_CONTINUITY_COMMAND_LOG?: string;
  readonly VITE_ONBOARDING_FOUNDATION?: string;
  readonly VITE_HERCULES_PRO_URL?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "node:sqlite" {
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): { get: () => unknown };
    close(): void;
  }
}

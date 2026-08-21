/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HEARTH_API?: string;
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

interface ImportMetaEnv {
  readonly VITE_HEARTH_API?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

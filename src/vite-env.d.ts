/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HEARTH_API?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

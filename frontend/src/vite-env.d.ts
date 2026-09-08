/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Local-dev fallback API base URL, used when /config.json is not available. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

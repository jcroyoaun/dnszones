/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DOH_CLOUDFLARE_ENDPOINT: string;
  readonly VITE_DOH_GOOGLE_ENDPOINT: string;
  readonly VITE_DNS_TIMEOUT: string;
  readonly VITE_RATE_LIMIT_MAX_QUERIES: string;
  readonly VITE_RATE_LIMIT_WINDOW_MS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /**
   * Base URL of the isolated redirect resolver service. When unset, online
   * link expansion is cleanly unavailable and the app behaves exactly offline.
   */
  readonly VITE_RESOLVER_URL?: string;
}

interface Window {
  __QRRRGH_TEST_NOW_MS__?: number;
}

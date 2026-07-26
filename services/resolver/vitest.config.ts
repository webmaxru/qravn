import { defineConfig } from "vitest/config";

// The resolver's tests spin up loopback HTTP servers only. There is never any
// real outbound network traffic, so CI stays hermetic and offline-safe.
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    testTimeout: 15_000,
    hookTimeout: 15_000,
    reporters: "default",
    env: {
      LOG_LEVEL: "silent",
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts"],
    },
  },
});

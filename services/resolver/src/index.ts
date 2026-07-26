/**
 * Service entrypoint: load config, start the HTTP server, and shut down cleanly
 * on SIGTERM/SIGINT (Container Apps sends SIGTERM on scale-in).
 */

import { loadConfig } from "./config.js";
import { RESOLVER_ID } from "./constants.js";
import { log } from "./logger.js";
import { RateLimiter } from "./rateLimit.js";
import { createServer } from "./server.js";

const config = loadConfig();
const rateLimiter = new RateLimiter(config.rateLimitWindowMs, config.rateLimitMax);

// Periodically drop expired rate-limit windows so memory stays bounded.
const sweepTimer = setInterval(() => rateLimiter.sweep(), 60_000);
sweepTimer.unref();

const server = createServer({ config, rateLimiter });

server.listen(config.port, config.host, () => {
  log.info("listening", {
    resolver: RESOLVER_ID,
    host: config.host,
    port: config.port,
    corsOrigins: config.corsAllowedOrigins.size,
  });
  if (config.devAllowLoopback) {
    log.warn("dev_allow_loopback_enabled", {
      note: "loopback SSRF targets are permitted; DO NOT enable in production",
      extraPorts: [...config.extraAllowedPorts],
    });
  }
});

function shutdown(signal: string): void {
  log.info("shutting_down", { signal });
  clearInterval(sweepTimer);
  server.close(() => process.exit(0));
  // Force-exit if connections do not drain promptly.
  setTimeout(() => process.exit(0), 5_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

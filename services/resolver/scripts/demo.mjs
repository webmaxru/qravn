/**
 * End-to-end demo. Starts a local origin server with a small redirect chain,
 * boots the built resolver (dist/index.js) with the DEV loopback allowance so it
 * can reach that local server, then POSTs /v1/resolve and prints the JSON.
 *
 * Run:  npm run build && node scripts/demo.mjs
 * This talks only to loopback; it never touches the public internet.
 */

import http from "node:http";
import net from "node:net";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

function reservePort() {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function startOrigin() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const path = (req.url ?? "/").split("?")[0];
      if (path === "/start") {
        res.writeHead(302, { Location: "/second" });
        res.end();
      } else if (path === "/second") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end('<html><head><meta http-equiv="refresh" content="0; url=/final"></head></html>');
      } else if (path === "/final") {
        res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
        res.end("you have arrived");
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

async function waitForHealth(port, attempts = 50) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/healthz`);
      if (res.ok) return await res.json();
    } catch {
      /* not up yet */
    }
    await sleep(100);
  }
  throw new Error("resolver did not become healthy");
}

async function main() {
  const origin = await startOrigin();
  const RESOLVER_PORT = await reservePort();
  const child = spawn(process.execPath, ["dist/index.js"], {
    env: {
      ...process.env,
      // The dev loopback bypass only takes effect outside production; set this
      // explicitly so the demo is deterministic regardless of the ambient env.
      NODE_ENV: "development",
      PORT: String(RESOLVER_PORT),
      DEV_ALLOW_LOOPBACK: "1",
      DEV_EXTRA_ALLOWED_PORTS: String(origin.port),
      LOG_LEVEL: "info",
    },
    stdio: "inherit",
  });

  try {
    const health = await waitForHealth(RESOLVER_PORT);
    console.log("\n/healthz ->", JSON.stringify(health));

    const target = `http://127.0.0.1:${origin.port}/start`;
    const res = await fetch(`http://127.0.0.1:${RESOLVER_PORT}/v1/resolve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: target }),
    });
    const body = await res.json();
    console.log(`\nPOST /v1/resolve  (HTTP ${res.status})  target=${target}`);
    console.log(JSON.stringify(body, null, 2));
  } finally {
    child.kill();
    origin.server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

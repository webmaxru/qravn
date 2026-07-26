/**
 * Container HEALTHCHECK helper. Performs a local GET /healthz and exits 0 when
 * the service answers 200, non-zero otherwise. Uses only the loopback interface
 * and Node built-ins, so it satisfies the "healthz must not touch the network"
 * invariant and needs no extra tooling in the (distroless) final image.
 */

import http from "node:http";

const port = Number(process.env.PORT ?? 8080);

const req = http.get(
  { host: "127.0.0.1", port, path: "/healthz", timeout: 2_000 },
  (res) => {
    res.resume();
    process.exit(res.statusCode === 200 ? 0 : 1);
  },
);

req.on("error", () => process.exit(1));
req.on("timeout", () => {
  req.destroy();
  process.exit(1);
});

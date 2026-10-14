// Synthetic transport only: control plane is container-loopback, never proxied.
import { createServer } from "node:http";
let mode = "up";
let lastRequest;
const api = createServer((req, res) => {
  lastRequest = { path: req.url, forwardedFor: req.headers["x-forwarded-for"], forwardedProto: req.headers["x-forwarded-proto"] };
  if (mode === "stall") return;
  if (new URL(req.url, "http://fixture").pathname !== "/api/v1/system/status") return res.writeHead(404).end();
  res.setHeader("Content-Type", "application/json");
  res.writeHead(mode === "up" ? 200 : 503).end(JSON.stringify(mode === "up"
    ? { service: "synthetic-api", version: "0.2.0", status: "UP" }
    : { detail: "synthetic-private-error" }));
});
api.listen(8080, "0.0.0.0");
const control = createServer((req, res) => {
  const next = req.url.slice(1);
  if (req.method === "POST" && ["up", "down", "stall", "refused"].includes(next)) {
    if (next === "refused") { api.closeAllConnections(); api.close(); }
    else if (mode === "refused") api.listen(8080, "0.0.0.0");
    mode = next;
    res.writeHead(204).end();
  } else if (req.url === "/last-request") {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(lastRequest ?? {}));
  } else res.writeHead(404).end();
});
control.listen(8081, "127.0.0.1");
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => {
  api.closeAllConnections(); api.close(); control.close(() => process.exit(0));
});

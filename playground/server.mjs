import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { spawn } from "node:child_process";
import { WebSocketServer } from "ws";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const PORT = process.env.PORT || 3777;

// ── Static file server ──────────────────────────────────────────────

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

const server = createServer((req, res) => {
  const url = req.url === "/" ? "/index.html" : req.url;

  // Prevent path traversal
  if (url.includes("..")) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  const filePath = join(__dirname, "public", url);
  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not Found");
    return;
  }

  const ext = extname(filePath);
  res.writeHead(200, { "Content-Type": MIME[ext] || "text/plain" });
  res.end(readFileSync(filePath));
});

// ── WebSocket terminal I/O ──────────────────────────────────────────

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  let proc = null;

  function killProc() {
    if (proc) {
      try {
        proc.kill("SIGTERM");
      } catch {
        // already dead
      }
      proc = null;
    }
  }

  function send(obj) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(obj));
    }
  }

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === "run") {
      // Kill any existing process
      killProc();

      // Write the example code to a temp file
      const tmpFile = join(__dirname, ".tmp-example.tsx");
      writeFileSync(tmpFile, msg.code, "utf-8");

      const cols = String(msg.cols || 120);
      const rows = String(msg.rows || 40);

      // Spawn directly with STORM_FORCE_TTY=1 so Storm renders
      // alt-screen, colors, and cursor positioning even without a real PTY.
      // xterm.js in the browser interprets the escape sequences.
      proc = spawn("npx", ["tsx", tmpFile], {
        cwd: PROJECT_ROOT,
        env: {
          ...process.env,
          TERM: "xterm-256color",
          COLUMNS: cols,
          ROWS: rows,
          FORCE_COLOR: "3",
          NODE_ENV: "production",
          STORM_FORCE_TTY: "1",
        },
        stdio: ["pipe", "pipe", "pipe"],
      });

      proc.stdout.on("data", (d) => {
        send({ type: "output", data: d.toString("base64") });
      });

      proc.stderr.on("data", (d) => {
        send({ type: "output", data: Buffer.from(d).toString("base64") });
      });

      proc.on("exit", (code) => {
        send({ type: "exit", code });
        proc = null;
      });

      proc.on("error", (err) => {
        send({ type: "error", message: err.message });
        proc = null;
      });
    }

    if (msg.type === "input" && proc && !proc.killed) {
      try {
        proc.stdin.write(Buffer.from(msg.data, "base64"));
      } catch {
        // stdin may be closed
      }
    }

    if (msg.type === "resize" && proc && !proc.killed) {
      // Without a real PTY, we can't send SIGWINCH.
      // The process uses COLUMNS/ROWS from its initial environment.
    }

    if (msg.type === "stop") {
      killProc();
      send({ type: "exit", code: null });
    }
  });

  ws.on("close", () => {
    killProc();
  });

  ws.on("error", () => {
    killProc();
  });
});

// ── Start ───────────────────────────────────────────────────────────

function tryListen(port, maxRetries = 5) {
  server.listen(port, () => {
    console.log(`\n  Storm Playground`);
    console.log(`  http://localhost:${port}\n`);
  });
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE" && maxRetries > 0) {
      console.log(`  Port ${port} in use, trying ${port + 1}...`);
      server.removeAllListeners("error");
      tryListen(port + 1, maxRetries - 1);
    } else {
      console.error(`  Failed to start: ${err.message}`);
      process.exit(1);
    }
  });
}
tryListen(Number(PORT));

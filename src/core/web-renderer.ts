import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import { createHash } from "node:crypto";
import type { Socket } from "node:net";
import { ScreenBuffer, WIDE_CHAR_PLACEHOLDER } from "./buffer.js";
import { DEFAULT_COLOR, Attr, isRgbColor, rgbR, rgbG, rgbB } from "./types.js";

const ANSI_256_PALETTE: string[] = buildAnsi256Palette();

function buildAnsi256Palette(): string[] {
  const palette: string[] = new Array(256);

  // Standard 16 colors (0-15)
  const base16 = [
    "#000000", "#aa0000", "#00aa00", "#aa5500",
    "#0000aa", "#aa00aa", "#00aaaa", "#aaaaaa",
    "#555555", "#ff5555", "#55ff55", "#ffff55",
    "#5555ff", "#ff55ff", "#55ffff", "#ffffff",
  ];
  for (let i = 0; i < 16; i++) palette[i] = base16[i]!;

  // 216-color cube (16-231): 6x6x6 RGB cube
  for (let i = 0; i < 216; i++) {
    const r = Math.floor(i / 36);
    const g = Math.floor((i % 36) / 6);
    const b = i % 6;
    const toHex = (v: number) => (v === 0 ? 0 : 55 + v * 40);
    const rr = toHex(r).toString(16).padStart(2, "0");
    const gg = toHex(g).toString(16).padStart(2, "0");
    const bb = toHex(b).toString(16).padStart(2, "0");
    palette[16 + i] = `#${rr}${gg}${bb}`;
  }

  // Grayscale ramp (232-255): 24 shades
  for (let i = 0; i < 24; i++) {
    const v = (8 + i * 10).toString(16).padStart(2, "0");
    palette[232 + i] = `#${v}${v}${v}`;
  }

  return palette;
}

function colorToCSS(c: number): string | null {
  if (c === DEFAULT_COLOR) return null;
  if (isRgbColor(c)) return `#${rgbR(c).toString(16).padStart(2, "0")}${rgbG(c).toString(16).padStart(2, "0")}${rgbB(c).toString(16).padStart(2, "0")}`;
  if (c >= 0 && c < 256) return ANSI_256_PALETTE[c]!;
  return null;
}

const WS_MAGIC = "258EAFA5-E914-47DA-95CA-5AB9064DC5BB";

/** Compute the Sec-WebSocket-Accept header value. */
function wsAcceptKey(clientKey: string): string {
  return createHash("sha1").update(clientKey + WS_MAGIC).digest("base64");
}

/** RFC 6455 opcodes. */
const enum WsOpcode {
  CONTINUATION = 0x0,
  TEXT = 0x1,
  BINARY = 0x2,
  CLOSE = 0x8,
  PING = 0x9,
  PONG = 0xa,
}

/**
 * Encode a WebSocket frame (server → client).
 * Server frames are never masked per RFC 6455.
 */
function encodeFrame(opcode: number, payload: Buffer): Buffer {
  const len = payload.length;
  let headerLen: number;
  if (len < 126) {
    headerLen = 2;
  } else if (len < 65536) {
    headerLen = 4;
  } else {
    headerLen = 10;
  }

  const frame = Buffer.alloc(headerLen + len);
  frame[0] = 0x80 | opcode; // FIN + opcode

  if (len < 126) {
    frame[1] = len;
  } else if (len < 65536) {
    frame[1] = 126;
    frame.writeUInt16BE(len, 2);
  } else {
    frame[1] = 127;
    frame.writeUInt32BE(0, 2);
    frame.writeUInt32BE(len, 6);
  }

  payload.copy(frame, headerLen);
  return frame;
}

/**
 * Decode an incoming WebSocket frame.
 * Returns null if the buffer is incomplete.
 */
interface DecodedFrame {
  opcode: number;
  payload: Buffer;
  totalLength: number; // bytes consumed from the input buffer
}

function decodeFrame(data: Buffer): DecodedFrame | null {
  if (data.length < 2) return null;

  const opcode = data[0]! & 0x0f;
  const masked = (data[1]! & 0x80) !== 0;
  let payloadLen = data[1]! & 0x7f;
  let offset = 2;

  if (payloadLen === 126) {
    if (data.length < 4) return null;
    payloadLen = data.readUInt16BE(2);
    offset = 4;
  } else if (payloadLen === 127) {
    if (data.length < 10) return null;
    payloadLen = data.readUInt32BE(6);
    offset = 10;
  }

  const maskLen = masked ? 4 : 0;
  const totalLength = offset + maskLen + payloadLen;
  if (data.length < totalLength) return null;

  const payload = Buffer.alloc(payloadLen);
  if (masked) {
    const maskKey = data.subarray(offset, offset + 4);
    const payloadStart = offset + 4;
    for (let i = 0; i < payloadLen; i++) {
      payload[i] = data[payloadStart + i]! ^ maskKey[i % 4]!;
    }
  } else {
    data.copy(payload, 0, offset, offset + payloadLen);
  }

  return { opcode, payload, totalLength };
}

interface WsClient {
  socket: Socket;
  /** Accumulation buffer for incomplete frames. */
  recvBuffer: Buffer;
  /** Previous frame snapshot for diffing. null = send full frame next. */
  prevSnapshot: CellSnapshot[] | null;
  /** Previous buffer dimensions. */
  prevWidth: number;
  prevHeight: number;
  alive: boolean;
}

/** Compact cell representation for diffing. */
interface CellSnapshot {
  char: string;
  fg: number;
  bg: number;
  attrs: number;
}

//
// Messages are JSON for simplicity and debuggability.
//
// Full frame:
//   { type: "full", width, height, cursorX, cursorY, cells: [[char, fg, bg, attrs], ...] }
//
// Diff frame:
//   { type: "diff", width, height, cursorX, cursorY, changes: [[index, char, fg, bg, attrs], ...] }
//
// Resize (dimensions changed → send full):
//   Same as full frame.

export interface WebRendererOptions {
  /** HTTP port (default 3000). */
  port?: number;
  /** Bind host (default "localhost"). */
  host?: string;
  /** Browser page title (default "Storm TUI"). */
  title?: string;
}

export class WebRenderer {
  private readonly port: number;
  private readonly host: string;
  private readonly title: string;
  private server: Server | null = null;
  private clients: Set<WsClient> = new Set();
  private started = false;

  constructor(options?: WebRendererOptions) {
    this.port = options?.port ?? 3000;
    this.host = options?.host ?? "localhost";
    this.title = options?.title ?? "Storm TUI";
  }

  /** Number of connected browser clients. */
  get clientCount(): number {
    return this.clients.size;
  }

  /** Start the HTTP + WebSocket server. */
  start(): Promise<void> {
    if (this.started) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const server = createServer((req: IncomingMessage, res: ServerResponse) => {
        this.handleHttp(req, res);
      });

      server.on("upgrade", (req: IncomingMessage, socket: Socket, head: Buffer) => {
        this.handleUpgrade(req, socket, head);
      });

      server.on("error", (err) => {
        if (!this.started) reject(err);
      });

      server.listen(this.port, this.host, () => {
        this.started = true;
        this.server = server;
        resolve();
      });
    });
  }

  /** Stop the server and disconnect all clients. */
  stop(): void {
    if (!this.server) return;
    this.started = false;

    for (const client of this.clients) {
      this.sendClose(client);
      client.socket.destroy();
    }
    this.clients.clear();

    this.server.close();
    this.server = null;
  }

  /** Send a frame to all connected browsers. */
  sendFrame(buffer: ScreenBuffer, cursorX: number, cursorY: number): void {
    if (this.clients.size === 0) return;

    const w = buffer.width;
    const h = buffer.height;
    const size = w * h;

    // Snapshot the buffer once — shared across all clients for diffing
    const snapshot: CellSnapshot[] = new Array(size);
    for (let i = 0; i < size; i++) {
      const x = i % w;
      const y = Math.floor(i / w);
      snapshot[i] = {
        char: buffer.getChar(x, y),
        fg: buffer.getFg(x, y),
        bg: buffer.getBg(x, y),
        attrs: buffer.getAttrs(x, y),
      };
    }

    for (const client of this.clients) {
      if (!client.alive) continue;

      const needsFull = !client.prevSnapshot
        || client.prevWidth !== w
        || client.prevHeight !== h;

      let message: string;

      if (needsFull) {
        // Full frame: send every cell as a flat array
        // Format: [char, fgCSS, bgCSS, attrBitmask, ...]
        const cells: (string | number | null)[] = [];
        for (let i = 0; i < size; i++) {
          const s = snapshot[i]!;
          cells.push(
            s.char === WIDE_CHAR_PLACEHOLDER ? "" : s.char,
            colorToCSS(s.fg),
            colorToCSS(s.bg),
            s.attrs,
          );
        }
        message = JSON.stringify({
          type: "full",
          width: w,
          height: h,
          cursorX,
          cursorY,
          cells,
        });
      } else {
        // Diff frame: only changed cells
        const changes: (string | number | null)[] = [];
        const prev = client.prevSnapshot!;
        for (let i = 0; i < size; i++) {
          const s = snapshot[i]!;
          const p = prev[i];
          if (!p || s.char !== p.char || s.fg !== p.fg || s.bg !== p.bg || s.attrs !== p.attrs) {
            changes.push(
              i,
              s.char === WIDE_CHAR_PLACEHOLDER ? "" : s.char,
              colorToCSS(s.fg),
              colorToCSS(s.bg),
              s.attrs,
            );
          }
        }

        if (changes.length === 0) {
          // Only cursor may have moved
          message = JSON.stringify({
            type: "cursor",
            cursorX,
            cursorY,
          });
        } else {
          message = JSON.stringify({
            type: "diff",
            width: w,
            height: h,
            cursorX,
            cursorY,
            changes,
          });
        }
      }

      client.prevSnapshot = snapshot;
      client.prevWidth = w;
      client.prevHeight = h;

      this.sendText(client, message);
    }
  }

  // ── HTTP handler ────────────────────────────────────────────────

  private handleHttp(_req: IncomingMessage, res: ServerResponse): void {
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache",
    });
    res.end(this.buildHtmlPage());
  }

  // ── WebSocket upgrade (RFC 6455 handshake) ─────────────────────

  private handleUpgrade(req: IncomingMessage, socket: Socket, head: Buffer): void {
    const key = req.headers["sec-websocket-key"];
    if (!key) {
      socket.destroy();
      return;
    }

    const accept = wsAcceptKey(key);
    const responseHeaders = [
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Accept: ${accept}`,
      "",
      "",
    ].join("\r\n");

    socket.write(responseHeaders);

    const client: WsClient = {
      socket,
      recvBuffer: Buffer.alloc(0),
      prevSnapshot: null,
      prevWidth: 0,
      prevHeight: 0,
      alive: true,
    };

    if (head.length > 0) {
      client.recvBuffer = head;
      this.processIncoming(client);
    }

    socket.on("data", (data: Buffer) => {
      client.recvBuffer = Buffer.concat([client.recvBuffer, data]);
      this.processIncoming(client);
    });

    socket.on("close", () => {
      client.alive = false;
      this.clients.delete(client);
    });

    socket.on("error", () => {
      client.alive = false;
      this.clients.delete(client);
    });

    this.clients.add(client);
  }

  // ── WebSocket frame I/O ────────────────────────────────────────

  private processIncoming(client: WsClient): void {
    while (client.recvBuffer.length > 0) {
      const frame = decodeFrame(client.recvBuffer);
      if (!frame) break;

      client.recvBuffer = client.recvBuffer.subarray(frame.totalLength);

      switch (frame.opcode) {
        case WsOpcode.PING:
          this.sendPong(client, frame.payload);
          break;
        case WsOpcode.PONG:
          break;
        case WsOpcode.CLOSE:
          this.sendClose(client);
          client.socket.end();
          client.alive = false;
          this.clients.delete(client);
          break;
        case WsOpcode.TEXT:
          // Client messages (keyboard/mouse events) — reserved for future use
          break;
      }
    }
  }

  private sendText(client: WsClient, text: string): void {
    if (!client.alive) return;
    try {
      const payload = Buffer.from(text, "utf-8");
      client.socket.write(encodeFrame(WsOpcode.TEXT, payload));
    } catch {
      client.alive = false;
      this.clients.delete(client);
    }
  }

  private sendPong(client: WsClient, payload: Buffer): void {
    if (!client.alive) return;
    try {
      client.socket.write(encodeFrame(WsOpcode.PONG, payload));
    } catch {
      client.alive = false;
      this.clients.delete(client);
    }
  }

  private sendClose(client: WsClient): void {
    try {
      client.socket.write(encodeFrame(WsOpcode.CLOSE, Buffer.alloc(0)));
    } catch {
      // Socket may already be dead
    }
  }

  // ── Self-contained HTML page ──────────────────────────────────

  private buildHtmlPage(): string {
    const title = this.title.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  html,body{
    height:100%;
    background:#0d1117;
    color:#c9d1d9;
    font-family:"SF Mono","Cascadia Code","Fira Code","JetBrains Mono",Menlo,Monaco,"Courier New",monospace;
    overflow:hidden;
  }

  #container{
    display:flex;
    flex-direction:column;
    align-items:center;
    justify-content:center;
    height:100%;
    padding:16px;
  }

  #status{
    position:fixed;
    top:12px;
    right:16px;
    font-size:11px;
    color:#484f58;
    z-index:10;
    display:flex;
    align-items:center;
    gap:6px;
  }
  #status .dot{
    width:7px;
    height:7px;
    border-radius:50%;
    background:#f85149;
    transition:background 0.3s;
  }
  #status.connected .dot{background:#3fb950}
  #status.connecting .dot{background:#d29922;animation:pulse 1s infinite}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}

  #terminal{
    position:relative;
    background:#0d1117;
    border:1px solid #21262d;
    border-radius:8px;
    padding:12px 16px;
    box-shadow:
      0 0 0 1px rgba(255,255,255,0.03),
      0 16px 48px rgba(0,0,0,0.4),
      inset 0 1px 0 rgba(255,255,255,0.03);
    overflow:hidden;
    line-height:1;
  }

  #terminal .title-bar{
    position:absolute;
    top:0;left:0;right:0;
    height:32px;
    display:flex;
    align-items:center;
    padding:0 12px;
    gap:8px;
    background:#161b22;
    border-bottom:1px solid #21262d;
    border-radius:8px 8px 0 0;
  }
  #terminal .title-bar .btn{
    width:12px;height:12px;border-radius:50%;
  }
  #terminal .title-bar .btn.close{background:#f85149}
  #terminal .title-bar .btn.min{background:#d29922}
  #terminal .title-bar .btn.max{background:#3fb950}
  #terminal .title-bar .title-text{
    flex:1;
    text-align:center;
    font-size:12px;
    color:#484f58;
    user-select:none;
  }

  #grid{
    margin-top:36px;
    position:relative;
    white-space:pre;
    cursor:default;
    user-select:none;
  }

  .row{display:block;height:var(--cell-h)}

  .c{
    display:inline-block;
    width:var(--cell-w);
    height:var(--cell-h);
    text-align:center;
  }
  .c.bold{font-weight:700}
  .c.dim{opacity:0.5}
  .c.italic{font-style:italic}
  .c.underline{text-decoration:underline}
  .c.strikethrough{text-decoration:line-through}
  .c.underline.strikethrough{text-decoration:underline line-through}
  .c.inverse{filter:invert(1)}

  #cursor{
    position:absolute;
    width:var(--cell-w);
    height:var(--cell-h);
    border:none;
    background:rgba(201,209,217,0.7);
    mix-blend-mode:difference;
    pointer-events:none;
    transition:left 50ms,top 50ms;
    animation:blink 1s step-end infinite;
    z-index:5;
  }
  @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}

  #splash{
    display:flex;
    flex-direction:column;
    align-items:center;
    justify-content:center;
    height:100%;
    gap:16px;
    color:#484f58;
  }
  #splash .logo{font-size:48px;opacity:0.3}
  #splash .msg{font-size:14px}
</style>
</head>
<body>
<div id="container">
  <div id="status" class="connecting">
    <span class="dot"></span>
    <span class="label">connecting</span>
  </div>
  <div id="terminal">
    <div class="title-bar">
      <span class="btn close"></span>
      <span class="btn min"></span>
      <span class="btn max"></span>
      <span class="title-text">${title}</span>
    </div>
    <div id="grid">
      <div id="splash">
        <div class="logo">&#x26A1;</div>
        <div class="msg">Waiting for Storm TUI&hellip;</div>
      </div>
    </div>
    <div id="cursor"></div>
  </div>
</div>
<script>
(function(){
  "use strict";

  // ── Configuration ──────────────────────────────────────────────
  var FONT_SIZE = 14;
  var CELL_W = FONT_SIZE * 0.6;   // monospace character width
  var CELL_H = FONT_SIZE * 1.35;  // line height

  var grid = document.getElementById("grid");
  var cursor = document.getElementById("cursor");
  var terminal = document.getElementById("terminal");
  var status = document.getElementById("status");
  var statusLabel = status.querySelector(".label");

  // Set CSS custom properties
  document.documentElement.style.setProperty("--cell-w", CELL_W + "px");
  document.documentElement.style.setProperty("--cell-h", CELL_H + "px");
  grid.style.fontSize = FONT_SIZE + "px";

  // ── State ──────────────────────────────────────────────────────
  var width = 0;
  var height = 0;
  var cells = null;    // flat array of DOM <span> elements
  var rows = null;     // array of row <div> elements
  var ws = null;
  var reconnectTimer = null;
  var reconnectDelay = 500;
  var MAX_RECONNECT_DELAY = 8000;

  // ── Grid management ────────────────────────────────────────────

  function rebuildGrid(w, h) {
    width = w;
    height = h;
    grid.innerHTML = "";
    cells = new Array(w * h);
    rows = new Array(h);

    var fragment = document.createDocumentFragment();
    for (var y = 0; y < h; y++) {
      var row = document.createElement("div");
      row.className = "row";
      for (var x = 0; x < w; x++) {
        var span = document.createElement("span");
        span.className = "c";
        span.textContent = " ";
        row.appendChild(span);
        cells[y * w + x] = span;
      }
      fragment.appendChild(row);
      rows[y] = row;
    }
    grid.appendChild(fragment);

    // Size the terminal frame
    terminal.style.width = (w * CELL_W + 32) + "px";
    terminal.style.height = (h * CELL_H + 36 + 24) + "px";
  }

  function applyCell(index, ch, fgCSS, bgCSS, attrs) {
    var span = cells[index];
    if (!span) return;

    // Character
    span.textContent = (ch === "" || ch === "\\0") ? " " : ch;

    // Foreground
    span.style.color = fgCSS || "";

    // Background
    span.style.backgroundColor = bgCSS || "";

    // Attributes via class toggling (faster than style manipulation)
    var cls = "c";
    if (attrs & 1)   cls += " bold";           // Attr.BOLD
    if (attrs & 2)   cls += " dim";            // Attr.DIM
    if (attrs & 4)   cls += " italic";         // Attr.ITALIC
    if (attrs & 8)   cls += " underline";      // Attr.UNDERLINE
    if (attrs & 32)  cls += " inverse";        // Attr.INVERSE
    if (attrs & 128) cls += " strikethrough";  // Attr.STRIKETHROUGH
    span.className = cls;
  }

  function updateCursor(cx, cy) {
    cursor.style.left = (16 + cx * CELL_W) + "px";
    cursor.style.top = (36 + cy * CELL_H) + "px";
  }

  // ── Message handling ───────────────────────────────────────────

  function handleMessage(data) {
    var msg;
    try { msg = JSON.parse(data); } catch(e) { return; }

    if (msg.type === "full") {
      if (msg.width !== width || msg.height !== height) {
        rebuildGrid(msg.width, msg.height);
      }
      var c = msg.cells;
      var total = msg.width * msg.height;
      for (var i = 0; i < total; i++) {
        var base = i * 4;
        applyCell(i, c[base], c[base+1], c[base+2], c[base+3]);
      }
      updateCursor(msg.cursorX, msg.cursorY);

    } else if (msg.type === "diff") {
      if (msg.width !== width || msg.height !== height) {
        // Dimensions changed — can't apply diff, wait for full frame
        return;
      }
      var ch = msg.changes;
      for (var j = 0; j < ch.length; j += 5) {
        applyCell(ch[j], ch[j+1], ch[j+2], ch[j+3], ch[j+4]);
      }
      updateCursor(msg.cursorX, msg.cursorY);

    } else if (msg.type === "cursor") {
      updateCursor(msg.cursorX, msg.cursorY);
    }
  }

  // ── WebSocket connection ───────────────────────────────────────

  function setStatus(state, text) {
    status.className = state;
    statusLabel.textContent = text;
  }

  function connect() {
    if (ws) return;

    var protocol = location.protocol === "https:" ? "wss:" : "ws:";
    ws = new WebSocket(protocol + "//" + location.host);

    ws.onopen = function() {
      setStatus("connected", "connected");
      reconnectDelay = 500;
    };

    ws.onmessage = function(e) {
      handleMessage(e.data);
    };

    ws.onclose = function() {
      ws = null;
      setStatus("connecting", "reconnecting\u2026");
      scheduleReconnect();
    };

    ws.onerror = function() {
      if (ws) ws.close();
    };
  }

  function scheduleReconnect() {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(function() {
      reconnectTimer = null;
      connect();
    }, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 1.5, MAX_RECONNECT_DELAY);
  }

  // ── Boot ───────────────────────────────────────────────────────
  connect();
})();
</script>
</body>
</html>`;
  }
}

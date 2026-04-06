/** Verifies FrameScheduler coalesces rapid requestRender calls and handles generation guards. */
import { FrameScheduler } from "../../../src/reconciler/frame-scheduler.js";

let pass = 0, fail = 0;

function check(name: string, ok: boolean, detail?: string) {
  if (ok) { pass++; }
  else { fail++; console.log(`  FAIL: ${name}${detail ? " — " + detail : ""}`); }
}

console.log(`\n  Frame Coalescing Tests\n`);

// ── 1. Multiple scheduleFastRepaint — only one callback fires ───
console.log("  1. Coalesces rapid requests");
{
  const scheduler = new FrameScheduler({ maxFps: 60 });
  let callCount = 0;
  const repaint = () => { callCount++; };

  // Schedule 5 fast repaints rapidly
  for (let i = 0; i < 5; i++) {
    scheduler.scheduleFastRepaint(repaint);
  }

  // Wait for microtask to fire
  await new Promise(r => setTimeout(r, 50));
  check("only 1 repaint fires", callCount === 1, `got ${callCount}`);
}

// ── 2. beginFullPaint cancels pending fast repaint ──────────────
console.log("  2. Full paint cancels fast repaint");
{
  const scheduler = new FrameScheduler({ maxFps: 60 });
  let fastCount = 0;
  const fastRepaint = () => { fastCount++; };

  scheduler.scheduleFastRepaint(fastRepaint);
  // Full paint bumps generation — pending microtask should skip
  scheduler.beginFullPaint();

  await new Promise(r => setTimeout(r, 50));
  check("fast repaint cancelled", fastCount === 0, `got ${fastCount}`);
}

// ── 3. After full paint, new fast repaint works ─────────────────
console.log("  3. New request after full paint");
{
  const scheduler = new FrameScheduler({ maxFps: 60 });
  let count = 0;

  scheduler.beginFullPaint();
  scheduler.recordFrame();

  // New request after full paint
  await new Promise(r => setTimeout(r, 20));
  scheduler.scheduleFastRepaint(() => { count++; });
  await new Promise(r => setTimeout(r, 50));
  check("new request fires", count === 1, `got ${count}`);
}

// ── 4. Unmounted scheduler doesn't fire ─────────────────────────
console.log("  4. Unmounted scheduler");
{
  const scheduler = new FrameScheduler({ maxFps: 60 });
  let count = 0;

  scheduler.setUnmounted();
  scheduler.scheduleFastRepaint(() => { count++; });
  await new Promise(r => setTimeout(r, 50));
  check("unmounted: no fire", count === 0);
}

console.log(`\n  Frame coalescing: ${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);

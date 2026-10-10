let ctx: AudioContext | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

/** Two-tone ring built with WebAudio (no asset). Must be started after a user gesture. */
export function primeAudio() {
  try { ctx ??= new AudioContext(); void ctx.resume(); } catch { /* unsupported */ }
}

function beep(freq: number, at: number, dur: number) {
  if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.value = freq; o.type = "sine";
  g.gain.setValueAtTime(0.0001, ctx.currentTime + at);
  g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + at + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + dur);
  o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + at); o.stop(ctx.currentTime + at + dur + 0.05);
}

export function startRing() {
  stopRing();
  const ring = () => { beep(440, 0, 0.35); beep(480, 0, 0.35); beep(440, 0.5, 0.35); beep(480, 0.5, 0.35); try { navigator.vibrate?.([400, 200, 400]); } catch { /* ignore */ } };
  ring(); timer = setInterval(ring, 2600);
}
export function stopRing() { if (timer) clearInterval(timer); timer = null; try { navigator.vibrate?.(0); } catch { /* ignore */ } }

let ctx: AudioContext | null = null;
let osc: OscillatorNode | null = null;
let gain: GainNode | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

/** Two-tone 800/1200 Hz sweep at full volume (Loud SOS mode or the Siren tile). Start from a user gesture. */
export function startSiren() {
  if (osc) return;
  try {
    ctx ??= new AudioContext(); void ctx.resume();
    osc = ctx.createOscillator(); gain = ctx.createGain();
    osc.type = "square"; gain.gain.value = 1;
    osc.connect(gain).connect(ctx.destination); osc.start();
    let hi = false;
    const tick = () => { hi = !hi; osc?.frequency.setTargetAtTime(hi ? 1200 : 800, ctx!.currentTime, 0.05); };
    tick(); timer = setInterval(tick, 450);
    try { navigator.vibrate?.([500, 200, 500, 200, 500]); } catch { /* ignore */ }
  } catch { /* unsupported */ }
}
export function stopSiren() {
  if (timer) clearInterval(timer); timer = null;
  try { osc?.stop(); osc?.disconnect(); gain?.disconnect(); } catch { /* already stopped */ }
  osc = null; gain = null;
}
export const sirenOn = () => osc !== null;

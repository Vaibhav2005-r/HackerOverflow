import { Reason } from "../scoring/types";
import { cumulative, haversine, snapToLine, type LngLat } from "../util/geo";
import type { Band } from "../util/time";
import { ENGINE_CONFIG as C } from "./config";
import type {
  CheckInReason, EngineContext, EngineEvent, EngineResult, EngineState, Effect, Fix, Phase, Priority, SosMode, SosTrigger,
} from "./types";
import type { Stretch } from "../route/analyze";

export function initialState(band: Band = "night", now = 0): EngineState {
  return { phase: "IDLE", now, band, headsUpShown: [] };
}

const ACTIVE: Phase[] = ["JOURNEY", "HEADS_UP", "GUARD"];
const isActive = (p: Phase) => ACTIVE.includes(p);
const baseReturn = (p: Phase): Phase => (p === "HEADS_UP" ? "JOURNEY" : p);

function idle(s: EngineState): EngineState {
  return { phase: "IDLE", now: s.now, band: s.band, position: s.position, display: s.display, headsUpShown: [] };
}

class Ctx {
  constructor(public s: EngineState, public fx: Effect[], public c: EngineContext) {}
  say(key: string, priority: Priority, params: Record<string, string | number> = {}, audible = true) {
    this.fx.push({
      type: "SAY", messageKey: key, priority, audible,
      params: { ...(this.c.profile?.name ? { name: this.c.profile.name } : {}),
                ...(this.c.profile?.contact ? { contact: this.c.profile.contact } : {}), ...params },
    });
  }
  haptic(pattern: readonly number[]) { this.fx.push({ type: "HAPTIC", pattern: [...pattern] }); }
  push(e: Effect) { this.fx.push(e); }
}

// ---------- transitions ----------
function enterGuard(x: Ctx, manual: boolean) {
  const s = x.s;
  s.phase = "GUARD"; s.guard = { manual, since: s.now };
  s.extraStreak = undefined; s.isoSince = undefined; s.comfortableSince = undefined; s.headsUp = undefined;
  x.push({ type: "ENTER_GUARD_UI" }); x.haptic(C.haptics.guardOn);
  x.push({ type: "WAKE_LOCK", on: true }); x.say("guard_on", "info");
}

function exitGuard(x: Ctx, manual = false) {
  const s = x.s;
  s.phase = s.route ? "JOURNEY" : "IDLE"; s.guard = undefined; s.comfortableSince = undefined;
  s.extraStreak = undefined; s.isoSince = undefined; // streaks must rebuild from scratch
  if (manual) s.guardSuppressedUntil = s.now + C.guard.manualExitSuppressMs;
  x.push({ type: "EXIT_GUARD_UI" });
  if (!s.route) x.push({ type: "WAKE_LOCK", on: false });
  x.say("guard_off", "info");
}

function startCheckIn(x: Ctx, reason: CheckInReason) {
  const s = x.s;
  const window = reason === "timer" ? C.checkIn.timerResponseMs : C.checkIn.responseMs;
  s.checkIn = { reason, deadlineT: s.now + window, returnPhase: baseReturn(s.phase) };
  s.phase = "CHECK_IN"; s.headsUp = undefined;
  x.haptic(C.haptics.checkIn);
  x.say(reason === "stopped" ? "check_in" : reason === "offroute" ? "check_in_offroute" : "check_in_timer", "checkin");
  x.push({ type: "SHOW_CARD", card: "check_in", data: { reason, deadlineT: s.checkIn.deadlineT } });
}

function startCountdown(x: Ctx, trigger: SosTrigger) {
  const s = x.s;
  const back = s.phase === "CHECK_IN" ? (s.checkIn?.returnPhase ?? "JOURNEY") : baseReturn(s.phase);
  s.countdown = { endT: s.now + C.countdownMs, trigger, returnPhase: back, lastRemaining: Math.ceil(C.countdownMs / 1000) };
  s.phase = "SOS_COUNTDOWN"; s.checkIn = undefined; s.headsUp = undefined;
  x.haptic(C.haptics.tick);
  x.say("sos_countdown", "sos", { seconds: s.countdown.lastRemaining });
  x.push({ type: "SHOW_CARD", card: "sos_countdown", data: { endT: s.countdown.endT, trigger } });
}

function activateSos(x: Ctx, trigger: SosTrigger, mode: SosMode) {
  const s = x.s;
  s.phase = "SOS_ACTIVE"; s.sos = { trigger, mode, startedT: s.now, wrongPins: 0, lockUntil: 0 };
  s.countdown = undefined; s.checkIn = undefined; s.guard = undefined; s.headsUp = undefined;
  x.push({ type: "START_SOS", trigger, mode });
  x.push({ type: "START_SHARE", kind: "sos" });
  x.push({ type: "START_RECORDING" });
  x.push({ type: "WAKE_LOCK", on: true });
  x.push({ type: "NOTIFY_CIRCLE", kind: "sos" });
  x.haptic(C.haptics.sosStart);
  x.say(mode === "loud" ? "sos_active_loud" : "sos_active_silent", "sos", {}, mode === "loud");
}

function softAlert(x: Ctx) {
  const s = x.s;
  const wasGuard = s.checkIn?.returnPhase === "GUARD";
  x.push({ type: "NOTIFY_CIRCLE", kind: "checkin_missed" });
  x.push({ type: "START_SHARE", kind: "live" });
  x.say("soft_alert_sent", "checkin");
  s.checkIn = undefined; s.phase = "GUARD"; s.guard = { manual: false, since: s.now };
  s.offRouteSince = undefined; s.stoppedSince = undefined; s.comfortableSince = undefined;
  if (!wasGuard) { x.push({ type: "ENTER_GUARD_UI" }); x.push({ type: "WAKE_LOCK", on: true }); }
}

function qualifiesForHeadsUp(st: Stretch) {
  return st.cls === "EXTRA_CARE" || (st.reasons & (Reason.ISOLATED | Reason.UNLIT)) !== 0;
}

function maybeHeadsUp(x: Ctx) {
  const s = x.s, r = s.route;
  if (s.phase !== "JOURNEY" || !r || !s.snap) return;
  const along = s.snap.alongM, look = C.headsUpM[r.mode];
  for (const st of r.assessment.stretches) {
    if (s.headsUpShown.includes(st.id) || st.endM <= along || !qualifiesForHeadsUp(st)) continue;
    if (along >= st.startM) { s.headsUpShown = [...s.headsUpShown, st.id]; continue; } // already inside: Guard handles it
    const d = st.startM - along;
    if (d > look) return; // stretches are ordered; later ones are further away
    s.headsUpShown = [...s.headsUpShown, st.id];
    s.phase = "HEADS_UP"; s.headsUp = { stretchId: st.id, expiresT: s.now + C.headsUpExpireMs };
    const m = Math.max(10, Math.round(d / 10) * 10);
    const key = st.reasons & Reason.UNLIT ? "heads_up_unlit" : st.reasons & Reason.ISOLATED ? "heads_up_isolated" : "heads_up_generic";
    x.haptic(C.haptics.headsUp);
    x.say(key, "headsup", { m });
    const alt = r.alternatives
      .filter((a) => a.durationS - r.assessment.durationS <= C.detour.maxExtraS &&
        snapToLine(a.coords, st.midPt).offsetM > C.detour.clearanceM)
      .sort((a, b) => b.rsi - a.rsi)[0];
    x.push({
      type: "SHOW_CARD", card: "heads_up",
      data: {
        stretchId: st.id, distanceM: m, cls: st.cls, reasons: st.reasons, tip: x.c.tipFor?.(st) ?? null,
        saferDetour: alt ? { routeId: alt.id, extraMinutes: Math.max(0, Math.round((alt.durationS - r.assessment.durationS) / 60)) } : null,
      },
    });
    return;
  }
}

/** Time-driven rules; called after every POSITION and on TICK. */
function evaluate(x: Ctx) {
  const s = x.s, t = s.now;

  if (s.phase === "CHECK_IN" && s.checkIn && t >= s.checkIn.deadlineT) {
    if (s.checkIn.reason === "timer") startCountdown(x, "timer"); else softAlert(x);
    return;
  }
  if (s.phase === "SOS_COUNTDOWN" && s.countdown) {
    const remaining = Math.ceil((s.countdown.endT - t) / 1000);
    if (t >= s.countdown.endT) { activateSos(x, s.countdown.trigger, x.c.sosMode ?? "silent"); return; }
    if (remaining < s.countdown.lastRemaining) {
      s.countdown = { ...s.countdown, lastRemaining: remaining };
      x.haptic(C.haptics.tick);
      x.push({ type: "SHOW_CARD", card: "sos_countdown", data: { endT: s.countdown.endT, remaining } });
    }
    return;
  }
  if (!isActive(s.phase)) return;

  if (s.timerDeadline !== undefined && t >= s.timerDeadline) { s.timerDeadline = undefined; startCheckIn(x, "timer"); return; }
  if (s.offRouteSince !== undefined && t - s.offRouteSince > C.offRoute.forMs) { startCheckIn(x, "offroute"); return; }
  if (s.stoppedSince !== undefined && t - s.stoppedSince > C.stop.forMs && s.cls && s.cls !== "COMFORTABLE" && s.position) {
    const farFromDest = !s.route || haversine([s.position.lng, s.position.lat], s.route.destination) > C.stop.minFromDestM;
    if (farFromDest) { startCheckIn(x, "stopped"); return; }
  }

  if (s.phase !== "GUARD") {
    if (s.guardSuppressedUntil !== undefined && t < s.guardSuppressedUntil) { maybeHeadsUp(x); return; }
    const st = s.extraStreak, g = C.guard;
    const extra = st && (st.count >= g.enterFixes || t - st.firstT >= g.singleFixHoldMs);
    const iso = s.isoSince !== undefined && t - s.isoSince >= g.isolatedNightMs;
    if (extra || iso) { enterGuard(x, false); return; }
  } else if (s.guard && !s.guard.manual && s.comfortableSince !== undefined && t - s.comfortableSince >= C.guard.exitComfortableMs) {
    exitGuard(x); return;
  }

  if (s.phase === "HEADS_UP" && s.headsUp && t >= s.headsUp.expiresT) { s.phase = "JOURNEY"; s.headsUp = undefined; }
  maybeHeadsUp(x);
}

function onPosition(x: Ctx, fix: Fix) {
  const s = x.s, prev = s.position;
  s.position = fix;
  const a = C.emaAlpha;
  s.display = s.display ? { lat: a * fix.lat + (1 - a) * s.display.lat, lng: a * fix.lng + (1 - a) * s.display.lng } : { lat: fix.lat, lng: fix.lng };
  if (!(isActive(s.phase) || s.phase === "CHECK_IN")) return;
  if (fix.accuracy > C.maxAccuracyM) { evaluate(x); return; }

  const info = x.c.lookup(fix.lat, fix.lng, s.band);
  const cls = info?.cls ?? "STAY_ALERT"; // unknown cell → fail-safe
  const reasons = info?.reasons ?? Reason.LOW_DATA;
  s.cls = cls;

  if (s.route) {
    const sn = snapToLine(s.route.assessment.coords, [fix.lng, fix.lat], s.route.cum);
    s.snap = { alongM: sn.distAlongM, offsetM: sn.offsetM };
    if (sn.offsetM > C.offRoute.distM) s.offRouteSince ??= fix.t; else s.offRouteSince = undefined;
  }

  let speed = fix.speed ?? undefined;
  if (speed === undefined && prev && fix.t > prev.t) speed = haversine([prev.lng, prev.lat], [fix.lng, fix.lat]) / ((fix.t - prev.t) / 1000);
  if (speed !== undefined) { if (speed < C.stop.speedMps) s.stoppedSince ??= fix.t; else s.stoppedSince = undefined; }

  if (cls === "EXTRA_CARE") {
    const st = s.extraStreak;
    if (!st) s.extraStreak = { count: 1, firstT: fix.t, lastT: fix.t };
    else if (fix.t - st.lastT >= C.guard.minFixGapMs) s.extraStreak = { ...st, count: st.count + 1, lastT: fix.t };
  } else s.extraStreak = undefined;

  if (s.band === "night" && cls === "STAY_ALERT" && reasons & Reason.ISOLATED) s.isoSince ??= fix.t; else s.isoSince = undefined;
  if (cls === "COMFORTABLE") s.comfortableSince ??= fix.t; else s.comfortableSince = undefined;

  evaluate(x);
}

export function reduce(prev: EngineState, ev: EngineEvent, c: EngineContext): EngineResult {
  const fx: Effect[] = [];
  let s: EngineState = { ...prev, now: Math.max(prev.now, ev.t) };
  if (s.phase === "RESOLVED" && ["PLAN_STARTED", "ROUTE_STARTED", "MANUAL_GUARD_ON", "RESET"].includes(ev.type)) s = idle(s);
  const x = new Ctx(s, fx, c);
  const sosMode = c.sosMode ?? "silent";
  const inSos = s.phase === "SOS_ACTIVE" || s.phase === "SOS_DURESS";

  switch (ev.type) {
    case "BAND_CHANGED": s.band = ev.band; break;
    case "RESET": x.s = idle(s); return { state: x.s, effects: fx };
    case "PLAN_STARTED": if (s.phase === "IDLE") s.phase = "PLANNING"; break;
    case "TIMER_SET": s.timerDeadline = ev.deadlineT; break;
    case "POSITION": onPosition(x, ev.fix); break;
    case "TICK": evaluate(x); break;

    case "ROUTE_STARTED": {
      if (inSos || s.phase === "SOS_COUNTDOWN") break;
      const a = ev.assessment, last = a.coords.at(-1) as LngLat;
      s.route = { assessment: a, alternatives: ev.alternatives ?? [], mode: ev.mode ?? "walk", destination: last, cum: cumulative(a.coords) };
      s.timerDeadline = ev.t + a.durationS * 1000 * C.timer.etaFactor + C.timer.graceMs;
      s.headsUpShown = []; s.headsUp = undefined; s.snap = undefined;
      s.offRouteSince = undefined; s.stoppedSince = undefined; s.extraStreak = undefined; s.isoSince = undefined;
      if (s.phase !== "GUARD") s.phase = "JOURNEY";
      x.push({ type: "WAKE_LOCK", on: true });
      x.say("journey_start", "info");
      break;
    }
    case "ARRIVED": {
      if (!(isActive(s.phase) || s.phase === "CHECK_IN")) break;
      const wasGuard = s.phase === "GUARD" || s.checkIn?.returnPhase === "GUARD";
      s = x.s = idle(s);
      if (wasGuard) fx.push({ type: "EXIT_GUARD_UI" });
      fx.push({ type: "WAKE_LOCK", on: false });
      x.say("arrived", "info");
      fx.push({ type: "SHOW_CARD", card: "arrived", data: {} });
      break;
    }
    case "USER_OK": {
      if (s.phase !== "CHECK_IN" || !s.checkIn) break;
      if (s.checkIn.reason === "timer") s.timerDeadline = ev.t + C.timer.extendMs;
      s.offRouteSince = undefined; s.stoppedSince = undefined;
      s.phase = s.checkIn.returnPhase; s.checkIn = undefined;
      x.say("check_in_ok", "info");
      break;
    }
    case "TIMER_EXPIRED": if (isActive(s.phase)) { s.timerDeadline = undefined; startCheckIn(x, "timer"); } break;
    case "MANUAL_GUARD_ON": {
      if (s.phase === "GUARD") { if (s.guard) s.guard = { ...s.guard, manual: true }; break; }
      if (["IDLE", "PLANNING", "JOURNEY", "HEADS_UP"].includes(s.phase)) enterGuard(x, true);
      break;
    }
    case "MANUAL_GUARD_OFF": if (s.phase === "GUARD") exitGuard(x, true); break;

    case "HOLD_SOS_COMPLETE":
      if (!inSos && s.phase !== "RESOLVED") activateSos(x, "hold", ev.mode ?? sosMode);
      break;
    case "SHAKE_DETECTED": {
      const armed = isActive(s.phase) || s.phase === "CHECK_IN" || (c.shakeAlwaysArmed && (s.phase === "IDLE" || s.phase === "PLANNING"));
      if (armed) startCountdown(x, "shake");
      break;
    }
    case "COUNTDOWN_CANCELLED":
      if (s.phase === "SOS_COUNTDOWN" && s.countdown) { s.phase = s.countdown.returnPhase; s.countdown = undefined; }
      break;

    case "SOS_CANCEL": {
      if (!inSos || !s.sos) break;
      if (ev.t < s.sos.lockUntil) { fx.push({ type: "SHOW_CARD", card: "pin_locked", data: { until: s.sos.lockUntil } }); break; }
      if (ev.pinResult === "ok") {
        s.phase = "RESOLVED"; s.sos = undefined;
        fx.push({ type: "STOP_SOS", duress: false }, { type: "WAKE_LOCK", on: false });
        x.say("sos_resolved", "info");
      } else if (ev.pinResult === "duress" && s.phase === "SOS_ACTIVE") {
        // UI looks cancelled; backend keeps streaming with coercion flag. No sound, no vibration.
        s.phase = "SOS_DURESS";
        fx.push({ type: "STOP_SOS", duress: true }, { type: "NOTIFY_CIRCLE", kind: "coercion" });
      } else if (ev.pinResult === "wrong") {
        const wrong = s.sos.wrongPins + 1;
        const locked = wrong >= C.pin.wrongLimit;
        s.sos = { ...s.sos, wrongPins: locked ? 0 : wrong, lockUntil: locked ? ev.t + C.pin.lockoutMs : 0 };
        fx.push({ type: "SHOW_CARD", card: locked ? "pin_locked" : "pin_wrong", data: { attemptsLeft: C.pin.wrongLimit - wrong } });
      }
      break;
    }
  }
  return { state: x.s === s ? s : x.s, effects: fx };
}

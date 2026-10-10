import { beforeEach, describe, expect, it } from "vitest";
import { assessRoute } from "../route/analyze";
import { Reason } from "../scoring/types";
import { LAT0, line, lngAt, zoneLookup } from "../testing";
import { ENGINE_CONFIG as C } from "./config";
import { initialState, reduce } from "./reduce";
import type { Effect, EngineContext, EngineEvent, EngineState, Fix } from "./types";

const OK = 80, ALERT = 50, CARE = 20;
const ZONES = [
  { from: 0, to: 600, score: OK },
  { from: 600, to: 900, score: CARE, reasons: Reason.UNLIT | Reason.ISOLATED },
  { from: 900, to: 3000, score: OK },
];
const lookup = zoneLookup(ZONES);
const ctx: EngineContext = { lookup, profile: { name: "Riya", contact: "Maa" }, sosMode: "silent" };
const route = assessRoute({ id: "main", coords: line(0, 2000, 80), durationS: 1500, distanceM: 2000 }, "night", lookup);
const fix = (m: number, t: number, extra: Partial<Fix> = {}, lat = LAT0): Fix => ({ lat, lng: lngAt(m), accuracy: 10, speed: 1.3, t, ...extra });

class Driver {
  s: EngineState = initialState("night", 0);
  fx: Effect[] = [];
  constructor(public c: EngineContext = ctx) {}
  send(ev: EngineEvent) { const r = reduce(this.s, ev, this.c); this.s = r.state; this.fx = r.effects; return r.effects; }
  at(m: number, t: number, extra: Partial<Fix> = {}, lat = LAT0) { return this.send({ type: "POSITION", t, fix: fix(m, t, extra, lat) }); }
  tick(t: number) { return this.send({ type: "TICK", t }); }
  start(t = 0, alternatives: ReturnType<typeof assessRoute>[] = []) { return this.send({ type: "ROUTE_STARTED", t, assessment: route, alternatives }); }
  has(type: Effect["type"]) { return this.fx.some((e) => e.type === type); }
}
const say = (fx: Effect[]) => fx.filter((e): e is Extract<Effect, { type: "SAY" }> => e.type === "SAY");
const card = (fx: Effect[], name: string) => fx.find((e): e is Extract<Effect, { type: "SHOW_CARD" }> => e.type === "SHOW_CARD" && e.card === name);

let d: Driver;
beforeEach(() => { d = new Driver(); });

describe("route start & arrival", () => {
  it("starts a journey, keeps the screen awake, sets the walk-with-me timer", () => {
    const fx = d.start(1000);
    expect(d.s.phase).toBe("JOURNEY");
    expect(fx).toContainEqual({ type: "WAKE_LOCK", on: true });
    expect(d.s.timerDeadline).toBe(1000 + 1500 * 1000 * 1.25 + 180_000);
    expect(say(fx)[0]!.messageKey).toBe("journey_start");
  });
  it("PLAN_STARTED moves IDLE → PLANNING only", () => {
    d.send({ type: "PLAN_STARTED", t: 1 }); expect(d.s.phase).toBe("PLANNING");
    d.start(2); d.send({ type: "PLAN_STARTED", t: 3 }); expect(d.s.phase).toBe("JOURNEY");
  });
  it("arrival returns to IDLE, releases the wake lock and offers to tell the contact", () => {
    d.start(); const fx = d.send({ type: "ARRIVED", t: 10 });
    expect(d.s.phase).toBe("IDLE"); expect(d.s.route).toBeUndefined();
    expect(fx).toContainEqual({ type: "WAKE_LOCK", on: false });
    expect(say(fx)[0]).toMatchObject({ messageKey: "arrived", params: { contact: "Maa" } });
    expect(d.send({ type: "ARRIVED", t: 11 })).toEqual([]);
  });
  it("arrival from GUARD also closes the Guard UI", () => {
    d.start(); d.send({ type: "MANUAL_GUARD_ON", t: 1 });
    expect(d.send({ type: "ARRIVED", t: 2 })).toContainEqual({ type: "EXIT_GUARD_UI" });
  });
  it("TIMER_SET overrides the deadline; BAND_CHANGED updates the band", () => {
    d.send({ type: "TIMER_SET", t: 1, deadlineT: 99 }); expect(d.s.timerDeadline).toBe(99);
    d.send({ type: "BAND_CHANGED", t: 2, band: "day" }); expect(d.s.band).toBe("day");
  });
});

describe("GPS hygiene", () => {
  it("smooths the display position with an EMA but keeps the raw fix", () => {
    d.at(0, 0); d.at(100, 1000);
    expect(d.s.position!.lng).toBeCloseTo(lngAt(100), 8);
    expect(d.s.display!.lng).toBeCloseTo((lngAt(0) + lngAt(100)) / 2, 8);
  });
  it("positions outside a journey only update the dot", () => {
    d.at(650, 0); expect(d.s.phase).toBe("IDLE"); expect(d.s.cls).toBeUndefined();
  });
  it("ignores poor-accuracy fixes for Guard decisions (still updates the dot)", () => {
    d.start();
    d.at(650, 1000, { accuracy: 100 }); d.at(660, 7000, { accuracy: 100 });
    expect(d.s.phase).not.toBe("GUARD"); expect(d.s.extraStreak).toBeUndefined();
    expect(d.s.position!.accuracy).toBe(100);
  });
});

describe("heads-up", () => {
  beforeEach(() => d.start());
  it("fires once per stretch within 150 m, not earlier", () => {
    d.at(400, 1000); expect(d.s.phase).toBe("JOURNEY");           // 200 m away
    const fx = d.at(460, 2000);                                      // 140 m away
    expect(d.s.phase).toBe("HEADS_UP");
    expect(card(fx, "heads_up")!.data).toMatchObject({ distanceM: 140, cls: "EXTRA_CARE" });
    expect(fx).toContainEqual({ type: "HAPTIC", pattern: [60, 80, 60] });
    expect(say(fx)[0]).toMatchObject({ messageKey: "heads_up_unlit", priority: "headsup", params: { m: 140 } });
    expect(d.at(480, 3000).filter((e) => e.type === "SHOW_CARD")).toEqual([]);
    d.tick(2000 + C.headsUpExpireMs); expect(d.s.phase).toBe("JOURNEY");
    d.at(500, 40_000); expect(d.s.phase).toBe("JOURNEY");              // does not repeat
  });
  it("uses the isolated wording (naming the contact) when not unlit", () => {
    const iso = assessRoute({ id: "i", coords: line(0, 2000, 80), durationS: 1500, distanceM: 2000 }, "night",
      zoneLookup([{ from: 0, to: 600, score: OK }, { from: 600, to: 900, score: CARE, reasons: Reason.ISOLATED }, { from: 900, to: 3000, score: OK }]));
    const dd = new Driver(); dd.send({ type: "ROUTE_STARTED", t: 0, assessment: iso });
    const m = say(dd.at(500, 1000))[0]!;
    expect(m.messageKey).toBe("heads_up_isolated"); expect(m.params.contact).toBe("Maa");
  });
  it("uses the generic wording otherwise, and uses the 400 m horizon for vehicles", () => {
    const g = assessRoute({ id: "g", coords: line(0, 2000, 80), durationS: 600, distanceM: 2000 }, "night",
      zoneLookup([{ from: 0, to: 600, score: OK }, { from: 600, to: 900, score: CARE, reasons: Reason.NARROW_LANE }, { from: 900, to: 3000, score: OK }]), "vehicle");
    const dd = new Driver(); dd.send({ type: "ROUTE_STARTED", t: 0, assessment: g, mode: "vehicle" });
    dd.at(150, 1000); expect(dd.s.phase).toBe("JOURNEY");
    expect(say(dd.at(250, 2000))[0]!.messageKey).toBe("heads_up_generic");
  });
  it("ignores quiet Stay-alert stretches that are neither unlit nor isolated", () => {
    const q = assessRoute({ id: "q", coords: line(0, 2000, 80), durationS: 1500, distanceM: 2000 }, "night",
      zoneLookup([{ from: 0, to: 600, score: OK }, { from: 600, to: 900, score: ALERT, reasons: Reason.NARROW_LANE }, { from: 900, to: 3000, score: OK }]));
    const dd = new Driver(); dd.send({ type: "ROUTE_STARTED", t: 0, assessment: q });
    dd.at(500, 1000); expect(dd.s.phase).toBe("JOURNEY");
  });
  it("marks a stretch already entered as shown without announcing it", () => {
    const fx = d.at(650, 1000);
    expect(card(fx, "heads_up")).toBeUndefined(); expect(d.s.headsUpShown).toContain("main:0");
  });
  it("offers a safer detour when an alternative avoids the stretch for ≤ 5 min extra", () => {
    const north = (m: number) => line(0, 2000, 80).map(([lng]) => [lng, LAT0 + 0.003] as [number, number]).slice(0, Math.min(81, m));
    const alt = assessRoute({ id: "alt", coords: north(81), durationS: 1700, distanceM: 2100 }, "night", lookup);
    const tooLong = assessRoute({ id: "far", coords: north(81), durationS: 2500, distanceM: 2100 }, "night", lookup);
    const near = assessRoute({ id: "near", coords: line(0, 2000, 80), durationS: 1500, distanceM: 2000 }, "night", lookup);
    const dd = new Driver(); dd.start(0, [near, tooLong]);
    expect(card(dd.at(500, 1000), "heads_up")!.data.saferDetour).toBeNull();
    const d2 = new Driver(); d2.start(0, [near, alt, tooLong]);
    expect(card(d2.at(500, 1000), "heads_up")!.data.saferDetour).toEqual({ routeId: "alt", extraMinutes: 3 });
  });
  it("includes the tip supplied by the host", () => {
    const dd = new Driver({ ...ctx, tipFor: () => ({ key: "tip.torch", params: {} }) }); dd.start();
    expect(card(dd.at(500, 1000), "heads_up")!.data.tip).toEqual({ key: "tip.torch", params: {} });
  });
});

describe("guard mode", () => {
  beforeEach(() => d.start());
  it("needs 2 good fixes ≥ 5 s apart inside an Extra-care cell", () => {
    d.at(650, 1000); expect(d.s.phase).not.toBe("GUARD");
    d.at(655, 3000); expect(d.s.phase).not.toBe("GUARD");              // < 5 s apart: same moment
    const fx = d.at(660, 6000);
    expect(d.s.phase).toBe("GUARD");
    expect(fx).toEqual(expect.arrayContaining([{ type: "ENTER_GUARD_UI" }, { type: "HAPTIC", pattern: [120, 60, 120] }]));
    expect(say(fx)[0]!.messageKey).toBe("guard_on");
  });
  it("also enters after 1 fix + 10 s with no contradicting fix", () => {
    d.at(650, 1000); d.tick(10_999); expect(d.s.phase).not.toBe("GUARD");
    d.tick(11_000); expect(d.s.phase).toBe("GUARD");
  });
  it("a comfortable fix resets the streak", () => {
    d.at(650, 1000); d.at(550, 3000); d.tick(20_000);
    expect(d.s.phase).not.toBe("GUARD");
  });
  it("enters Guard on an isolated Stay-alert cell at night after 20 s", () => {
    const iso = zoneLookup([{ from: 0, to: 3000, score: ALERT, reasons: Reason.ISOLATED }]);
    const dd = new Driver({ ...ctx, lookup: iso });
    dd.send({ type: "ROUTE_STARTED", t: 0, assessment: route });
    dd.at(100, 1000); dd.tick(20_999); expect(dd.s.phase).not.toBe("GUARD");
    dd.tick(21_000); expect(dd.s.phase).toBe("GUARD");
    const day = new Driver({ ...ctx, lookup: iso }); day.send({ type: "BAND_CHANGED", t: 0, band: "day" });
    day.send({ type: "ROUTE_STARTED", t: 0, assessment: route }); day.at(100, 1000); day.tick(60_000);
    expect(day.s.phase).toBe("JOURNEY");
  });
  it("treats unknown cells as Stay alert: no Guard on its own", () => {
    const dd = new Driver({ ...ctx, lookup: zoneLookup([]) }); dd.send({ type: "ROUTE_STARTED", t: 0, assessment: route });
    dd.at(100, 1000); dd.tick(60_000); expect(dd.s.phase).toBe("JOURNEY"); expect(dd.s.cls).toBe("STAY_ALERT");
  });
  it("auto-exits after 60 s continuously in Comfortable cells", () => {
    d.at(650, 1000); d.at(660, 6000); expect(d.s.phase).toBe("GUARD");
    d.at(950, 10_000); d.at(960, 69_000); expect(d.s.phase).toBe("GUARD");
    const fx = d.at(970, 70_000);
    expect(d.s.phase).toBe("JOURNEY");
    expect(fx).toContainEqual({ type: "EXIT_GUARD_UI" }); expect(say(fx)[0]!.messageKey).toBe("guard_off");
  });
  it("re-entering a non-comfortable cell restarts the 60 s exit clock", () => {
    d.at(650, 1000); d.at(660, 6000);
    d.at(950, 10_000); d.at(700, 40_000); d.at(960, 50_000); d.at(970, 100_000);
    expect(d.s.phase).toBe("GUARD");
    d.at(980, 110_000); expect(d.s.phase).toBe("JOURNEY");
  });
  it("manual Guard never exits automatically but exits on demand", () => {
    d.send({ type: "MANUAL_GUARD_ON", t: 0 });
    d.at(100, 1000); d.at(110, 200_000); expect(d.s.phase).toBe("GUARD");
    d.send({ type: "MANUAL_GUARD_OFF", t: 300_000 }); expect(d.s.phase).toBe("JOURNEY");
  });
  it("manual Guard from IDLE returns to IDLE and releases the wake lock", () => {
    const dd = new Driver(); const on = dd.send({ type: "MANUAL_GUARD_ON", t: 0 });
    expect(dd.s.phase).toBe("GUARD"); expect(on).toContainEqual({ type: "WAKE_LOCK", on: true });
    expect(dd.send({ type: "MANUAL_GUARD_OFF", t: 5 })).toContainEqual({ type: "WAKE_LOCK", on: false });
    expect(dd.s.phase).toBe("IDLE");
  });
  it("ending Guard by hand inside an Extra-care cell does not bounce straight back in", () => {
    d.at(650, 1000); d.at(660, 6000); expect(d.s.phase).toBe("GUARD");
    d.send({ type: "MANUAL_GUARD_OFF", t: 7000 }); expect(d.s.phase).toBe("JOURNEY");
    d.at(670, 12_000); d.at(680, 18_000); d.tick(30_000);
    expect(d.s.phase).toBe("JOURNEY");                       // suppressed for 2 minutes
    d.at(690, 130_000); d.at(700, 136_000);
    expect(d.s.phase).toBe("GUARD");                          // …then protection resumes
  });
  it("auto Guard becomes manual if the user also presses Guard", () => {
    d.at(650, 1000); d.at(660, 6000); d.send({ type: "MANUAL_GUARD_ON", t: 7000 });
    expect(d.s.guard!.manual).toBe(true);
  });
});

describe("check-ins", () => {
  beforeEach(() => d.start());
  it("off-route > 150 m for > 60 s asks if she is okay", () => {
    d.at(300, 1000, {}, LAT0 + 0.002); expect(d.s.offRouteSince).toBe(1000);
    d.at(310, 61_000, {}, LAT0 + 0.002); expect(d.s.phase).toBe("JOURNEY");
    const fx = d.at(320, 61_001, {}, LAT0 + 0.002);
    expect(d.s.phase).toBe("CHECK_IN");
    expect(fx).toContainEqual({ type: "HAPTIC", pattern: [200, 100, 200, 100, 200] });
    expect(say(fx)[0]).toMatchObject({ messageKey: "check_in_offroute", priority: "checkin" });
  });
  it("returning to the route within 60 s cancels the timer", () => {
    d.at(300, 1000, {}, LAT0 + 0.002); d.at(310, 30_000); d.at(320, 100_000);
    expect(d.s.phase).toBe("JOURNEY");
  });
  it("an unexpected stop (> 180 s) in a Stay-alert/Extra-care cell triggers a check-in", () => {
    d.at(650, 1000, { speed: 0 }); d.tick(181_001);
    expect(d.s.phase).toBe("CHECK_IN"); expect(d.s.checkIn!.reason).toBe("stopped");
  });
  it("derives speed from displacement when the GPS gives none", () => {
    d.at(650, 1000, { speed: null }); d.at(650, 5000, { speed: null }); expect(d.s.stoppedSince).toBe(5000);
    d.at(700, 6000, { speed: null }); expect(d.s.stoppedSince).toBeUndefined();
  });
  it("does not check in when stopped on a comfortable street or near the destination", () => {
    d.at(300, 1000, { speed: 0 }); d.tick(400_000); expect(d.s.phase).toBe("JOURNEY");
    const dd = new Driver({ ...ctx, lookup: zoneLookup([{ from: 0, to: 3000, score: CARE }]) });
    dd.start(); dd.at(1950, 1000, { speed: 0 }); dd.tick(400_000);
    expect(dd.s.phase).not.toBe("CHECK_IN");
  });
  it("USER_OK dismisses the check-in and keeps Guard if it was on", () => {
    d.send({ type: "MANUAL_GUARD_ON", t: 0 });
    d.at(650, 1000, { speed: 0 }); d.tick(190_000); expect(d.s.phase).toBe("CHECK_IN");
    const fx = d.send({ type: "USER_OK", t: 195_000 });
    expect(d.s.phase).toBe("GUARD"); expect(say(fx)[0]!.messageKey).toBe("check_in_ok");
    expect(d.send({ type: "USER_OK", t: 196_000 })).toEqual([]);
  });
  it("no reply within 60 s sends a soft alert to the circle and stays in Guard", () => {
    d.at(650, 1000, { speed: 0 }); d.tick(185_000);
    expect(d.s.phase).toBe("CHECK_IN"); d.tick(244_999); expect(d.s.phase).toBe("CHECK_IN");
    const fx = d.tick(245_000);
    expect(d.s.phase).toBe("GUARD");
    expect(fx).toEqual(expect.arrayContaining([{ type: "NOTIFY_CIRCLE", kind: "checkin_missed" }, { type: "START_SHARE", kind: "live" }]));
    expect(say(fx)[0]!.messageKey).toBe("soft_alert_sent");
  });
  it("walk-with-me timer: deadline → check-in (30 s) → countdown → SOS", () => {
    const deadline = d.s.timerDeadline!;
    d.tick(deadline - 1); expect(d.s.phase).toBe("JOURNEY");
    d.tick(deadline); expect(d.s.phase).toBe("CHECK_IN"); expect(d.s.checkIn!.reason).toBe("timer");
    d.tick(deadline + 29_999); expect(d.s.phase).toBe("CHECK_IN");
    d.tick(deadline + 30_000); expect(d.s.phase).toBe("SOS_COUNTDOWN"); expect(d.s.countdown!.trigger).toBe("timer");
    const fx = d.tick(deadline + 33_000);
    expect(d.s.phase).toBe("SOS_ACTIVE"); expect(fx).toContainEqual({ type: "START_SOS", trigger: "timer", mode: "silent" });
  });
  it("answering a timer check-in extends the deadline by 10 minutes", () => {
    const deadline = d.s.timerDeadline!; d.tick(deadline);
    d.send({ type: "USER_OK", t: deadline + 5000 });
    expect(d.s.timerDeadline).toBe(deadline + 5000 + 600_000);
  });
  it("TIMER_EXPIRED from the host behaves like the deadline", () => {
    d.send({ type: "TIMER_EXPIRED", t: 5 }); expect(d.s.phase).toBe("CHECK_IN");
    const idle = new Driver(); idle.send({ type: "TIMER_EXPIRED", t: 5 }); expect(idle.s.phase).toBe("IDLE");
  });
});

describe("SOS", () => {
  it("hold-to-SOS goes straight to SOS_ACTIVE with the full effect set (silent)", () => {
    const fx = d.send({ type: "HOLD_SOS_COMPLETE", t: 5 });
    expect(d.s.phase).toBe("SOS_ACTIVE");
    expect(fx).toEqual(expect.arrayContaining([
      { type: "START_SOS", trigger: "hold", mode: "silent" }, { type: "START_SHARE", kind: "sos" }, { type: "START_RECORDING" },
      { type: "WAKE_LOCK", on: true }, { type: "NOTIFY_CIRCLE", kind: "sos" }, { type: "HAPTIC", pattern: [400, 150, 400] },
    ]));
    expect(say(fx)[0]).toMatchObject({ messageKey: "sos_active_silent", audible: false, priority: "sos" });
    expect(d.send({ type: "HOLD_SOS_COMPLETE", t: 6 })).toEqual([]);
  });
  it("loud mode speaks and uses the loud message", () => {
    const fx = d.send({ type: "HOLD_SOS_COMPLETE", t: 5, mode: "loud" });
    expect(say(fx)[0]).toMatchObject({ messageKey: "sos_active_loud", audible: true });
    expect(fx).toContainEqual({ type: "START_SOS", trigger: "hold", mode: "loud" });
  });
  it("hold during the countdown activates immediately", () => {
    d.start(); d.send({ type: "SHAKE_DETECTED", t: 1000 }); d.send({ type: "HOLD_SOS_COMPLETE", t: 1500 });
    expect(d.s.phase).toBe("SOS_ACTIVE");
  });
  it("shake → 3 s cancellable countdown with per-second ticks → SOS", () => {
    d.start();
    const fx = d.send({ type: "SHAKE_DETECTED", t: 1000 });
    expect(d.s.phase).toBe("SOS_COUNTDOWN");
    expect(say(fx)[0]!.messageKey).toBe("sos_countdown");
    expect(d.tick(1500)).toEqual([]);
    expect(d.tick(2100)).toContainEqual({ type: "HAPTIC", pattern: [40] });
    expect(d.tick(3200)).toContainEqual({ type: "HAPTIC", pattern: [40] });
    const end = d.tick(4000);
    expect(d.s.phase).toBe("SOS_ACTIVE"); expect(end).toContainEqual({ type: "START_SOS", trigger: "shake", mode: "silent" });
  });
  it("a tap cancels the countdown with no PIN and returns to where she was", () => {
    d.start(); d.send({ type: "MANUAL_GUARD_ON", t: 10 });
    d.send({ type: "SHAKE_DETECTED", t: 1000 }); d.send({ type: "COUNTDOWN_CANCELLED", t: 1500 });
    expect(d.s.phase).toBe("GUARD");
    expect(d.send({ type: "COUNTDOWN_CANCELLED", t: 1600 })).toEqual([]);
  });
  it("shake is only armed during a journey / Guard unless 'always armed'", () => {
    d.send({ type: "SHAKE_DETECTED", t: 1 }); expect(d.s.phase).toBe("IDLE");
    const armed = new Driver({ ...ctx, shakeAlwaysArmed: true }); armed.send({ type: "SHAKE_DETECTED", t: 1 });
    expect(armed.s.phase).toBe("SOS_COUNTDOWN");
  });
  it("shake during a check-in returns to the pre-check-in phase when cancelled", () => {
    d.start(); d.send({ type: "TIMER_EXPIRED", t: 5 }); d.send({ type: "SHAKE_DETECTED", t: 6 });
    expect(d.s.phase).toBe("SOS_COUNTDOWN"); d.send({ type: "COUNTDOWN_CANCELLED", t: 7 });
    expect(d.s.phase).toBe("JOURNEY");
  });

  describe("cancelling", () => {
    beforeEach(() => { d.send({ type: "HOLD_SOS_COMPLETE", t: 0 }); });
    it("correct PIN resolves SOS", () => {
      const fx = d.send({ type: "SOS_CANCEL", t: 10, pinResult: "ok" });
      expect(d.s.phase).toBe("RESOLVED");
      expect(fx).toEqual(expect.arrayContaining([{ type: "STOP_SOS", duress: false }, { type: "WAKE_LOCK", on: false }]));
      d.send({ type: "RESET", t: 11 }); expect(d.s.phase).toBe("IDLE");
    });
    it("a new journey can start after RESOLVED", () => {
      d.send({ type: "SOS_CANCEL", t: 10, pinResult: "ok" }); d.start(20);
      expect(d.s.phase).toBe("JOURNEY");
    });
    it("duress PIN looks cancelled, keeps SOS active, and emits no sound or vibration", () => {
      const fx = d.send({ type: "SOS_CANCEL", t: 10, pinResult: "duress" });
      expect(d.s.phase).toBe("SOS_DURESS");
      expect(fx).toEqual(expect.arrayContaining([{ type: "STOP_SOS", duress: true }, { type: "NOTIFY_CIRCLE", kind: "coercion" }]));
      expect(fx.some((e) => e.type === "SAY" || e.type === "HAPTIC")).toBe(false);
      d.at(100, 20); expect(d.s.phase).toBe("SOS_DURESS");               // location still tracked, phase unchanged
      expect(d.send({ type: "HOLD_SOS_COMPLETE", t: 30 })).toEqual([]);
      d.send({ type: "SOS_CANCEL", t: 40, pinResult: "duress" }); expect(d.s.phase).toBe("SOS_DURESS");
      d.send({ type: "SOS_CANCEL", t: 50, pinResult: "ok" }); expect(d.s.phase).toBe("RESOLVED");
    });
    it("three wrong PINs keep SOS active and lock cancelling for 30 s", () => {
      expect(card(d.send({ type: "SOS_CANCEL", t: 10, pinResult: "wrong" }), "pin_wrong")!.data.attemptsLeft).toBe(2);
      d.send({ type: "SOS_CANCEL", t: 11, pinResult: "wrong" });
      expect(card(d.send({ type: "SOS_CANCEL", t: 12, pinResult: "wrong" }), "pin_locked")).toBeDefined();
      expect(d.s.phase).toBe("SOS_ACTIVE");
      expect(card(d.send({ type: "SOS_CANCEL", t: 20_000, pinResult: "ok" }), "pin_locked")).toBeDefined();
      expect(d.s.phase).toBe("SOS_ACTIVE");
      d.send({ type: "SOS_CANCEL", t: 12 + 30_000, pinResult: "ok" }); expect(d.s.phase).toBe("RESOLVED");
    });
    it("cancel events outside SOS are ignored", () => {
      expect(new Driver().send({ type: "SOS_CANCEL", t: 1, pinResult: "ok" })).toEqual([]);
    });
    it("journey events cannot override an active SOS", () => {
      expect(d.start(5)).toEqual([]); expect(d.s.phase).toBe("SOS_ACTIVE");
      d.send({ type: "ARRIVED", t: 6 }); expect(d.s.phase).toBe("SOS_ACTIVE");
      d.send({ type: "SHAKE_DETECTED", t: 7 }); expect(d.s.phase).toBe("SOS_ACTIVE");
    });
  });
});

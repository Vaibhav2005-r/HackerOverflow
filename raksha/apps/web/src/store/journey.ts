import { create } from "zustand";
import {
  assessRoute, bandForDate, chooseRoutes, classifyPin, explainStretches, initialState, Messenger, reduce, shareUrl,
  type Band, type EngineContext, type EngineEvent, type EngineState, type Effect, type LngLat, type MessageKey, type Mode,
  type MessageRef, type PinResult, type RouteAssessment, type RouteChoice, type SosMode,
} from "@raksha/core";
import { getBackend } from "../services/backend";
import { getFixtures, type RouteWithSteps, type Step } from "../services/fixtures";
import { useCity } from "./city";
import { useSettings } from "./settings";
import { useSession } from "./session";
import { nextNonce, useMapUi, type OrbState } from "./mapUi";
import { clock } from "../lib/clock";
import { navigate } from "../lib/router";
import { vibrate } from "../device/haptics";
import { setWakeLock } from "../device/wakeLock";
import { speak } from "../device/speech";
import { startShakeListening, stopShakeListening } from "../device/motion";
import { watchPosition } from "../device/geolocation";
import { startSiren, stopSiren } from "../device/siren";
import { onRecorderChange, startRecording, stopRecording, type RecorderStatus } from "../device/recorder";
import { toast } from "./toast";
import { startSimulation, type SimHandle } from "../demo/simulator";
import { tNow } from "../i18n";
import { cumulative, sliceLine, snapToLine } from "@raksha/core";

export interface PlanState {
  from: LngLat; fromName: string; to: LngLat; toName: string; mode: Mode;
  status: "loading" | "ready" | "error" | "empty";
  assessments: RouteAssessment[]; choice?: RouteChoice; selectedId?: string;
  steps: Record<string, Step[]>;
}
export interface ArrivedInfo { minutes: number; km: number; guarded: number }
export interface ShareInfo { sessionId: string; token: string; url: string }
export interface SosInfo extends Partial<ShareInfo> { sosId?: string; mode: SosMode; trigger: string; duress: boolean; starting: boolean; failed?: boolean }
export interface Card { name: string; data: Record<string, unknown>; n: number }

interface JourneyStore {
  engine: EngineState;
  plan: PlanState | null;
  sakhi: { text: string; n: number };
  card: Card | null;
  user: { lat: number; lng: number; accuracy: number; heading?: number | null } | null;
  share: ShareInfo | null;
  sos: SosInfo | null;
  simulating: boolean;
  simStopped: boolean;
  resolvedOpen: boolean;
  arrived: ArrivedInfo | null;
  siren: boolean;
  sosShared: boolean;
  shakeArmed: boolean;
  recorder: { status: RecorderStatus; startedAt: number };
  set: (p: Partial<Omit<JourneyStore, "set">>) => void;
}

export const useJourney = create<JourneyStore>((set) => ({
  engine: initialState("night", Date.now()),
  plan: null, sakhi: { text: "", n: 0 }, card: null, user: null, share: null, sos: null, simulating: false, simStopped: false,
  resolvedOpen: false, arrived: null, siren: false, sosShared: false, shakeArmed: false, recorder: { status: "idle", startedAt: 0 },
  set: (p) => set(p),
}));
const J = () => useJourney.getState();

const messenger = new Messenger("en");
let rawRoutes: RouteWithSteps[] = [];
let tipMap = new Map<string, MessageRef | null>();
let sim: SimHandle | null = null;
let planAbort: AbortController | null = null;

export function effectiveBand(): Band {
  const s = useSettings.getState().demoBand;
  return s === "auto" ? bandForDate(new Date()) : s;
}

function ctx(): EngineContext {
  const s = useSettings.getState();
  return {
    lookup: useCity.getState().lookup,
    profile: { name: s.name || undefined, contact: useSession.getState().circle[0]?.name },
    sosMode: s.sosMode, shakeAlwaysArmed: s.shakeAlwaysArmed,
    tipFor: (st) => tipMap.get(st.id) ?? null,
  };
}

export function orbStateOf(e: EngineState): OrbState {
  if (e.phase === "SOS_ACTIVE" || e.phase === "SOS_COUNTDOWN") return "sos";
  if (e.phase === "GUARD") return "guard";
  if (e.cls === "EXTRA_CARE" || e.cls === "STAY_ALERT" || e.phase === "HEADS_UP" || e.phase === "CHECK_IN") return "headsUp";
  return "idle";
}

/** Say a message-bank line as Sakhi (used outside the engine, e.g. greetings and route picks). */
export function sayKey(key: MessageKey, params: Record<string, string | number> = {}) {
  const s = useSettings.getState();
  const text = messenger.say(key, { ...(s.name ? { name: s.name } : {}), ...params });
  useJourney.setState({ sakhi: { text, n: J().sakhi.n + 1 } });
}
export function greet() {
  const b = effectiveBand();
  sayKey(b === "day" ? "greet_afternoon" : b === "evening" ? "greet_evening" : "greet_night");
}

// ---------- engine dispatch & effects ----------
export function dispatch(ev: EngineEvent) {
  const { state, effects } = reduce(J().engine, ev, ctx());
  useJourney.setState({ engine: state });
  syncUserState();
  runEffects(effects);
}

let cardN = 0;
const showCard = (name: string, data: Record<string, unknown> = {}) => useJourney.setState({ card: { name, data, n: ++cardN } });
export const dismissCard = () => useJourney.setState({ card: null });

function runEffects(effects: Effect[]) {
  for (const e of effects) {
    switch (e.type) {
      case "SAY": {
        let text: string;
        try { text = messenger.say(e.messageKey as MessageKey, e.params); } catch { break; }
        useJourney.setState({ sakhi: { text, n: J().sakhi.n + 1 } });
        if (e.audible && useSettings.getState().voice) speak(text, useSettings.getState().lang);
        break;
      }
      case "HAPTIC": vibrate(e.pattern); break;
      case "SHOW_CARD": showCard(e.card, e.data); break;
      case "ENTER_GUARD_UI": useMapUi.getState().set({ guard: true }); navigate("/guard"); break;
      case "EXIT_GUARD_UI": useMapUi.getState().set({ guard: false }); navigate(J().engine.route ? "/journey" : "/"); break;
      case "START_SHARE": if (e.kind !== "sos") void ensureLiveShare(); break;
      case "START_SOS": void beginSos(e.trigger, e.mode); break;
      case "STOP_SOS": void endSos(e.duress); break;
      case "WAKE_LOCK": setWakeLock(e.on); break;
      case "NOTIFY_CIRCLE": if (e.kind === "checkin_missed") showCard("share_prompt", { reason: "checkin_missed" }); break;
      case "START_RECORDING": break; // started in beginSos once the SOS id is known
    }
  }
}

// ---------- live share & SOS ----------
export async function ensureLiveShare(): Promise<ShareInfo | null> {
  if (J().share) return J().share;
  try {
    const r = await getBackend().startShare("live", 120, useSettings.getState().name || "Someone");
    const info = { ...r, url: shareUrl(location.origin, r.token) };
    useJourney.setState({ share: info });
    pushNow(info.sessionId);
    return info;
  } catch { return null; }
}

async function beginSos(trigger: string, mode: SosMode) {
  useMapUi.getState().set({ guard: false });
  useJourney.setState({ sos: { trigger, mode, duress: false, starting: true }, sosShared: false, resolvedOpen: false });
  navigate("/sos");
  if (mode === "loud") { startSiren(); useJourney.setState({ siren: true }); }
  let sosId = "local";
  try {
    const r = await getBackend().startSos(trigger as never, mode, useSettings.getState().name || "Someone");
    sosId = r.sosId;
    useJourney.setState((s) => ({ sos: { ...(s.sos ?? { trigger, mode, duress: false }), starting: false, ...r, url: shareUrl(location.origin, r.token) } }));
    pushNow(r.sessionId);
  } catch {
    // offline: the SOS screen falls back to call 112 / SMS deep links
    useJourney.setState((s) => ({ sos: { ...(s.sos ?? { trigger, mode, duress: false }), starting: false, failed: true } }));
  }
  void startRecording(sosId);
}

export function setSosMode(mode: SosMode) {
  const sos = J().sos;
  if (!sos) return;
  useJourney.setState({ sos: { ...sos, mode } });
  if (mode === "loud") { startSiren(); useJourney.setState({ siren: true }); } else { stopSiren(); useJourney.setState({ siren: false }); }
}
export function toggleSiren() {
  if (J().siren) { stopSiren(); useJourney.setState({ siren: false }); } else { startSiren(); useJourney.setState({ siren: true }); }
}
export const markSosShared = () => useJourney.setState({ sosShared: true });

async function endSos(duress: boolean) {
  const sos = J().sos;
  stopSiren(); stopRecording();
  useJourney.setState({ siren: false, resolvedOpen: true });
  if (sos?.sosId) { try { await getBackend().resolveSos(sos.sosId, duress); } catch { /* retried by host in Supabase mode */ } }
  // duress: the session stays alive in the background; the UI is identical to a real cancel
  useJourney.setState(duress ? { sos: sos ? { ...sos, duress: true } : null } : { sos: null, share: null });
  navigate("/");
}
export const closeResolved = () => { useJourney.setState({ resolvedOpen: false }); navigate("/", true); };

export async function submitPin(pin: string): Promise<PinResult> {
  const { pin: normal, duress } = useSettings.getState();
  const result: PinResult = normal && duress ? await classifyPin(pin, normal, duress) : "ok";
  dispatch({ type: "SOS_CANCEL", t: clock.now(), pinResult: result });
  return result;
}

// ---------- location pipeline ----------
let lastPush = 0;
export function onFix(f: { lat: number; lng: number; accuracy: number; speed?: number | null; heading?: number | null; t?: number }) {
  useJourney.setState({ user: { lat: f.lat, lng: f.lng, accuracy: f.accuracy, heading: f.heading } });
  const t = clock.now();
  dispatch({ type: "POSITION", t, fix: { lat: f.lat, lng: f.lng, accuracy: f.accuracy, speed: f.speed, heading: f.heading, t } });
  const j = J();
  const sessionId = j.sos?.sessionId ?? j.share?.sessionId;
  if (sessionId && performance.now() - lastPush > 3000) {
    lastPush = performance.now();
    void pushPoint(sessionId, f);
  }
}
/** A stationary phone sends no new fixes, so publish the last known position the moment a session starts. */
function pushNow(sessionId: string) {
  const u = J().user;
  if (u) { lastPush = performance.now(); void pushPoint(sessionId, u); }
}
async function pushPoint(sessionId: string, f: { lat: number; lng: number; accuracy: number }) {
  let battery: number | undefined;
  try { battery = (await (navigator as Navigator & { getBattery?: () => Promise<{ level: number }> }).getBattery?.())?.level; } catch { /* unsupported */ }
  await getBackend().pushPoint(sessionId, { lat: f.lat, lng: f.lng, accuracy: f.accuracy, battery, t: Date.now() }).catch(() => {});
}

let stopGps: (() => void) | null = null;
export function startLocation() {
  stopGps?.();
  stopGps = watchPosition((f) => { if (!J().simulating) onFix(f); }, () => {});
}

function syncUserState() {
  const j = J();
  if (!j.user) return;
  useMapUi.getState().set({ user: { ...j.user, state: orbStateOf(j.engine) } });
}

// ---------- planning ----------
function mapRoutes(assessments: RouteAssessment[], selectedId?: string) {
  useMapUi.getState().set({ routes: assessments.map((a) => ({ id: a.id, segments: a.segmentsForMap, selected: a.id === selectedId })) });
}

function fitTo(coords: LngLat[]) {
  const xs = coords.map((c) => c[0]), ys = coords.map((c) => c[1]);
  useMapUi.getState().set({ fit: { bounds: [[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], nonce: nextNonce() } });
}

function assessAll(mode: Mode): RouteAssessment[] {
  const band = effectiveBand(), lookup = useCity.getState().lookup;
  return rawRoutes.map((r) => assessRoute(r, band, lookup, mode));
}

function computeTips(a: RouteAssessment) {
  const spots = useCity.getState().spots;
  tipMap = new Map(explainStretches(a, spots).map((x) => [x.stretchId, x.tip]));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function planRoute(from: LngLat, fromName: string, to: LngLat, toName: string, mode: Mode = "walk") {
  planAbort?.abort(); planAbort = new AbortController();
  useJourney.setState({ plan: { from, fromName, to, toName, mode, status: "loading", assessments: [], steps: {} } });
  useMapUi.getState().set({ dest: { lng: to[0], lat: to[1] }, routes: [] });
  dispatch({ type: "PLAN_STARTED", t: clock.now() });
  navigate("/plan");
  try {
    // Sakhi "thinks" for at least 1.5 s so the skeleton → routes transition reads as deliberate
    const [routes] = await Promise.all([import("../services/routing").then((r) => r.fetchRoutes(from, to, mode, planAbort!.signal)), sleep(1500)]);
    rawRoutes = routes;
    if (!rawRoutes.length) { useJourney.setState((s) => ({ plan: s.plan && { ...s.plan, status: "empty" } })); return; }
    const assessments = assessAll(mode);
    const choice = chooseRoutes(assessments);
    const steps = Object.fromEntries(rawRoutes.map((r) => [r.id, r.steps ?? []]));
    useJourney.setState((s) => ({ plan: s.plan && { ...s.plan, status: "ready", assessments, choice, selectedId: choice.safest.id, steps } }));
    mapRoutes(assessments, choice.safest.id);
    fitTo(rawRoutes.flatMap((r) => r.coords));
    announcePick(choice.safest, choice);
  } catch (e) {
    if ((e as Error).name === "AbortError") return;
    useJourney.setState((s) => ({ plan: s.plan && { ...s.plan, status: "error" } }));
  }
}

function announcePick(a: RouteAssessment, choice: RouteChoice) {
  const extra = Math.max(0, Math.round((a.durationS - choice.fastest.durationS) / 60));
  sayKey("route_ready", { minutes: extra, litPct: Math.round(a.litFrac * 100) });
}

export function planPreset(id: string) {
  const p = getFixtures().find((x) => x.id === id);
  if (!p) return;
  void planRoute([p.from.lng, p.from.lat], p.from.name, [p.to.lng, p.to.lat], p.to.name, "walk");
}

export function selectRoute(id: string) {
  const plan = J().plan;
  if (!plan) return;
  useJourney.setState({ plan: { ...plan, selectedId: id } });
  mapRoutes(plan.assessments, id);
  const a = plan.assessments.find((x) => x.id === id);
  if (a && plan.choice) announcePick(a, plan.choice);
}

export function clearPlan() {
  planAbort?.abort();
  useJourney.setState({ plan: null });
  useMapUi.getState().set({ routes: [], follow: false, dest: undefined });
}

// ---------- journey ----------
export function startJourney(simulate: boolean, resumeAt?: LngLat) {
  const plan = J().plan;
  const chosen = plan?.assessments.find((a) => a.id === plan.selectedId);
  if (!plan || !chosen) return;
  computeTips(chosen);
  const others = plan.assessments.filter((a) => a.id !== chosen.id);
  const speed = useSettings.getState().simSpeed;
  if (simulate) { clock.setSpeed(speed); useJourney.setState({ simulating: true, simStopped: false }); } else clock.setSpeed(1);
  dispatch({ type: "ROUTE_STARTED", t: clock.now(), assessment: chosen, alternatives: others, mode: plan.mode });
  const st = useSettings.getState();
  if (!st.checkLate) dispatch({ type: "TIMER_SET", t: clock.now(), deadlineT: Number.MAX_SAFE_INTEGER });
  if (st.shareWalk) void ensureLiveShare();
  mapRoutes([chosen], chosen.id);
  useMapUi.getState().set({ follow: true });
  navigate("/journey");
  armShake();
  if (simulate) {
    // after a detour the simulated walker carries on from where she is, not from the start of the new route
    let walk = chosen.coords;
    if (resumeAt) { const cum = cumulative(walk); walk = sliceLine(walk, cum, snapToLine(walk, resumeAt, cum).distAlongM, cum.at(-1) ?? 0); }
    onFix({ lat: walk[0]![1], lng: walk[0]![0], accuracy: 8, speed: 0 });
    sim = startSimulation(walk, plan.mode === "walk" ? 1.4 : 7, (f) => onFix(f), () => arrive());
  }
}

export function setSimStopped(b: boolean) { sim?.setStopped(b); useJourney.setState({ simStopped: b }); }

export function arrive() {
  const j = J();
  const route = j.engine.route;
  const info: ArrivedInfo | null = route ? {
    minutes: Math.max(1, Math.round(route.assessment.durationS / 60)), km: +(route.assessment.distanceM / 1000).toFixed(1),
    guarded: route.assessment.stretches.length,
  } : null;
  sim?.stop(); sim = null;
  clock.setSpeed(1);
  stopShakeListening(); useJourney.setState({ shakeArmed: false });
  useJourney.setState({ simulating: false, simStopped: false });
  dispatch({ type: "ARRIVED", t: clock.now() });
  useMapUi.getState().set({ follow: false, routes: [], guard: false, dest: undefined });
  useJourney.setState({ plan: null, arrived: info });
  navigate("/");
}
export const closeArrived = () => useJourney.setState({ arrived: null });

function armShake() {
  startShakeListening(() => dispatch({ type: "SHAKE_DETECTED", t: clock.now() }));
  useJourney.setState({ shakeArmed: true });
}

export function manualGuard(on: boolean) {
  if (on && !J().shakeArmed) armShake();
  dispatch({ type: on ? "MANUAL_GUARD_ON" : "MANUAL_GUARD_OFF", t: clock.now() });
  if (!on && !J().engine.route) { stopShakeListening(); useJourney.setState({ shakeArmed: false }); }
}
export function userOk() { dismissCard(); dispatch({ type: "USER_OK", t: clock.now() }); }
export function holdSosComplete() { dispatch({ type: "HOLD_SOS_COMPLETE", t: clock.now() }); }
export function cancelCountdown() { dismissCard(); dispatch({ type: "COUNTDOWN_CANCELLED", t: clock.now() }); }
export function simulateShake() { dispatch({ type: "SHAKE_DETECTED", t: clock.now() }); }

export function takeDetour(routeId: string) {
  const j = J();
  const alt = j.plan?.assessments.find((a) => a.id === routeId);
  if (!j.plan || !alt) return;
  dismissCard();
  // continue on the alternative from the current position
  sim?.stop();
  useJourney.setState({ plan: { ...j.plan, selectedId: routeId } });
  startJourney(j.simulating, j.user ? [j.user.lng, j.user.lat] : undefined);
  toast(tNow("journey.rerouted"));
}

// ---------- background loops ----------
const TICKING = new Set(["JOURNEY", "HEADS_UP", "GUARD", "CHECK_IN", "SOS_COUNTDOWN"]);
let started = false;
export function initRuntime() {
  if (started) return;
  started = true;
  setInterval(() => { if (TICKING.has(J().engine.phase)) dispatch({ type: "TICK", t: clock.now() }); }, 1000);
  // follow the demo "pretend it's" setting
  let lastBand = effectiveBand();
  const apply = () => {
    const b = effectiveBand();
    if (b === lastBand) return;
    lastBand = b;
    dispatch({ type: "BAND_CHANGED", t: clock.now(), band: b });
    const plan = J().plan;
    if (plan?.status === "ready" && rawRoutes.length) {
      const assessments = assessAll(plan.mode);
      const choice = chooseRoutes(assessments);
      useJourney.setState({ plan: { ...plan, assessments, choice, selectedId: plan.selectedId && assessments.some((a) => a.id === plan.selectedId) ? plan.selectedId : choice.safest.id } });
      mapRoutes(assessments, J().plan?.selectedId);
    }
  };
  useSettings.subscribe(apply);
  useCity.subscribe(apply);
  useJourney.setState({ engine: { ...J().engine, band: effectiveBand() } });
  onRecorderChange((status, startedAt) => useJourney.setState({ recorder: { status, startedAt } }));
}

export const t = tNow;
export { toast };

// ---------- destination picking ----------
export const DEMO_ORIGIN: LngLat = [72.8746, 19.206]; // TCET, inside the demo area
export interface PlaceLite { name: string; detail?: string; lng: number; lat: number }

/** Plan from her location when it is inside the covered area, otherwise from the demo start. */
export function planTo(p: PlaceLite) {
  const { user } = J();
  const meta = useCity.getState().meta;
  const inside = !!(user && meta && user.lat >= meta.bbox[0] && user.lat <= meta.bbox[2] && user.lng >= meta.bbox[1] && user.lng <= meta.bbox[3]);
  const set = useSettings.getState();
  set.set({ recents: [{ name: p.name, detail: p.detail, lng: p.lng, lat: p.lat }, ...set.recents.filter((r) => r.name !== p.name)].slice(0, 5) });
  void planRoute(inside && user ? [user.lng, user.lat] : DEMO_ORIGIN, inside ? "My location" : "Demo start (TCET)", [p.lng, p.lat], p.name, "walk");
}

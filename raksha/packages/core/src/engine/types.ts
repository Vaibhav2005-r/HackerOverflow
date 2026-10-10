import type { LngLat } from "../util/geo";
import type { CellLookup } from "../scoring/lookup";
import { type SafetyClass } from "../scoring/types";
import type { MessageRef, Mode, RouteAssessment, Stretch } from "../route/analyze";
import type { PinResult } from "../sos/pin";
import type { Band } from "../util/time";

export type Phase =
  | "IDLE" | "PLANNING" | "JOURNEY" | "HEADS_UP" | "GUARD" | "CHECK_IN"
  | "SOS_COUNTDOWN" | "SOS_ACTIVE" | "SOS_DURESS" | "RESOLVED";

export type SosTrigger = "hold" | "shake" | "timer" | "checkin" | "manual";
export type SosMode = "silent" | "loud";
export type CheckInReason = "stopped" | "offroute" | "timer";
export type Priority = "info" | "headsup" | "checkin" | "sos";
export const PRIORITY_RANK: Record<Priority, number> = { info: 0, headsup: 1, checkin: 2, sos: 3 };

export interface Fix { lat: number; lng: number; accuracy: number; speed?: number | null; heading?: number | null; t: number }

export type EngineEvent =
  | { type: "POSITION"; t: number; fix: Fix }
  | { type: "TICK"; t: number }
  | { type: "PLAN_STARTED"; t: number }
  | { type: "ROUTE_STARTED"; t: number; assessment: RouteAssessment; alternatives?: RouteAssessment[]; mode?: Mode }
  | { type: "ARRIVED"; t: number }
  | { type: "USER_OK"; t: number }
  | { type: "MANUAL_GUARD_ON"; t: number }
  | { type: "MANUAL_GUARD_OFF"; t: number }
  | { type: "HOLD_SOS_COMPLETE"; t: number; mode?: SosMode }
  | { type: "SHAKE_DETECTED"; t: number }
  | { type: "COUNTDOWN_CANCELLED"; t: number }
  | { type: "TIMER_EXPIRED"; t: number }
  | { type: "TIMER_SET"; t: number; deadlineT: number }
  | { type: "SOS_CANCEL"; t: number; pinResult: PinResult }
  | { type: "BAND_CHANGED"; t: number; band: Band }
  | { type: "RESET"; t: number };

export type Effect =
  | { type: "SAY"; messageKey: string; params: Record<string, string | number>; priority: Priority; audible: boolean }
  | { type: "HAPTIC"; pattern: number[] }
  | { type: "SHOW_CARD"; card: string; data: Record<string, unknown> }
  | { type: "ENTER_GUARD_UI" } | { type: "EXIT_GUARD_UI" }
  | { type: "START_SHARE"; kind: "live" | "walk" | "sos" }
  | { type: "START_SOS"; trigger: SosTrigger; mode: SosMode }
  | { type: "STOP_SOS"; duress: boolean }
  | { type: "START_RECORDING" }
  | { type: "NOTIFY_CIRCLE"; kind: "checkin_missed" | "arrived" | "sos" | "coercion" }
  | { type: "WAKE_LOCK"; on: boolean };

export interface ActiveRoute {
  assessment: RouteAssessment; alternatives: RouteAssessment[]; mode: Mode;
  destination: LngLat; cum: number[];
}

export interface EngineState {
  phase: Phase;
  now: number;
  band: Band;
  position?: Fix;
  display?: { lat: number; lng: number };
  cls?: SafetyClass;
  route?: ActiveRoute;
  snap?: { alongM: number; offsetM: number };
  headsUpShown: string[];
  headsUp?: { stretchId: string; expiresT: number };
  guard?: { manual: boolean; since: number };
  extraStreak?: { count: number; firstT: number; lastT: number };
  isoSince?: number;
  comfortableSince?: number;
  guardSuppressedUntil?: number;
  offRouteSince?: number;
  stoppedSince?: number;
  timerDeadline?: number;
  checkIn?: { reason: CheckInReason; deadlineT: number; returnPhase: Phase };
  countdown?: { endT: number; trigger: SosTrigger; returnPhase: Phase; lastRemaining: number };
  sos?: { trigger: SosTrigger; mode: SosMode; startedT: number; wrongPins: number; lockUntil: number };
}

export interface EngineContext {
  lookup: CellLookup;
  profile?: { name?: string; contact?: string };
  sosMode?: SosMode;
  shakeAlwaysArmed?: boolean;
  tipFor?: (s: Stretch) => MessageRef | null;
}

export interface EngineResult { state: EngineState; effects: Effect[] }

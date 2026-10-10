import { create } from "zustand";
import { primeAudio, startRing, stopRing } from "../device/ringtone";
import { speak, stopSpeaking } from "../device/speech";
import { useSettings } from "./settings";

export const SCRIPT_EN = [
  "Hello? Hi, where are you right now?",
  "Okay, stay where you are. I'm just around the corner, I'll be there in two minutes.",
  "Are you near the main road? Good. Keep talking to me, I'm coming.",
];

interface FakeCallState {
  status: "idle" | "scheduled" | "ringing" | "active";
  caller: string;
  dueAt: number;
  answeredAt: number;
  schedule: (caller: string, delaySec: number) => void;
  answer: () => void;
  end: () => void;
}

let timer: ReturnType<typeof setTimeout> | null = null;
let scriptTimer: ReturnType<typeof setTimeout> | null = null;

export const useFakeCall = create<FakeCallState>((set, get) => ({
  status: "idle", caller: "Maa", dueAt: 0, answeredAt: 0,
  schedule(caller, delaySec) {
    primeAudio();
    if (timer) clearTimeout(timer);
    set({ status: "scheduled", caller, dueAt: Date.now() + delaySec * 1000 });
    timer = setTimeout(() => { set({ status: "ringing" }); startRing(); }, delaySec * 1000);
  },
  answer() {
    stopRing();
    set({ status: "active", answeredAt: Date.now() });
    let i = 0;
    const next = () => { if (get().status !== "active" || i >= SCRIPT_EN.length) return; speak(SCRIPT_EN[i++]!, useSettings.getState().lang); scriptTimer = setTimeout(next, 7000); };
    scriptTimer = setTimeout(next, 800);
  },
  end() {
    if (timer) clearTimeout(timer);
    if (scriptTimer) clearTimeout(scriptTimer);
    stopRing(); stopSpeaking();
    set({ status: "idle" });
  },
}));

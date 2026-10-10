import { set as idbSet } from "idb-keyval";
import { getBackend } from "../services/backend";

export type RecorderStatus = "idle" | "recording" | "unavailable";
type Listener = (s: RecorderStatus, startedAt: number) => void;

let rec: MediaRecorder | null = null;
let stream: MediaStream | null = null;
let startedAt = 0;
let seq = 0;
let listener: Listener | null = null;
export const onRecorderChange = (l: Listener) => { listener = l; };

function pickMime() {
  for (const m of ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"]) if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) return m;
  return undefined;
}

/** Records SOS audio in 10 s chunks and keeps them on the device (IndexedDB). Upload to private storage is added with the Supabase backend. */
let pending: { n: number; blob: Blob }[] = [];
let flushing = false;
/** Upload queued chunks; anything that fails stays queued and is retried with the next chunk. */
async function flush(sosId: string) {
  if (flushing || sosId === "local") return;
  flushing = true;
  try {
    while (pending.length) {
      const c = pending[0]!;
      await getBackend().uploadEvidence(sosId, c.n, c.blob, 10);
      pending.shift();
    }
  } catch { /* offline: retry on the next chunk */ } finally { flushing = false; }
}

export async function startRecording(sosId: string) {
  if (rec) return;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    rec = new MediaRecorder(stream, { mimeType: pickMime() });
    seq = 0; startedAt = Date.now();
    pending = [];
    rec.ondataavailable = (e) => {
      if (!e.data.size) return;
      const n = seq++;
      void idbSet(`raksha:evidence:${sosId}:${n}`, e.data);       // always keep a local copy
      pending.push({ n, blob: e.data });
      void flush(sosId);
    };
    rec.start(10_000);
    listener?.("recording", startedAt);
  } catch { listener?.("unavailable", 0); }
}
export function stopRecording() {
  try { rec?.stop(); } catch { /* already stopped */ }
  stream?.getTracks().forEach((t) => t.stop());
  rec = null; stream = null;
  listener?.("idle", 0);
}

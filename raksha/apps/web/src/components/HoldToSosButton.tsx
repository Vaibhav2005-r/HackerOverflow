import { useCallback, useEffect, useRef, useState } from "react";
import { m as motion } from "motion/react";
import { vibrate } from "../device/haptics";
import { useT } from "../i18n";

const HOLD_MS = 2000;

/** Conic progress ring (0→1 over 2 s while held). Early release resets and springs back; Space/Enter work for keyboards. */
export function HoldToSosButton({ onComplete, size = "M" }: { onComplete: () => void; size?: "M" | "XL" | number }) {
  const t = useT();
  const px = size === "XL" ? 168 : size === "M" ? 72 : size;
  const inner = size === "XL" ? 148 : size === "M" ? 62 : px - 10;
  const xl = px >= 120;
  const [p, setP] = useState(0);
  const [held, setHeld] = useState(false);
  const raf = useRef(0), start = useRef(0), lastTick = useRef(0), done = useRef(false);

  const stop = useCallback(() => { cancelAnimationFrame(raf.current); start.current = 0; setP(0); setHeld(false); }, []);
  const loop = useCallback(() => {
    const el = performance.now() - start.current;
    if (el - lastTick.current >= 400) { lastTick.current = el; vibrate([15]); }
    if (el >= HOLD_MS) { if (!done.current) { done.current = true; stop(); onComplete(); } return; }
    setP(el / HOLD_MS);
    raf.current = requestAnimationFrame(loop);
  }, [onComplete, stop]);
  const begin = useCallback(() => { if (start.current) return; done.current = false; setHeld(true); start.current = performance.now(); lastTick.current = 0; raf.current = requestAnimationFrame(loop); }, [loop]);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  return (
    <motion.button type="button" className="hold relative grid shrink-0 place-items-center rounded-full" data-testid="hold-sos" aria-label={t("guard.hold")}
      style={{ width: px, height: px, background: `conic-gradient(#FF3B5C ${p * 360}deg, rgba(255,59,92,.4) 0)`, boxShadow: `0 0 ${xl ? 48 : 32}px rgba(255,59,92,.35)` }}
      animate={{ scale: held ? 0.96 : 1 }} transition={{ type: "spring", stiffness: 380, damping: 30 }}
      onPointerDown={(e) => { try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ } begin(); }}
      onPointerUp={stop} onPointerCancel={stop} onPointerLeave={stop} onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); begin(); } }}
      onKeyUp={(e) => { if (e.key === " " || e.key === "Enter") stop(); }}>
      <span className="grid place-items-center rounded-full text-center" style={{ width: inner, height: inner, background: "#1F0A12" }}>
        <span className="font-bold text-sos" style={{ fontSize: xl ? 36 : 15, letterSpacing: ".06em", lineHeight: 1 }}>SOS
          {xl && <span className="mt-1.5 block text-xs font-medium tracking-normal text-text-2">{held ? t("guard.holding") : t("guard.hold2")}</span>}
        </span>
      </span>
    </motion.button>
  );
}

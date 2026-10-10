import type { CSSProperties } from "react";
import type { OrbState } from "../store/mapUi";

/**
 * Sakhi. Layers (bottom→top): halo, optional rings, sphere (gradient + shadows), inner light, eyes.
 * Eyes only from 56 px up and never in `sos`. Not built yet: speaking, checkIn, offline (brief §3).
 */
export function CompanionOrb({ state = "idle", size = 56 }: { state?: OrbState; size?: number }) {
  const showEyes = size >= 56 && state !== "sos";
  const sphere: CSSProperties = { boxShadow: `0 0 ${size * 0.5}px var(--glow), inset ${-size * 0.08}px ${-size * 0.1}px ${size * 0.22}px rgba(11,10,20,.35)` };
  return (
    <div className="orb" data-state={state} data-testid="orb" style={{ width: size, height: size }} aria-hidden>
      <div className="orb-halo" />
      {state === "guard" && <><div className="orb-ring orb-guard-ring" /><div className="orb-ring orb-guard-arc" /></>}
      {state === "sos" && [0, 1.5, 3].map((d) => <div key={d} className="orb-ring orb-sonar" style={{ animationDelay: `${d}s` }} />)}
      {state === "arrived" && <div className="orb-ring orb-bloom" />}
      <div className="orb-wrap">
        <div className="orb-sphere" style={sphere}>
          <div className="orb-light" />
          {showEyes && <div className="orb-eyes"><i /><i /></div>}
        </div>
      </div>
    </div>
  );
}

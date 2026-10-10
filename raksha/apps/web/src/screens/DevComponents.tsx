import { useState } from "react";
import { Eye, Footprints, Phone, ShieldCheck } from "lucide-react";
import type { RouteAssessment, Stretch } from "@raksha/core";
import { CompanionOrb } from "../components/CompanionOrb";
import { SafetyRing } from "../components/SafetyRing";
import { ClassBadge } from "../components/ClassBadge";
import { RouteCard, RouteSkeleton } from "../components/RouteCard";
import { StretchRow } from "../components/StretchRow";
import { HoldToSosButton } from "../components/HoldToSosButton";
import { PinPad } from "../components/PinPad";
import { ProgressRoute } from "../components/ProgressRoute";
import { QuickAction, SearchPill, Segmented, TimeBandChip, Toggle } from "../components/ui";
import { toast } from "../store/toast";
import { Toast } from "../components/Toast";
import type { OrbState } from "../store/mapUi";

const fake = (rsi: number, cls: RouteAssessment["cls"]): RouteAssessment => ({
  id: "x", durationS: 900, distanceM: 1100, coords: [[72.85, 19.2], [72.86, 19.2]], rsi, cls, mean: rsi, p10: rsi, extraCareFrac: 0.2, longestExtraCareM: 0, litFrac: 0.8, lowDataFrac: 0,
  stretches: [{ id: "s", startM: 640, endM: 900, lengthM: 260, cls: "EXTRA_CARE", reasons: 3, startPt: [0, 0], midPt: [0, 0], endPt: [0, 0] } as Stretch],
  segmentsForMap: [{ coords: [[72.85, 19.2], [72.853, 19.2]], cls: "COMFORTABLE" }, { coords: [[72.853, 19.2], [72.855, 19.2]], cls: "EXTRA_CARE" }, { coords: [[72.855, 19.2], [72.86, 19.2]], cls: "COMFORTABLE" }],
});

const H = ({ children }: { children: string }) => <h2 className="eyebrow mb-2 mt-8 text-text-3">{children}</h2>;

/** /dev/components — every component in every state, for fast visual polish. */
export default function DevComponents() {
  const [on, setOn] = useState(true);
  const [seg, setSeg] = useState<"walk" | "cab">("walk");
  const [sel, setSel] = useState(true);
  return (
    <div className="h-full overflow-y-auto bg-bg-0 px-5 py-6 pb-24 text-text-1" data-testid="dev-components">
      <h1 className="text-2xl font-bold">Components</h1>
      <H>CompanionOrb — 40 / 56 / 160</H>
      <div className="flex flex-wrap gap-8 pb-6">
        {(["idle", "thinking", "headsUp", "guard", "sos", "arrived"] as OrbState[]).map((s) => <div key={s} className="flex flex-col items-center gap-6 text-xs"><CompanionOrb state={s} size={56} /><CompanionOrb state={s} size={40} />{s}</div>)}
      </div>
      <div className="flex justify-center py-10"><CompanionOrb state="idle" size={160} /></div>
      <H>SafetyRing / ClassBadge</H>
      <div className="flex items-center gap-5"><SafetyRing value={82} cls="COMFORTABLE" /><SafetyRing value={55} cls="STAY_ALERT" /><SafetyRing value={24} cls="EXTRA_CARE" /></div>
      <div className="mt-3 flex gap-2"><ClassBadge cls="COMFORTABLE" /><ClassBadge cls="STAY_ALERT" /><ClassBadge cls="EXTRA_CARE" /></div>
      <H>RouteCard (selected / expanded / unselected / skeleton)</H>
      <div className="space-y-2.5">
        <RouteCard a={fake(82, "COMFORTABLE")} label="safest" pick tradeoff={{ key: "route.tradeoff", params: { minutes: 4, litPct: 92 } }} selected={sel} expanded={sel} explanations={[{ stretchId: "s", reasonKeys: ["reason.unlit"], tip: { key: "tip.torch", params: {} } }]} onSelect={() => setSel(!sel)} />
        <RouteCard a={fake(31, "EXTRA_CARE")} label="fastest" tradeoff={{ key: "route.fastestLit", params: { litPct: 40 } }} selected={false} expanded={false} explanations={[]} onSelect={() => {}} />
        <RouteSkeleton />
      </div>
      <H>StretchRow</H>
      <StretchRow stretch={fake(30, "EXTRA_CARE").stretches[0]!} exp={{ stretchId: "s", reasonKeys: ["reason.unlit"], tip: { key: "tip.torch", params: {} } }} />
      <H>ProgressRoute</H>
      <ProgressRoute a={fake(60, "STAY_ALERT")} alongM={400} totalM={1100} />
      <H>QuickAction / SearchPill / TimeBandChip</H>
      <div className="grid grid-cols-4 gap-2"><QuickAction icon={Footprints} label="Walk" onClick={() => {}} /><QuickAction icon={Phone} label="Fake call" onClick={() => {}} /><QuickAction icon={ShieldCheck} label="Spots" onClick={() => {}} /><QuickAction icon={Eye} label="Circle" onClick={() => {}} /></div>
      <div className="mt-3 space-y-3"><SearchPill label="Where to?" onClick={() => {}} /><TimeBandChip label="Night · 11:04 PM" /></div>
      <H>Toggle / Segmented / Toast</H>
      <div className="flex items-center gap-4"><Toggle on={on} onChange={setOn} label="demo" /><Segmented value={seg} onChange={setSeg} options={[["walk", "Walk"], ["cab", "Auto / Cab"]]} /><button className="btn" onClick={() => toast("Link copied")}>Toast</button></div>
      <H>HoldToSosButton — M (72) / XL (168)</H>
      <div className="flex items-center gap-6"><HoldToSosButton size="M" onComplete={() => toast("SOS (dev)")} /><HoldToSosButton size="XL" onComplete={() => toast("SOS XL (dev)")} /></div>
      <H>PinPad</H>
      <PinPad title="Enter your PIN" sub="to cancel SOS" onSubmit={(p) => toast(`PIN ${p.length} digits`)} />
      <Toast />
    </div>
  );
}

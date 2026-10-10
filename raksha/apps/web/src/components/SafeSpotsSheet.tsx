import { Fuel, Hospital, ShieldCheck, TrainFront } from "lucide-react";
import { haversine } from "@raksha/core";
import { Sheet } from "./Sheet";
import { useJourney, planRoute } from "../store/journey";
import { useCity } from "../store/city";
import { useT } from "../i18n";

const ICON = { police: ShieldCheck, hospital: Hospital, fuel: Fuel, station: TrainFront } as const;

/** Nearest places that can help, with a one-tap walking route. */
export function SafeSpotsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useT();
  const user = useJourney((s) => s.user);
  const spots = useCity((s) => s.spots);
  const nearest = user ? spots.map((s) => ({ s, d: haversine([user.lng, user.lat], [s.lng, s.lat]) })).sort((a, b) => a.d - b.d).slice(0, 5) : [];
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t("guard.safeSpots")}>
      <h3 className="mb-3 text-lg font-bold">{t("guard.safeSpots")}</h3>
      {nearest.length === 0 && <p className="text-text-2">{t("guard.noLocation")}</p>}
      <ul className="space-y-2" data-testid="safe-spots">
        {nearest.map(({ s, d }) => {
          const Icon = ICON[s.kind];
          return (
            <li key={`${s.lat}${s.lng}`}>
              <button className="btn btn-lg h-14 w-full justify-start gap-3" onClick={() => { onOpenChange(false); if (user) void planRoute([user.lng, user.lat], "My location", [s.lng, s.lat], s.name, "walk"); }}>
                <span style={{ color: "var(--info)" }}><Icon size={20} strokeWidth={1.75} /></span>
                <span className="flex-1 truncate text-left">{s.name}</span><span className="text-sm text-text-2">{Math.round(d)} m</span>
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}

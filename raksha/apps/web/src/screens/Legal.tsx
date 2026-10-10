import { ArrowLeft } from "lucide-react";
import { navigate } from "../lib/router";
import { useT } from "../i18n";

const P = ({ children }: { children: React.ReactNode }) => <p className="mt-2 text-[15px] leading-6 text-text-2">{children}</p>;
const H = ({ children }: { children: string }) => <h2 className="mt-6 text-lg font-semibold">{children}</h2>;

/** Plain-language privacy notice and terms. Not legal advice — have them reviewed before a public launch. */
export default function Legal({ kind }: { kind: "privacy" | "terms" }) {
  const t = useT();
  return (
    <div className="absolute inset-0 z-20 overflow-y-auto bg-bg-0 px-5 pb-16 safe-top" data-testid={`legal-${kind}`}>
      <div className="flex items-center gap-2 py-2"><button className="btn !min-h-11" onClick={() => history.length > 1 ? history.back() : navigate("/settings")} aria-label={t("common.back")}><ArrowLeft size={20} /></button>
        <h1 className="text-xl font-bold">{t(kind === "privacy" ? "legal.privacy" : "legal.terms")}</h1></div>
      {kind === "privacy" ? (
        <>
          <P>Raksha is built to keep your information on your device unless you choose to share it. This page explains exactly what is stored, where, and for how long.</P>
          <H>What stays on your device</H>
          <P>Your name, settings, trusted contacts (in local mode), the hashed PINs, recent searches and your last position. PINs are hashed with PBKDF2-SHA256 on your device and are never sent anywhere. Safety data for your city is downloaded to your device and scored there; your position is not sent to us to do that.</P>
          <H>What leaves your device, and when</H>
          <P><b>Only if you use the online backend:</b> your account (anonymous, or your email if you add one), your trusted contacts, and — only while you are sharing live or an SOS is active — your location, battery level and (in an SOS) short audio clips. Anyone holding your share link can see that live view until it expires. Community reports are stored as a map cell, never as your exact position.</P>
          <P>Your device also asks public services for what it needs: map tiles (OpenFreeMap), routes (OSRM / OpenRouteService), and place search (Photon / Nominatim). These services see the places you search for and route between, as any map app does.</P>
          <H>How long we keep it</H>
          <P>Live and walk shares: location trails are deleted 24 hours after the share ends. SOS records: 30 days. Community reports: 180 days. Share links expire automatically.</P>
          <H>Your control</H>
          <P>Settings → <i>Delete all my data</i> removes your account, contacts, shares, SOS records, reports and audio. You can stop sharing at any time. We do not sell data, show ads, or use analytics or trackers.</P>
          <H>Emergencies</H>
          <P>Raksha cannot contact emergency services for you. In danger, call <b>112</b> (India) or the women's helpline <b>181</b>.</P>
        </>
      ) : (
        <>
          <P>By using Raksha you agree to these terms.</P>
          <H>An aid to awareness, not a guarantee</H>
          <P>Raksha estimates conditions such as lighting and activity from open map data and community reports. These are estimates that can be wrong or out of date. A "Comfortable" label is not a promise of safety, and the app can fail (no signal, no battery, no GPS). Use your own judgement and never rely on Raksha as your only safeguard.</P>
          <H>Emergencies</H>
          <P>Raksha is not an emergency service. It does not call the police for you. In danger, call 112. Features such as SOS share a link with people <i>you</i> choose; they may not see it in time.</P>
          <H>Acceptable use</H>
          <P>Do not file false or abusive community reports, track anyone without their knowledge, or use the app for stalking or harassment. We may remove reports or accounts that do.</P>
          <H>Open data</H>
          <P>Map data © OpenStreetMap contributors (ODbL). Scores are derived from it and are provided "as is" without warranty.</P>
          <H>Changes</H>
          <P>If these terms or the privacy notice change materially, the app will tell you.</P>
        </>
      )}
    </div>
  );
}

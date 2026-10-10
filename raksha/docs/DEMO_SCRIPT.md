# Demo script (≈ 2 minutes)

Setup (once, ~30 s): run the app (`./start-demo.sh` → http://localhost:4173), complete onboarding (name **Riya**, contact **Maa** `+91 98765 43210`, PIN **4821**, duress PIN **1357**). In **Settings → Demo controls** set *Pretend it's* **Night** (default) and *Walk speed* **40×**. Judges evaluate in daylight, so the app pretends it is 11 PM.

| Time | Do | Say |
|---|---|---|
| 0:00 | Home. Tap a coloured **hexagon**. | "Every hexagon is a ~170 m patch scored from open map data — here's *why*: poorly lit, nothing open late. It never says 'unsafe', only 'extra care', with a confidence." Tap the **time chip** to flip Night ↔ Day and watch the map re-score. |
| 0:20 | **Search → Try the demo → Night walk past the park edge.** | "Sakhi looks at lighting along every route." (the orb *thinks*, then routes draw) |
| 0:30 | Tap **Safest** to expand it. | "A route comfort score, the trade-off in plain words, and each weak stretch with a tip." |
| 0:40 | **Simulate walk** (Plan sheet). | "I can't walk at night in your room, so this walks the route with realistic GPS noise at 40×." |
| 0:55 | **Heads-up card** appears. | "About 150 m before a dark stretch Sakhi warns me and offers to share my location." |
| 1:05 | **Guard mode** switches on by itself. | "Inside an extra-care stretch the screen becomes one-handed: hold for SOS, siren, fake call, share live, nearest safe spot. Left-handed? Flip it." |
| 1:20 | Hold the big **SOS** for 2 s → SOS screen. In Settings → *Open contact view* (or open the link under "Send link"). | "Silent by default. Her circle gets a live link — this is their view in another tab." |
| 1:35 | **I'm safe** → enter **1357** (duress). | "She's forced to cancel, so she types the duress PIN. Her screen says 'cancelled'…" |
| 1:45 | Switch to the contact tab. | "…but her circle still sees SOS **active** with a *possible coercion* flag." |
| 1:55 | Optional: **Fake call** (Home) → Answer. | "And a fake call is one tap away when she needs a reason to leave." |

Backup (if routing is slow): the demo routes are bundled, so nothing needs the network except map tiles. Offline works too: reload with the network off and Guard still opens.
Shake test without a phone: *Settings → Simulate shake* (turn on "Shake to SOS always armed").

/** All user-facing strings. Keys referenced by core (route.*, reason.*, tip.*) live here too. */
export const en = {
  // safety classes
  "class.COMFORTABLE": "Comfortable", "class.STAY_ALERT": "Stay alert", "class.EXTRA_CARE": "Extra care",
  "class.hint.COMFORTABLE": "Looks comfortable on open map data", "class.hint.STAY_ALERT": "Some factors suggest staying alert", "class.hint.EXTRA_CARE": "Take extra care here",
  "band.day": "Day", "band.evening": "Evening", "band.night": "Night",
  "conf.0": "Low data", "conf.1": "Medium confidence", "conf.2": "High confidence",
  // reasons
  "reason.unlit": "Poorly lit", "reason.isolated": "Isolated", "reason.nothingOpen": "Nothing open late", "reason.farFromHelp": "Far from help",
  "reason.narrowLane": "Narrow lane", "reason.fewPeople": "Few people around", "reason.reports": "Community reports", "reason.lowData": "Limited map data",
  "positive.WELL_LIT": "Well lit", "positive.BUSY_STREET": "Busy, open late", "positive.HELP_NEARBY": "Help nearby", "positive.TRANSIT_NEARBY": "Transit nearby",
  // tips
  "tip.torch": "Keep your phone torch ready", "tip.share": "Share your live location before this stretch",
  "tip.openPlace": "Nearest open place: {place}", "tip.helpOffRoute": "{place}, about {meters} m off route",
  // routes
  "route.tradeoff": "{minutes} min longer, {litPct}% on well-lit streets.", "route.fastestLit": "{litPct}% on well-lit streets.",
  "route.safest": "Safest", "route.balanced": "Balanced", "route.fastest": "Fastest", "route.muchLonger": "Much longer than the fastest route",
  "route.stretches": "{n} stretch needs care", "route.stretches_other": "{n} stretches need care", "route.noStretches": "No weak stretches found",
  "route.rsi": "Route comfort",
  // generic
  "disclaimer": "Raksha helps you stay aware; it can't guarantee safety. In danger, call 112.",
  "basedOn": "Based on open map data & community reports — conditions can change.",
  "app.tagline": "A companion that walks with you.",
  "common.next": "Next", "common.back": "Back", "common.done": "Done", "common.cancel": "Cancel", "common.save": "Save", "common.delete": "Delete",
  "common.skip": "Skip", "common.close": "Close", "common.start": "Start", "common.stop": "Stop", "common.yes": "Yes", "common.no": "No",
  // onboarding
  "ob.s1.title": "Know before you go", "ob.s1.body": "Raksha reads lighting, activity and help nearby, so you see weak stretches before you reach them.",
  "ob.s2.title": "Sakhi walks with you", "ob.s2.body": "A calm companion that gives you a heads-up, suggests brighter streets and stays quiet when all is well.",
  "ob.s3.title": "One hand is enough", "ob.s3.body": "Guard mode puts everything under your thumb: hold to send SOS, fake a call, or share where you are.",
  "ob.name.title": "What should Sakhi call you?", "ob.name.ph": "Your first name",
  "ob.circle.title": "Your trusted circle", "ob.circle.body": "Add someone who can follow your live location if you ask. You can add up to 5.",
  "ob.pin.title": "Set your PIN", "ob.pin.body": "You'll need this to cancel an SOS. 4–6 digits.", "ob.pin.confirm": "Confirm your PIN",
  "ob.duress.title": "Set a duress PIN", "ob.duress.body": "If someone forces you to cancel, enter this instead. It looks like a normal cancel, but your circle keeps seeing you.",
  "ob.duress.same": "That matches your PIN. Choose a different one.", "ob.pin.mismatch": "PINs didn't match. Try again.",
  "ob.perm.title": "Two permissions", "ob.perm.body": "Location lets Sakhi warn you ahead of time. Motion lets you shake your phone to start an SOS. Your location stays on this device unless you share it.",
  "ob.perm.grant": "Allow location & motion", "ob.perm.later": "Maybe later",
  "ob.ready.title": "You're set", "ob.ready.body": "Try the demo route to see Sakhi in action.",
  // home
  "home.search": "Where to?", "home.guardNow": "Guard me now", "home.fakeCall": "Fake call", "home.circle": "Circle", "home.settings": "Settings",
  "home.hexes": "Safety map", "home.demo": "Demo route", "home.outside": "You're outside the demo area. Try the demo route.", "home.tapHex": "Tap a hexagon to see why",
  "home.loadingCity": "Loading city data…", "home.offline": "You're offline. Guard and fake call still work.",
  // hex sheet
  "hex.title": "{cls} · {band}", "hex.score": "Estimated comfort {score}/100",
  // plan
  "plan.title": "Choose your route", "plan.start": "Start", "plan.simulate": "Simulate walk", "plan.walk": "Walk", "plan.vehicle": "Cab / auto",
  "plan.from": "From", "plan.to": "To", "plan.finding": "Finding routes…", "plan.error": "Couldn't find routes. Check your connection.",
  "plan.min": "{n} min", "plan.km": "{n} km", "plan.weak": "Weak stretches", "plan.noRoute": "No route found between these places.",
  // journey
  "journey.next": "Next", "journey.eta": "ETA {min} min", "journey.remaining": "{m} m to go", "journey.arrived": "I've arrived", "journey.stopHere": "Stop here",
  "journey.guard": "Guard", "journey.sim": "Simulated walk", "journey.share": "Share live location", "journey.okay": "I'm okay", "journey.end": "End journey",
  "journey.detour": "Take the lit road", "journey.alertTitle": "Heads-up", "journey.inMeters": "In about {m} m",
  // guard
  "guard.title": "Guard mode", "guard.hold": "Hold for SOS", "guard.holding": "Keep holding…", "guard.call112": "Call 112", "guard.call181": "Women helpline 181",
  "guard.fakeCall": "Fake call", "guard.share": "Share location", "guard.nearest": "Nearest safe spot", "guard.exit": "Exit Guard", "guard.handLeft": "Left hand", "guard.handRight": "Right hand",
  "guard.safeSpots": "Nearest places that can help",
  // sos
  "sos.title": "SOS is active", "sos.silent": "Silent mode", "sos.loud": "Loud mode", "sos.sendTo": "Send your live link", "sos.copy": "Copy link", "sos.copied": "Copied",
  "sos.cancel": "Cancel SOS", "sos.enterPin": "Enter your PIN to cancel", "sos.wrong": "That PIN didn't match. {n} tries left.", "sos.locked": "Too many tries. Wait a moment.",
  "sos.cancelled": "SOS cancelled", "sos.cancelledBody": "You're all set.", "sos.countdown": "Sending SOS in {n}", "sos.tapCancel": "Tap to cancel", "sos.recording": "Recording audio evidence",
  "sos.resolved": "SOS ended", "sos.shareText": "{name} needs help. Follow live location:",
  // check-in
  "checkin.title": "Are you okay?", "checkin.stopped": "You've stopped for a while.", "checkin.offroute": "You've moved off the route.", "checkin.timer": "You haven't arrived yet.",
  "checkin.ok": "I'm okay", "checkin.in": "Auto-alert in {n}s",
  // fake call
  "fake.title": "Fake call", "fake.caller": "Caller name", "fake.delay": "Ring in", "fake.now": "Now", "fake.10s": "10 s", "fake.1m": "1 min", "fake.5m": "5 min",
  "fake.schedule": "Schedule call", "fake.incoming": "Incoming call", "fake.answer": "Answer", "fake.decline": "Decline", "fake.end": "End", "fake.mobile": "mobile", "fake.scheduled": "Call coming in {n}",
  // circle
  "circle.title": "Trusted circle", "circle.add": "Add contact", "circle.name": "Name", "circle.phone": "Phone (with country code)", "circle.relation": "Relation (optional)",
  "circle.empty": "No one yet. Add someone you trust.", "circle.max": "You can add up to 5 contacts.", "circle.invalidPhone": "Enter 10–15 digits, optionally starting with +.",
  // settings
  "set.title": "Settings", "set.language": "Language", "set.voice": "Voice for Sakhi", "set.haptics": "Haptics", "set.sosMode": "SOS mode", "set.hand": "Guard hand",
  "set.shakeAlways": "Shake to SOS always armed", "set.pin": "Change PINs", "set.demo": "Demo controls", "set.pretend": "Pretend it's", "set.speed": "Walk speed", "set.localMode": "Local demo mode",
  "set.openContact": "Open contact view", "set.simShake": "Simulate shake", "set.reset": "Delete all my data", "set.resetConfirm": "This clears your circle, PINs and settings on this device.",
  "set.about": "About & data", "set.attribution": "Map data © OpenStreetMap contributors (ODbL). Routing by FOSSGIS/OSRM. Tiles by OpenFreeMap.",
  // share view
  "sv.title": "{name} is sharing their location", "sv.active": "Live", "sv.ended": "Ended", "sv.sos": "SOS active", "sv.coercion": "Possible coercion — they may be unable to speak freely",
  "sv.last": "Last update {t}", "sv.call": "Call {name}", "sv.call112": "Call 112", "sv.notfound": "This link isn't valid or has expired.", "sv.battery": "Battery {p}%", "sv.waiting": "Waiting for the first location…",
  // sakhi
  "guard.hold2": "Hold 2 seconds", "guard.noLocation": "Waiting for your location…", "guard.siren": "Siren", "guard.shareLive": "Share live", "guard.safeSpot": "Safe spot", "guard.modeOn": "Guard mode · on", "guard.endGuard": "End guard", "guard.shakeOn": "Shake to alert · on", "guard.shakeOff": "Shake to alert · off",
  "route.pick": "Sakhi's pick", "route.watch": "{n} stretches to watch",
  "journey.detourBtn": "Take the lit road (+{n} min)", "journey.shareMine": "Share my location", "journey.fine": "I'm fine", "journey.checkin": "Check-in {t}", "journey.continue": "Continue", "journey.arrow": "Continue along the route",
  "sos.st.circle": "Circle notified", "sos.st.sendLink": "Send the link", "sos.st.live": "Sharing live", "sos.st.liveOn": "Live link on", "sos.st.starting": "Starting…", "sos.st.rec": "Recording audio", "sos.st.noMic": "Mic unavailable", "sos.st.acc": "Location accuracy",
  "sos.overlineSilent": "SOS · Silent", "sos.overlineLoud": "SOS · Loud", "sos.sendAgain": "Send link again", "sos.toLoud": "Switch to loud", "sos.mute": "Mute siren", "sos.imSafe": "I'm safe", "sos.pinTitle": "Enter your PIN", "sos.pinSub": "to cancel SOS", "sos.pinWrong": "That PIN didn't match. Try again.",
  "sos.shake": "Shake detected", "sos.alerting": "Alerting your circle", "sos.cancelBtn": "Cancel",
  "resolved.title": "SOS cancelled. Glad you're okay.", "resolved.tell": "Tell my circle I'm safe", "resolved.sent": "Your circle knows you're safe",
  "arrived.title": "You've reached.", "arrived.ask": "Should I let {contact} know you're safe?", "arrived.tell": "Tell {contact} I'm home", "arrived.min": "min", "arrived.km": "km", "arrived.guarded": "stretches guarded",
  "home.walk": "Walk with me", "home.spots": "Safe spots", "home.layer": "Safety layer", "home.locate": "Center on me",
  "search.placeholder": "Search a place", "search.demo": "Try the demo", "search.saved": "Saved", "search.recent": "Recent", "search.results": "Places", "search.none": "I couldn't find that place. Try a nearby landmark or area name.",
  "plan.toDest": "To {dest}", "plan.shareWalk": "Share my walk with {contact}", "plan.checkLate": "Check on me if I'm late", "plan.startWith": "Start with Sakhi", "plan.thinking": "Let me look at the lighting along each way…", "plan.autoCab": "Auto / Cab",
  "report.here": "Report something here", "report.thanks": "Thanks — I've noted it", "report.harassment": "Harassment", "report.stalking": "Stalking", "report.felt_unsafe": "Felt uneasy", "report.poor_lighting": "Poor lighting", "report.no_help_nearby": "No help nearby", "report.well_lit": "Well lit", "report.helpful_people": "Helpful people", "report.felt_safe": "Felt comfortable",
  "set.reduceMotion": "Reduce motion",
  "plan.yourCircle": "your circle",
  "sos.toSilent": "Switch to silent", "sos.timerTrigger": "No answer to check-in",
  "journey.withYou": "I'm with you. Take your time.",
  "common.change": "Change",
  "journey.rerouted": "Taking the lit road",
  "share.prompt": "I couldn't reach you, so your circle can follow your live location.",
  "sakhi.idle": "I'm here. Tell me where you're headed, or turn on Guard.",
  "sakhi.loading": "Getting ready…",
} as const;
export type StringKey = keyof typeof en;

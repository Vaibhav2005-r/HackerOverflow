export type Lang = "en" | "hi";
export const SHIPPED_LANGS: Lang[] = ["en"];

export type MessageKey =
  | "greet_morning" | "greet_afternoon" | "greet_evening" | "greet_night"
  | "route_ready" | "journey_start" | "detour_offer"
  | "heads_up_unlit" | "heads_up_isolated" | "heads_up_generic"
  | "guard_on" | "guard_off" | "check_in" | "check_in_offroute" | "check_in_timer" | "check_in_ok" | "soft_alert_sent"
  | "arrived" | "sos_countdown" | "sos_active_silent" | "sos_active_loud" | "sos_resolved" | "pin_wrong" | "pin_locked";

export const MESSAGE_KEYS: MessageKey[] = [
  "greet_morning", "greet_afternoon", "greet_evening", "greet_night", "route_ready", "journey_start", "detour_offer",
  "heads_up_unlit", "heads_up_isolated", "heads_up_generic", "guard_on", "guard_off", "check_in", "check_in_offroute",
  "check_in_timer", "check_in_ok", "soft_alert_sent", "arrived", "sos_countdown", "sos_active_silent", "sos_active_loud",
  "sos_resolved", "pin_wrong", "pin_locked",
];

/** Calm, warm, specific. Never "danger" / "unsafe area" — use "extra care" / "stay alert". */
export const BANK: Record<Lang, Partial<Record<MessageKey, string[]>>> = {
  en: {
    greet_morning: ["Good morning, {name}. Where are we heading?", "Morning, {name}. I'm ready when you are."],
    greet_afternoon: ["Good afternoon, {name}. Where to?", "Hi {name}. Tell me where you're going and I'll check the way."],
    greet_evening: ["Good evening, {name}. I'll keep an eye on the lighting for you tonight.", "Evening, {name}. Let's pick a well-lit way home."],
    greet_night: ["It's late, {name}. Let's find you the calmest route.", "I'm up with you, {name}. Where are we going?"],
    route_ready: ["I found a way that's {minutes} min longer but stays on busier, well-lit roads.", "This route is {minutes} min longer and {litPct}% well-lit. Want to take it?"],
    journey_start: ["I'm with you. I'll tell you before anything needs extra care.", "Off we go. I'll watch the road ahead."],
    detour_offer: ["There's a lit road that avoids it for about {minutes} more min. Take it?", "I can route you around that stretch — about {minutes} min extra."],
    heads_up_unlit: ["In about {m} m the road gets dark for a stretch. Torch ready? I'm right here.", "{m} m ahead is poorly lit. Keep your phone torch handy — I'm with you."],
    heads_up_isolated: ["The next stretch is quiet. Want me to share your location with {contact} until you're through?", "It gets quiet in about {m} m. Shall I let {contact} follow along?"],
    heads_up_generic: ["Extra care for the next stretch, about {m} m. Stay alert — I'm with you.", "A less busy patch is coming up in {m} m. I'll stay with you."],
    guard_on: ["Guard mode is on. Hold the big button if you need help — I'll handle the rest.", "I've switched to Guard. One hand is enough: hold the button and I'll take over."],
    guard_off: ["You're back on a busy street. Guard mode off — nicely done.", "Busy street again. Guard is off; I'm still here."],
    check_in: ["You've stopped for a while. Everything okay?", "Just checking in — are you okay?"],
    check_in_offroute: ["Taking a different way? Tap if you're okay.", "You've moved off the route. Everything alright?"],
    check_in_timer: ["You haven't arrived yet. Are you okay?", "It's taking longer than expected. Tap if you're fine."],
    check_in_ok: ["Glad you're okay. I'm still with you.", "Thanks for letting me know. Carrying on."],
    soft_alert_sent: ["I couldn't reach you, so I've let {contact} know and shared where you are.", "No reply, so {contact} now has your live location."],
    arrived: ["You've reached. Should I let {contact} know you're safe?", "You made it. Want me to tell {contact}?"],
    sos_countdown: ["Sending SOS in {seconds}. Tap to cancel.", "SOS starts in {seconds} — tap if this was a mistake."],
    sos_active_silent: ["Help is on the way. Your circle can see where you are.", "I'm sharing your live location quietly. Stay as safe as you can."],
    sos_active_loud: ["SOS is on, the siren is sounding and your circle can see you.", "Loud alert active. Your circle is following your location."],
    sos_resolved: ["SOS is off. I'm glad you're okay.", "Alert ended. I'm still here if you need me."],
    pin_wrong: ["That PIN didn't match. Try again.", "Not quite — try once more."],
    pin_locked: ["Too many tries. Please wait a moment.", "Locked for a moment. Please wait."],
  },
  hi: {},
};

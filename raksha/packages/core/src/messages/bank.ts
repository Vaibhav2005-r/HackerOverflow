export type Lang = "en" | "hi";
export const SHIPPED_LANGS: Lang[] = ["en", "hi"];

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
  hi: {
    greet_morning: ["सुप्रभात, {name}। कहाँ चलना है?", "नमस्ते, {name}। जब आप तैयार हों, मैं तैयार हूँ।"],
    greet_afternoon: ["नमस्ते, {name}। कहाँ जाना है?", "{name}, बताइए कहाँ जा रही हैं, मैं रास्ता देख लेती हूँ।"],
    greet_evening: ["शुभ संध्या, {name}। आज रात मैं रोशनी का ध्यान रखूँगी।", "शाम हो गई, {name}। चलिए घर के लिए रोशन रास्ता चुनते हैं।"],
    greet_night: ["देर हो गई है, {name}। सबसे सहज रास्ता ढूँढते हैं।", "मैं आपके साथ जाग रही हूँ, {name}। कहाँ चलना है?"],
    route_ready: ["एक रास्ता मिला जो {minutes} मिनट लंबा है, पर चहल-पहल वाली, रोशन सड़कों से जाता है।", "यह रास्ता {minutes} मिनट लंबा है और {litPct}% रोशन है। इसी से चलें?"],
    journey_start: ["मैं आपके साथ हूँ। कहीं सावधानी चाहिए होगी तो पहले बता दूँगी।", "चलिए। मैं आगे का रास्ता देखती रहूँगी।"],
    detour_offer: ["एक रोशन सड़क है जो इससे बचाती है, बस {minutes} मिनट ज़्यादा। ले लें?", "मैं उस हिस्से से घुमाकर ले जा सकती हूँ — लगभग {minutes} मिनट ज़्यादा।"],
    heads_up_unlit: ["लगभग {m} मी. बाद कुछ दूर सड़क अँधेरी है। टॉर्च तैयार है? मैं यहीं हूँ।", "{m} मी. आगे रोशनी कम है। फ़ोन की टॉर्च हाथ में रखिए — मैं साथ हूँ।"],
    heads_up_isolated: ["आगे का हिस्सा सुनसान है। क्या {contact} को आपकी लोकेशन दिखा दूँ, जब तक आप निकल न जाएँ?", "लगभग {m} मी. बाद सुनसान है। {contact} को साथ-साथ देखने दूँ?"],
    heads_up_generic: ["अगले लगभग {m} मी. में ख़ास सावधानी रखें। सतर्क रहिए — मैं साथ हूँ।", "{m} मी. बाद कम चहल-पहल वाला हिस्सा आएगा। मैं आपके साथ रहूँगी।"],
    guard_on: ["गार्ड मोड चालू है। ज़रूरत हो तो बड़ा बटन दबाए रखिए — बाक़ी मैं संभाल लूँगी।", "मैंने गार्ड चालू कर दिया है। एक हाथ काफ़ी है: बटन दबाए रखिए, मैं सँभाल लूँगी।"],
    guard_off: ["आप फिर चहल-पहल वाली सड़क पर हैं। गार्ड बंद — बहुत अच्छे।", "फिर भीड़-भाड़ वाली सड़क। गार्ड बंद है; मैं यहीं हूँ।"],
    check_in: ["आप कुछ देर से रुकी हुई हैं। सब ठीक है?", "बस हाल पूछ रही हूँ — आप ठीक हैं?"],
    check_in_offroute: ["कोई और रास्ता ले रही हैं? ठीक हों तो टैप कीजिए।", "आप रास्ते से हट गई हैं। सब ठीक है?"],
    check_in_timer: ["आप अभी तक पहुँची नहीं हैं। क्या आप ठीक हैं?", "अंदाज़े से ज़्यादा समय लग रहा है। ठीक हों तो टैप कीजिए।"],
    check_in_ok: ["अच्छा है कि आप ठीक हैं। मैं अब भी साथ हूँ।", "बताने के लिए शुक्रिया। आगे बढ़ते हैं।"],
    soft_alert_sent: ["आपसे जवाब नहीं मिला, इसलिए मैंने {contact} को बता दिया और आपकी लोकेशन साझा कर दी है।", "जवाब नहीं आया, तो अब {contact} के पास आपकी लाइव लोकेशन है।"],
    arrived: ["आप पहुँच गईं। क्या {contact} को बता दूँ कि आप सुरक्षित हैं?", "आप पहुँच गईं। {contact} को बताना है?"],
    sos_countdown: ["{seconds} में SOS भेजा जाएगा। रद्द करने के लिए टैप कीजिए।", "SOS {seconds} में शुरू होगा — गलती से हुआ हो तो टैप कीजिए।"],
    sos_active_silent: ["मदद आ रही है। आपके लोग देख सकते हैं कि आप कहाँ हैं।", "मैं चुपचाप आपकी लाइव लोकेशन साझा कर रही हूँ। जितना हो सके सुरक्षित रहिए।"],
    sos_active_loud: ["SOS चालू है, सायरन बज रहा है और आपके लोग आपको देख रहे हैं।", "तेज़ अलर्ट चालू। आपके लोग आपकी लोकेशन देख रहे हैं।"],
    sos_resolved: ["SOS बंद। अच्छा है कि आप ठीक हैं।", "अलर्ट ख़त्म। ज़रूरत हो तो मैं यहीं हूँ।"],
    pin_wrong: ["PIN मेल नहीं खाया। फिर कोशिश करें।", "ठीक नहीं बैठा — एक बार और कोशिश करें।"],
    pin_locked: ["बहुत कोशिशें हो गईं। थोड़ा रुकिए।", "कुछ देर के लिए बंद। थोड़ा रुकिए।"],
  },
};

export function speak(text: string, lang: "en" | "hi") {
  if (!("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  synth.cancel(); // a new, higher-priority message replaces the old one
  const u = new SpeechSynthesisUtterance(text);
  const want = lang === "hi" ? "hi-IN" : "en-IN";
  u.lang = want; u.rate = 1;
  const v = synth.getVoices().find((x) => x.lang === want) ?? synth.getVoices().find((x) => x.lang.startsWith(lang));
  if (v) u.voice = v;
  synth.speak(u);
}
export const stopSpeaking = () => { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); };

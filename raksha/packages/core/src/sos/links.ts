const digits = (s: string) => s.replace(/\D/g, "");

export const shareUrl = (origin: string, token: string) => `${origin.replace(/\/$/, "")}/s/${token}`;
export const whatsappLink = (phone: string, text: string) => `https://wa.me/${digits(phone)}?text=${encodeURIComponent(text)}`;
export const smsLink = (phone: string, body: string) => `sms:${phone.startsWith("+") ? "+" : ""}${digits(phone)}?&body=${encodeURIComponent(body)}`;
export const telLink = (phone: string) => `tel:${phone.startsWith("+") ? "+" : ""}${digits(phone)}`;
export const EMERGENCY = { police: "112", womenHelpline: "181" } as const;
